"""Real concurrent SQL checks against the local Docker Supabase stack only.

All users and receipts are synthetic and deleted in finally. No hosted URL or
credential is accepted. Run: python scripts/check-progression-concurrency.py
"""

import hashlib
import json
import subprocess
import threading
import uuid
from concurrent.futures import ThreadPoolExecutor

CONTAINER = "supabase_db_foodie-cards"
RESTAURANT = "10000000-0000-4000-8000-000000000001"
ITEM = "20000000-0000-4000-8000-000000000001"


def sql(statement, check=True):
    result = subprocess.run(
        ["docker", "exec", "-i", CONTAINER, "psql", "-X", "-q", "-t", "-A",
         "-v", "ON_ERROR_STOP=1", "-U", "postgres", "-d", "postgres"],
        input=statement, text=True, capture_output=True, timeout=30,
    )
    if check and result.returncode:
        raise RuntimeError(result.stderr.strip())
    return result


def identifier():
    return str(uuid.uuid4())


def payload(receipt, submission, number):
    return {"draftId": receipt, "submissionId": submission,
            "restaurantId": RESTAURANT, "receiptDate": "2026-10-10",
            "receiptNumber": number, "totalMinor": 1000, "currency": "USD",
            "items": [{"menuItemId": ITEM, "originalText": "TEST CHICKEN",
                       "confirmedName": "Fried chicken", "quantity": 1}]}


def draft(user, image_hash):
    receipt = identifier()
    sql(f"""insert into public.receipts
      (id,user_id,restaurant_id,receipt_date,total_minor,currency,image_path,image_hash)
      values ('{receipt}','{user}','{RESTAURANT}','2026-10-10',1000,'USD',
              '{user}/{receipt}.jpg','{image_hash}');""")
    return receipt


def acceptance(user, receipt, submission, number):
    body = json.dumps(payload(receipt, submission, number))
    return (f"set role service_role; select public.accept_receipt('{user}',"
            f"'{receipt}','{submission}',$body${body}$body$::jsonb);")


def parallel(statements):
    barrier = threading.Barrier(len(statements))

    def run(statement):
        barrier.wait(timeout=5)
        return sql(statement, check=False)

    with ThreadPoolExecutor(max_workers=len(statements)) as pool:
        return list(pool.map(run, statements))


def state(user):
    query = f"""select jsonb_build_object(
      'accountXP',(select account_xp from public.profiles where id='{user}'),
      'cardXP',coalesce((select sum(card_xp) from public.cards where user_id='{user}'),0),
      'cards',(select count(*) from public.cards where user_id='{user}'),
      'visits',(select count(*) from public.visits where user_id='{user}'),
      'items',(select count(*) from public.user_items where user_id='{user}'),
      'accepted',(select count(*) from public.receipts where user_id='{user}' and status='accepted'),
      'badges',(select count(*) from public.badge_awards where user_id='{user}'));"""
    return json.loads(sql(query).stdout.strip())


def require(condition, message):
    if not condition:
        raise AssertionError(message)


def main():
    users = [identifier() for _ in range(5)]
    try:
        for user in users:
            sql(f"insert into auth.users(id,email) values ('{user}','test-{user}@example.invalid');")
        owner, left, right, fingerprint_left, fingerprint_right = users
        receipts = [draft(owner, hashlib.sha256(identifier().encode()).hexdigest()) for _ in range(2)]
        requests = [acceptance(owner, receipt, identifier(), f"TEST-{index}")
                    for index, receipt in enumerate(receipts)]
        results = parallel(requests)
        require(all(result.returncode == 0 for result in results),
                "Parallel unique same-user receipts must both succeed: " +
                " | ".join(result.stderr.strip() for result in results))
        require(state(owner) == {"accountXP": 150, "cardXP": 150, "cards": 1,
                                "visits": 1, "items": 1, "accepted": 2, "badges": 1},
                "Concurrent receipts duplicated visits, new-item XP or account awards: " + str(state(owner)))
        print("PASS: same-user concurrent receipts serialize visit/item/stage/badge awards")

        replay = parallel([requests[0], requests[0]])
        original = json.loads(results[0].stdout.strip())
        require(all(result.returncode == 0 and json.loads(result.stdout.strip()) == original
                    for result in replay), "Concurrent retries must return the exact original response")
        require(state(owner)["cardXP"] == 150, "Concurrent replay changed XP")
        print("PASS: concurrent replay returns original response without awarding again")

        review = (f"set role service_role; select public.save_review('{owner}',"
                  f"'{RESTAURANT}',0,'Synthetic negative review');")
        reviews = parallel([review, review])
        require(all(result.returncode == 0 for result in reviews), "Concurrent review saves failed")
        require(state(owner)["accountXP"] == 200 and state(owner)["badges"] == 2,
                "Concurrent review saves must award First Impressions once")
        print("PASS: concurrent negative reviews award writing recognition exactly once")

        shared_hash = hashlib.sha256(identifier().encode()).hexdigest()
        pair = [(user, draft(user, shared_hash)) for user in (left, right)]
        duplicate_results = parallel([acceptance(user, receipt, identifier(), "TEST-DUPLICATE")
                                      for user, receipt in pair])
        winners = [index for index, result in enumerate(duplicate_results) if result.returncode == 0]
        require(len(winners) == 1, "Cross-user duplicate race must have exactly one winner")
        loser_index = 1 - winners[0]
        require("DUPLICATE_RECEIPT" in duplicate_results[loser_index].stderr,
                "Duplicate loser must receive safe duplicate error")
        loser = state(pair[loser_index][0])
        require(loser == {"accountXP": 0, "cardXP": 0, "cards": 0, "visits": 0,
                          "items": 0, "accepted": 0, "badges": 0},
                "Duplicate loser left partially awarded state: " + str(loser))
        print("PASS: cross-user duplicate race rolls loser back without partial progress")

        fingerprint_pair = [(user, draft(user, hashlib.sha256(identifier().encode()).hexdigest()))
                            for user in (fingerprint_left, fingerprint_right)]
        fingerprint_results = parallel([acceptance(user, receipt, identifier(), "TEST-FINGERPRINT-DUPLICATE")
                                        for user, receipt in fingerprint_pair])
        fingerprint_winners = [index for index, result in enumerate(fingerprint_results)
                               if result.returncode == 0]
        require(len(fingerprint_winners) == 1, "Fingerprint-only race must have exactly one winner")
        fingerprint_loser = 1 - fingerprint_winners[0]
        require("DUPLICATE_RECEIPT" in fingerprint_results[fingerprint_loser].stderr,
                "Fingerprint-only loser must receive the safe duplicate error")
        require(state(fingerprint_pair[fingerprint_loser][0]) == {
            "accountXP": 0, "cardXP": 0, "cards": 0, "visits": 0,
            "items": 0, "accepted": 0, "badges": 0,
        }, "Fingerprint-only loser left partial progress")
        print("PASS: different-image fingerprint duplicate race also rolls loser back")
    finally:
        quoted = ",".join(f"'{user}'" for user in users)
        sql(f"delete from auth.users where id in ({quoted});")


if __name__ == "__main__":
    main()
