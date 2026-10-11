begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions, pg_catalog;
select plan(49);

select has_column('public', 'receipts', 'acceptance_result', 'accepted receipts persist their exact replay response');
select has_function('public', 'accept_receipt', array['uuid','uuid','uuid','jsonb'], 'accept_receipt has the agreed server RPC signature');
select has_function('public', 'save_review', array['uuid','uuid','numeric','text'], 'save_review has the agreed server RPC signature');
select has_function('public', 'acknowledge_reward', array['uuid','uuid'], 'acknowledge_reward has the agreed server RPC signature');
select ok(case when to_regprocedure('public.accept_receipt(uuid,uuid,uuid,jsonb)') is null then true else not has_function_privilege('anon', to_regprocedure('public.accept_receipt(uuid,uuid,uuid,jsonb)'), 'execute') end, 'anon cannot execute receipt progression');
select ok(case when to_regprocedure('public.accept_receipt(uuid,uuid,uuid,jsonb)') is null then true else not has_function_privilege('authenticated', to_regprocedure('public.accept_receipt(uuid,uuid,uuid,jsonb)'), 'execute') end, 'authenticated cannot execute receipt progression');
select ok(case when to_regprocedure('public.accept_receipt(uuid,uuid,uuid,jsonb)') is null then false else has_function_privilege('service_role', to_regprocedure('public.accept_receipt(uuid,uuid,uuid,jsonb)'), 'execute') end, 'service_role can execute receipt progression');
select ok(case when to_regprocedure('public.save_review(uuid,uuid,numeric,text)') is null then true else not has_function_privilege('anon', to_regprocedure('public.save_review(uuid,uuid,numeric,text)'), 'execute') end, 'anon cannot execute review awards');
select ok(case when to_regprocedure('public.save_review(uuid,uuid,numeric,text)') is null then true else not has_function_privilege('authenticated', to_regprocedure('public.save_review(uuid,uuid,numeric,text)'), 'execute') end, 'authenticated cannot execute review awards');
select ok(case when to_regprocedure('public.save_review(uuid,uuid,numeric,text)') is null then false else has_function_privilege('service_role', to_regprocedure('public.save_review(uuid,uuid,numeric,text)'), 'execute') end, 'service_role can execute review awards');
select ok(case when to_regprocedure('public.acknowledge_reward(uuid,uuid)') is null then true else not has_function_privilege('authenticated', to_regprocedure('public.acknowledge_reward(uuid,uuid)'), 'execute') end, 'authenticated cannot acknowledge rewards directly');
select ok(case when to_regprocedure('public.acknowledge_reward(uuid,uuid)') is null then false else has_function_privilege('service_role', to_regprocedure('public.acknowledge_reward(uuid,uuid)'), 'execute') end, 'service_role can acknowledge rewards');

insert into auth.users (id, aud, role, email, email_confirmed_at, raw_app_meta_data, raw_user_meta_data)
values
 ('a0000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'progression-test-a@example.test', now(), '{}'::jsonb, '{}'::jsonb),
 ('a0000000-0000-4000-8000-000000000002', 'authenticated', 'authenticated', 'progression-test-b@example.test', now(), '{}'::jsonb, '{}'::jsonb);

insert into public.receipts (id,user_id,restaurant_id,receipt_date,total_minor,currency,image_path,image_hash,status)
values
 ('a1000000-0000-4000-8000-000000000001','a0000000-0000-4000-8000-000000000001',null,null,null,null,'a0000000-0000-4000-8000-000000000001/a1.jpg',repeat('a',64),'draft'),
 ('a1000000-0000-4000-8000-000000000002','a0000000-0000-4000-8000-000000000002',null,null,null,null,'a0000000-0000-4000-8000-000000000002/a2.jpg',repeat('a',64),'draft'),
 ('a1000000-0000-4000-8000-000000000003','a0000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','2026-01-01',1425,'USD','a0000000-0000-4000-8000-000000000001/a3.jpg',repeat('b',64),'draft'),
 ('a1000000-0000-4000-8000-000000000004','a0000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','2026-01-01',1425,'USD','a0000000-0000-4000-8000-000000000001/a4.jpg',repeat('c',64),'draft'),
 ('a1000000-0000-4000-8000-000000000005','a0000000-0000-4000-8000-000000000001',null,null,null,null,'a0000000-0000-4000-8000-000000000001/a5.jpg',null,'draft'),
 ('a1000000-0000-4000-8000-000000000006','a0000000-0000-4000-8000-000000000001',null,null,null,null,'a0000000-0000-4000-8000-000000000001/a6.jpg',repeat('d',64),'draft'),
 ('a1000000-0000-4000-8000-000000000007','a0000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000002','2026-01-01',1425,'USD','a0000000-0000-4000-8000-000000000001/a7.jpg',repeat('e',64),'draft'),
 ('a1000000-0000-4000-8000-000000000008','a0000000-0000-4000-8000-000000000002',null,null,null,null,'a0000000-0000-4000-8000-000000000002/a8.jpg',repeat('f',64),'draft');

create temporary table progression_test_results (result_key text primary key, result jsonb);
create temporary table review_test_results (result_key text primary key, result jsonb);

select lives_ok($accept$
  select public.accept_receipt(
    'a0000000-0000-4000-8000-000000000001', 'a1000000-0000-4000-8000-000000000001',
    'a2000000-0000-4000-8000-000000000001',
    '{"draftId":"a1000000-0000-4000-8000-000000000001","submissionId":"a2000000-0000-4000-8000-000000000001","restaurantId":"10000000-0000-4000-8000-000000000001","receiptDate":"2026-01-01","receiptNumber":null,"totalMinor":1425,"currency":"USD","items":[{"originalText":"LATTE","confirmedName":"Latte","quantity":1,"menuItemId":"20000000-0000-4000-8000-000000000001"}]}'::jsonb
  )
$accept$, 'a first receipt is accepted');
do $capture$
begin
  insert into progression_test_results values ('first', public.accept_receipt(
    'a0000000-0000-4000-8000-000000000001', 'a1000000-0000-4000-8000-000000000001',
    'a2000000-0000-4000-8000-000000000001',
    '{"draftId":"a1000000-0000-4000-8000-000000000001","submissionId":"a2000000-0000-4000-8000-000000000001","restaurantId":"10000000-0000-4000-8000-000000000001","receiptDate":"2026-01-01","receiptNumber":null,"totalMinor":1425,"currency":"USD","items":[{"originalText":"LATTE","confirmedName":"Latte","quantity":1,"menuItemId":"20000000-0000-4000-8000-000000000001"}]}'::jsonb
  ));
exception when undefined_function then
  insert into progression_test_results values ('first', null);
end
$capture$;
do $replay$
begin
  insert into progression_test_results values ('replay', public.accept_receipt(
    'a0000000-0000-4000-8000-000000000001', 'a1000000-0000-4000-8000-000000000001',
    'a2000000-0000-4000-8000-000000000001',
    '{"draftId":"a1000000-0000-4000-8000-000000000001","submissionId":"a2000000-0000-4000-8000-000000000001","restaurantId":"10000000-0000-4000-8000-000000000001","receiptDate":"2026-01-01","receiptNumber":null,"totalMinor":1425,"currency":"USD","items":[{"originalText":"LATTE","confirmedName":"Latte","quantity":1,"menuItemId":"20000000-0000-4000-8000-000000000001"}]}'::jsonb
  ));
exception when undefined_function then
  insert into progression_test_results values ('replay', null);
end
$replay$;
select is((select result->'xpBreakdown'->'totalXP' from progression_test_results where result_key='first'), '140'::jsonb, 'the stored first response reports 140 total XP');
select is((select result->'stageAwards' from progression_test_results where result_key='first'), '[{"stage":"discovered","accountXP":100}]'::jsonb, 'the result lists the discovered stage award for reveal recovery');
select is((select result->'xpBreakdown'->'visitXP' from progression_test_results where result_key='first'), '100'::jsonb, 'first distinct visit awards exactly 100 visit XP');
select is((select result->'xpBreakdown'->'purchaseBaseXP' from progression_test_results where result_key='first'), '40'::jsonb, 'one new menu item awards exactly 40 purchase base XP');
select is((select result from progression_test_results where result_key='replay'), (select result from progression_test_results where result_key='first'), 'same receipt and submission replay the exact stored JSON response');
select is((select card_xp from public.cards where user_id='a0000000-0000-4000-8000-000000000001' and restaurant_id='10000000-0000-4000-8000-000000000001'), 140, 'first visit with one new item awards exactly 140 card XP');
select is((select account_xp from public.profiles where id='a0000000-0000-4000-8000-000000000001'), 150, 'first card awards stage XP and First Bite badge XP exactly once');
select is((select count(*)::integer from public.visits where user_id='a0000000-0000-4000-8000-000000000001' and restaurant_id='10000000-0000-4000-8000-000000000001'), 1, 'first receipt creates one distinct-date visit');
select lives_ok($sameday$
  select public.accept_receipt(
    'a0000000-0000-4000-8000-000000000001', 'a1000000-0000-4000-8000-000000000004',
    'a2000000-0000-4000-8000-000000000004',
    '{"draftId":"a1000000-0000-4000-8000-000000000004","submissionId":"a2000000-0000-4000-8000-000000000004","restaurantId":"10000000-0000-4000-8000-000000000001","receiptDate":"2026-01-01","receiptNumber":"second","totalMinor":900,"currency":"USD","items":[{"originalText":"CHICKEN","confirmedName":"Chicken","quantity":1,"menuItemId":"20000000-0000-4000-8000-000000000001"}]}'::jsonb
  )
$sameday$, 'a second distinct receipt for the same restaurant and date is accepted');
select is((select count(*)::integer from public.visits where user_id='a0000000-0000-4000-8000-000000000001' and restaurant_id='10000000-0000-4000-8000-000000000001'), 1, 'same-day receipts do not increase distinct visits');
select is((select card_xp from public.cards where user_id='a0000000-0000-4000-8000-000000000001' and restaurant_id='10000000-0000-4000-8000-000000000001'), 150, 'same-day familiar item still awards 10 purchase XP and no visit XP');
select throws_ok($dupe$
  select public.accept_receipt(
    'a0000000-0000-4000-8000-000000000002', 'a1000000-0000-4000-8000-000000000002',
    'a2000000-0000-4000-8000-000000000002',
    '{"draftId":"a1000000-0000-4000-8000-000000000002","submissionId":"a2000000-0000-4000-8000-000000000002","restaurantId":"10000000-0000-4000-8000-000000000001","receiptDate":"2026-01-01","receiptNumber":null,"totalMinor":1425,"currency":"USD","items":[{"originalText":"LATTE","confirmedName":"Latte","quantity":1,"menuItemId":"20000000-0000-4000-8000-000000000001"}]}'::jsonb
  )
$dupe$, 'P0001', 'DUPLICATE_RECEIPT: receipt appears to have already been submitted', 'a second account cannot reuse the same accepted image hash');
select throws_ok($fingerprint$
  select public.accept_receipt(
    'a0000000-0000-4000-8000-000000000002', 'a1000000-0000-4000-8000-000000000008',
    'a2000000-0000-4000-8000-000000000008',
    '{"draftId":"a1000000-0000-4000-8000-000000000008","submissionId":"a2000000-0000-4000-8000-000000000008","restaurantId":"10000000-0000-4000-8000-000000000001","receiptDate":"2026-01-01","receiptNumber":null,"totalMinor":1425,"currency":"USD","items":[{"originalText":"LATTE","confirmedName":"Latte","quantity":1,"menuItemId":"20000000-0000-4000-8000-000000000001"}]}'::jsonb
  )
$fingerprint$, 'P0001', 'DUPLICATE_RECEIPT: receipt appears to have already been submitted', 'a different image with the same canonical receipt fingerprint is rejected');
select is((select account_xp from public.profiles where id='a0000000-0000-4000-8000-000000000002'), 0, 'fingerprint duplicate rejection rolls back all second-account awards');
select throws_ok($foreign$
  select public.accept_receipt(
    'a0000000-0000-4000-8000-000000000002', 'a1000000-0000-4000-8000-000000000003',
    'a2000000-0000-4000-8000-000000000003',
    '{"draftId":"a1000000-0000-4000-8000-000000000003","submissionId":"a2000000-0000-4000-8000-000000000003","restaurantId":"10000000-0000-4000-8000-000000000001","receiptDate":"2026-01-01","receiptNumber":null,"totalMinor":1425,"currency":"USD","items":[{"originalText":"LATTE","confirmedName":"Latte","quantity":1,"menuItemId":"20000000-0000-4000-8000-000000000001"}]}'::jsonb
  )
$foreign$, 'P0001', 'FORBIDDEN: receipt draft not found', 'foreign draft ownership is rejected without leaking draft details');
select is((select restaurant_id from public.receipts where id='a1000000-0000-4000-8000-000000000002'), null::uuid, 'failed cross-account duplicate leaves unresolved draft fields untouched');
select throws_ok($nohash$
  select public.accept_receipt(
    'a0000000-0000-4000-8000-000000000001', 'a1000000-0000-4000-8000-000000000005',
    'a2000000-0000-4000-8000-000000000005',
    '{"draftId":"a1000000-0000-4000-8000-000000000005","submissionId":"a2000000-0000-4000-8000-000000000005","restaurantId":"10000000-0000-4000-8000-000000000001","receiptDate":"2026-01-01","receiptNumber":null,"totalMinor":1425,"currency":"USD","items":[{"originalText":"CHICKEN","confirmedName":"Chicken","quantity":1,"menuItemId":"20000000-0000-4000-8000-000000000001"}]}'::jsonb
  )
$nohash$, 'P0001', 'INVALID_RECEIPT: receipt image is unavailable', 'drafts without a valid SHA-256 image hash are rejected');
select throws_ok($baditem$
  select public.accept_receipt(
    'a0000000-0000-4000-8000-000000000001', 'a1000000-0000-4000-8000-000000000006',
    'a2000000-0000-4000-8000-000000000006',
    '{"draftId":"a1000000-0000-4000-8000-000000000006","submissionId":"a2000000-0000-4000-8000-000000000006","restaurantId":"10000000-0000-4000-8000-000000000001","receiptDate":"2026-01-01","receiptNumber":null,"totalMinor":1425,"currency":"USD","items":[{"originalText":"WINGS","confirmedName":"Wings","quantity":1,"menuItemId":"20000000-0000-4000-8000-000000000004"}]}'::jsonb
  )
$baditem$, 'P0001', 'INVALID_RECEIPT: confirmed item is unavailable for this restaurant', 'menu items must belong to the confirmed restaurant');
select lives_ok($corrected$
  select public.accept_receipt(
    'a0000000-0000-4000-8000-000000000001', 'a1000000-0000-4000-8000-000000000007',
    'a2000000-0000-4000-8000-000000000007',
    '{"draftId":"a1000000-0000-4000-8000-000000000007","submissionId":"a2000000-0000-4000-8000-000000000007","restaurantId":"10000000-0000-4000-8000-000000000001","receiptDate":"2026-01-01","receiptNumber":"corrected","totalMinor":1425,"currency":"USD","items":[{"originalText":"CHICKEN","confirmedName":"Chicken","quantity":1,"menuItemId":"20000000-0000-4000-8000-000000000001"}]}'::jsonb
  )
$corrected$, 'a draft restaurant correction is accepted and saved before receipt items');
select is((select restaurant_id from public.receipts where id='a1000000-0000-4000-8000-000000000007'), '10000000-0000-4000-8000-000000000001'::uuid, 'confirmed restaurant replaces the draft suggestion');
select is((select restaurant_id from public.receipt_items where receipt_id='a1000000-0000-4000-8000-000000000007'), '10000000-0000-4000-8000-000000000001'::uuid, 'receipt items reference the corrected confirmed restaurant');
select throws_ok($reused$
  select public.accept_receipt(
    'a0000000-0000-4000-8000-000000000001', 'a1000000-0000-4000-8000-000000000003',
    'a2000000-0000-4000-8000-000000000001',
    '{"draftId":"a1000000-0000-4000-8000-000000000003","submissionId":"a2000000-0000-4000-8000-000000000001","restaurantId":"10000000-0000-4000-8000-000000000001","receiptDate":"2026-01-01","receiptNumber":"reused","totalMinor":1425,"currency":"USD","items":[{"originalText":"CHICKEN","confirmedName":"Chicken","quantity":1,"menuItemId":"20000000-0000-4000-8000-000000000001"}]}'::jsonb
  )
$reused$, 'P0001', 'DUPLICATE_RECEIPT: receipt appears to have already been submitted', 'a submission ID cannot be reused for another receipt');

insert into review_test_results select 'blank', public.save_review('a0000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001',0,'   ');
select is((select result->'review'->>'text' from review_test_results where result_key='blank'), '', 'whitespace-only review text is normalized to empty');
select is((select result->'review'->'rating' from review_test_results where result_key='blank'), '0'::jsonb, 'zero is a valid saved rating');
select is((select result->'newBadges' from review_test_results where result_key='blank'), '[]'::jsonb, 'blank review does not award First Impressions');
insert into review_test_results select 'written', public.save_review('a0000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001',4.5,'A warm neighborhood favorite.');
select is((select result->'review'->'rating' from review_test_results where result_key='written'), '4.5'::jsonb, '4.5 is a valid saved rating');
select is((select result->'newBadges' from review_test_results where result_key='written'), '["first_impressions"]'::jsonb, 'first written review awards First Impressions once');
select is((select account_xp from public.profiles where id='a0000000-0000-4000-8000-000000000001'), 200, 'First Impressions awards exactly 50 account XP');
insert into review_test_results select 'edited', public.save_review('a0000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001',0,'I did not enjoy this meal.');
select is((select result->'newBadges' from review_test_results where result_key='edited'), '[]'::jsonb, 'editing a review with a negative rating awards nothing again');
select is((select account_xp from public.profiles where id='a0000000-0000-4000-8000-000000000001'), 200, 'review edits never increase account XP after the one-time award');
select throws_ok($invalid_rating$
  select public.save_review('a0000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001',4.25,'Invalid precision')
$invalid_rating$, 'P0001', 'INVALID_REQUEST: rating must be between 0 and 5 with at most one decimal place', 'ratings with excess precision are rejected');
select throws_ok($high_rating$
  select public.save_review('a0000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001',5.5,'Too high')
$high_rating$, 'P0001', 'INVALID_REQUEST: rating must be between 0 and 5 with at most one decimal place', 'ratings above five are rejected');
select throws_ok($locked_review$
  select public.save_review('a0000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000002',3,'No card')
$locked_review$, 'P0001', 'FORBIDDEN: restaurant card required', 'reviewing a restaurant without an owned card is rejected');

select ok(public.acknowledge_reward(
  'a0000000-0000-4000-8000-000000000001',
  (select id from public.reward_events where user_id='a0000000-0000-4000-8000-000000000001' and reward_key='10000000-0000-4000-8000-000000000001:discovered')
)->>'viewedAt' like '%Z', 'reveal acknowledgement returns a UTC ISO timestamp');
select is(public.acknowledge_reward(
  'a0000000-0000-4000-8000-000000000001',
  (select id from public.reward_events where user_id='a0000000-0000-4000-8000-000000000001' and reward_key='10000000-0000-4000-8000-000000000001:discovered')
)->>'viewedAt', (select to_char(viewed_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') from public.reward_events where user_id='a0000000-0000-4000-8000-000000000001' and reward_key='10000000-0000-4000-8000-000000000001:discovered'), 'acknowledging an already viewed reveal preserves its first timestamp');
select throws_ok($wrong_event$
  select public.acknowledge_reward('a0000000-0000-4000-8000-000000000002',
    (select id from public.reward_events where user_id='a0000000-0000-4000-8000-000000000001' and reward_key='10000000-0000-4000-8000-000000000001:discovered'))
$wrong_event$, 'P0001', 'NOT_FOUND: reward event not found', 'another user cannot acknowledge a reward');

select * from finish();
rollback;
