-- Real RPC boundary tests. Synthetic users/catalog/history are transaction-local fixtures.
begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions, pg_catalog;
select plan(60);

insert into auth.users (id,aud,role,email,email_confirmed_at,raw_app_meta_data,raw_user_meta_data)
values
 ('d0000000-0000-4000-8000-000000000001','authenticated','authenticated','pb-score@test.invalid',now(),'{}','{}'),
 ('d0000000-0000-4000-8000-000000000002','authenticated','authenticated','pb-mult@test.invalid',now(),'{}','{}'),
 ('d0000000-0000-4000-8000-000000000003','authenticated','authenticated','pb-stage@test.invalid',now(),'{}','{}'),
 ('d0000000-0000-4000-8000-000000000004','authenticated','authenticated','pb-fp-a@test.invalid',now(),'{}','{}'),
 ('d0000000-0000-4000-8000-000000000005','authenticated','authenticated','pb-fp-b@test.invalid',now(),'{}','{}'),
 ('d0000000-0000-4000-8000-000000000006','authenticated','authenticated','pb-review@test.invalid',now(),'{}','{}'),
 ('d0000000-0000-4000-8000-000000000007','authenticated','authenticated','pb-thresholds@test.invalid',now(),'{}','{}');

-- Seed exact pre-gate XP, visit dates, and already-owned dishes.
insert into public.cards(id,user_id,restaurant_id,card_xp,stage,visit_count,last_visit_date) values
 ('e0000000-0000-4000-8000-000000000001','d0000000-0000-4000-8000-000000000003','10000000-0000-4000-8000-000000000001',290,'discovered',2,'2026-01-02'),
 ('e0000000-0000-4000-8000-000000000002','d0000000-0000-4000-8000-000000000003','10000000-0000-4000-8000-000000000002',240,'discovered',2,'2026-02-02'),
 ('e0000000-0000-4000-8000-000000000003','d0000000-0000-4000-8000-000000000003','10000000-0000-4000-8000-000000000003',689,'discovered',5,'2026-03-05'),
 ('e0000000-0000-4000-8000-000000000004','d0000000-0000-4000-8000-000000000006','10000000-0000-4000-8000-000000000001',0,'discovered',0,null),
 ('e0000000-0000-4000-8000-000000000005','d0000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000004',0,'discovered',3,'2026-04-03');
insert into public.visits(user_id,restaurant_id,card_id,visit_date) values
 ('d0000000-0000-4000-8000-000000000003','10000000-0000-4000-8000-000000000001','e0000000-0000-4000-8000-000000000001','2026-01-01'),
 ('d0000000-0000-4000-8000-000000000003','10000000-0000-4000-8000-000000000001','e0000000-0000-4000-8000-000000000001','2026-01-02'),
 ('d0000000-0000-4000-8000-000000000003','10000000-0000-4000-8000-000000000002','e0000000-0000-4000-8000-000000000002','2026-02-01'),
 ('d0000000-0000-4000-8000-000000000003','10000000-0000-4000-8000-000000000002','e0000000-0000-4000-8000-000000000002','2026-02-02'),
 ('d0000000-0000-4000-8000-000000000003','10000000-0000-4000-8000-000000000003','e0000000-0000-4000-8000-000000000003','2026-03-01'),
 ('d0000000-0000-4000-8000-000000000003','10000000-0000-4000-8000-000000000003','e0000000-0000-4000-8000-000000000003','2026-03-02'),
 ('d0000000-0000-4000-8000-000000000003','10000000-0000-4000-8000-000000000003','e0000000-0000-4000-8000-000000000003','2026-03-03'),
 ('d0000000-0000-4000-8000-000000000003','10000000-0000-4000-8000-000000000003','e0000000-0000-4000-8000-000000000003','2026-03-04'),
 ('d0000000-0000-4000-8000-000000000003','10000000-0000-4000-8000-000000000003','e0000000-0000-4000-8000-000000000003','2026-03-05'),
 ('d0000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000004','e0000000-0000-4000-8000-000000000005','2026-04-01'),
 ('d0000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000004','e0000000-0000-4000-8000-000000000005','2026-04-02'),
 ('d0000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000004','e0000000-0000-4000-8000-000000000005','2026-04-03');
insert into public.user_items(user_id,restaurant_id,card_id,menu_item_id,first_purchase_date) values
 ('d0000000-0000-4000-8000-000000000003','10000000-0000-4000-8000-000000000001','e0000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','2026-01-01'),
 ('d0000000-0000-4000-8000-000000000003','10000000-0000-4000-8000-000000000002','e0000000-0000-4000-8000-000000000002','20000000-0000-4000-8000-000000000004','2026-02-01'),
 ('d0000000-0000-4000-8000-000000000003','10000000-0000-4000-8000-000000000003','e0000000-0000-4000-8000-000000000003','20000000-0000-4000-8000-000000000007','2026-03-01'),
 ('d0000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000004','e0000000-0000-4000-8000-000000000005','20000000-0000-4000-8000-000000000010','2026-04-01');

-- SQL-only threshold fixtures are synthetic and rolled back with this file.
insert into public.restaurants(id,slug,name,location_label,category)
select ('30000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,
       'boundary-restaurant-'||lpad(n::text,2,'0'),'Synthetic boundary restaurant '||n,'SQL test fixture',
       case when n<=3 then 'cafe' else 'restaurant' end
from generate_series(1,50) n;
update public.profiles set account_xp=400 where id='d0000000-0000-4000-8000-000000000007';
insert into public.cards(id,user_id,restaurant_id,card_xp,stage,visit_count,last_visit_date)
select ('40000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,'d0000000-0000-4000-8000-000000000007',
       ('30000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,
       case when n=1 then 750 else 0 end,case when n=1 then 'house_favorite' else 'discovered' end,
       case when n=1 then 6 else 0 end,case when n=1 then '2026-05-06'::date else null end
from generate_series(1,50) n;
insert into public.menu_items(id,restaurant_id,canonical_name)
select ('50000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,
       ('30000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,'Synthetic item '||n
from generate_series(1,10) n;
insert into public.user_items(user_id,restaurant_id,card_id,menu_item_id,first_purchase_date)
select 'd0000000-0000-4000-8000-000000000007',
       ('30000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,
       ('40000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,
       ('50000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,'2026-05-01'
from generate_series(1,10) n;
insert into public.reviews(user_id,restaurant_id,card_id,rating,text)
select 'd0000000-0000-4000-8000-000000000007',
       ('30000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,
       ('40000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,null,'Seed review '||n
from generate_series(1,9) n;

insert into public.receipts(id,user_id,image_path,image_hash,status) values
 ('f0000000-0000-4000-8000-000000000001','d0000000-0000-4000-8000-000000000001','d0000000-0000-4000-8000-000000000001/q.jpg',repeat('1',64),'draft'),
 ('f0000000-0000-4000-8000-000000000002','d0000000-0000-4000-8000-000000000002','d0000000-0000-4000-8000-000000000002/m.jpg',repeat('2',64),'draft'),
 ('f0000000-0000-4000-8000-000000000003','d0000000-0000-4000-8000-000000000003','d0000000-0000-4000-8000-000000000003/s1.jpg',repeat('3',64),'draft'),
 ('f0000000-0000-4000-8000-000000000004','d0000000-0000-4000-8000-000000000003','d0000000-0000-4000-8000-000000000003/s2.jpg',repeat('4',64),'draft'),
 ('f0000000-0000-4000-8000-000000000005','d0000000-0000-4000-8000-000000000003','d0000000-0000-4000-8000-000000000003/s3.jpg',repeat('5',64),'draft'),
 ('f0000000-0000-4000-8000-000000000006','d0000000-0000-4000-8000-000000000004','d0000000-0000-4000-8000-000000000004/f1.jpg',repeat('6',64),'draft'),
 ('f0000000-0000-4000-8000-000000000007','d0000000-0000-4000-8000-000000000005','d0000000-0000-4000-8000-000000000005/f2.jpg',repeat('7',64),'draft'),
 ('f0000000-0000-4000-8000-000000000008','d0000000-0000-4000-8000-000000000003','d0000000-0000-4000-8000-000000000003/s1-later.jpg',repeat('8',64),'draft'),
 ('f0000000-0000-4000-8000-000000000009','d0000000-0000-4000-8000-000000000003','d0000000-0000-4000-8000-000000000003/s2-house-favorite.jpg',repeat('9',64),'draft');

create temporary table progression_boundary_results(result_key text primary key,result jsonb);
grant all on progression_boundary_results to service_role;
set local role service_role;

insert into progression_boundary_results values ('quantity',public.accept_receipt(
 'd0000000-0000-4000-8000-000000000001','f0000000-0000-4000-8000-000000000001','f1000000-0000-4000-8000-000000000001',
 '{"draftId":"f0000000-0000-4000-8000-000000000001","submissionId":"f1000000-0000-4000-8000-000000000001","restaurantId":"10000000-0000-4000-8000-000000000001","receiptDate":"2026-06-01","receiptNumber":"qty","totalMinor":2200,"currency":"USD","items":[{"originalText":"CHICKEN A","confirmedName":"Fried chicken","quantity":6,"menuItemId":"20000000-0000-4000-8000-000000000001"},{"originalText":"CHICKEN B","confirmedName":"Fried chicken","quantity":6,"menuItemId":"20000000-0000-4000-8000-000000000001"},{"originalText":"MAC","confirmedName":"Macaroni and cheese","quantity":1,"menuItemId":"20000000-0000-4000-8000-000000000002"}]}'::jsonb));
insert into progression_boundary_results values ('multiplier',public.accept_receipt(
 'd0000000-0000-4000-8000-000000000002','f0000000-0000-4000-8000-000000000002','f1000000-0000-4000-8000-000000000002',
 '{"draftId":"f0000000-0000-4000-8000-000000000002","submissionId":"f1000000-0000-4000-8000-000000000002","restaurantId":"10000000-0000-4000-8000-000000000004","receiptDate":"2026-04-04","receiptNumber":"mult","totalMinor":3000,"currency":"USD","items":[{"originalText":"WINGS","confirmedName":"Smoked wings","quantity":1,"menuItemId":"20000000-0000-4000-8000-000000000010"},{"originalText":"PORK","confirmedName":"Pulled pork sandwich","quantity":1,"menuItemId":"20000000-0000-4000-8000-000000000011"}]}'::jsonb));
insert into progression_boundary_results values ('stage2',public.accept_receipt(
 'd0000000-0000-4000-8000-000000000003','f0000000-0000-4000-8000-000000000003','f1000000-0000-4000-8000-000000000003',
 '{"draftId":"f0000000-0000-4000-8000-000000000003","submissionId":"f1000000-0000-4000-8000-000000000003","restaurantId":"10000000-0000-4000-8000-000000000001","receiptDate":"2026-01-02","receiptNumber":"two","totalMinor":1000,"currency":"USD","items":[{"originalText":"CHICKEN","confirmedName":"Fried chicken","quantity":1,"menuItemId":"20000000-0000-4000-8000-000000000001"}]}'::jsonb));
insert into progression_boundary_results values ('stage2_later_regular',public.accept_receipt(
 'd0000000-0000-4000-8000-000000000003','f0000000-0000-4000-8000-000000000008','f1000000-0000-4000-8000-000000000008',
 '{"draftId":"f0000000-0000-4000-8000-000000000008","submissionId":"f1000000-0000-4000-8000-000000000008","restaurantId":"10000000-0000-4000-8000-000000000001","receiptDate":"2026-01-03","receiptNumber":"later-regular","totalMinor":1050,"currency":"USD","items":[{"originalText":"CHICKEN","confirmedName":"Fried chicken","quantity":1,"menuItemId":"20000000-0000-4000-8000-000000000001"}]}'::jsonb));
insert into progression_boundary_results values ('stage3',public.accept_receipt(
 'd0000000-0000-4000-8000-000000000003','f0000000-0000-4000-8000-000000000004','f1000000-0000-4000-8000-000000000004',
 '{"draftId":"f0000000-0000-4000-8000-000000000004","submissionId":"f1000000-0000-4000-8000-000000000004","restaurantId":"10000000-0000-4000-8000-000000000002","receiptDate":"2026-02-03","receiptNumber":"three","totalMinor":1100,"currency":"USD","items":[{"originalText":"WINGS","confirmedName":"Smoked wings","quantity":1,"menuItemId":"20000000-0000-4000-8000-000000000004"}]}'::jsonb));
update public.cards set card_xp=689,visit_count=5,last_visit_date='2026-02-05'
where id='e0000000-0000-4000-8000-000000000002';
insert into public.visits(user_id,restaurant_id,card_id,visit_date) values
 ('d0000000-0000-4000-8000-000000000003','10000000-0000-4000-8000-000000000002','e0000000-0000-4000-8000-000000000002','2026-02-04'),
 ('d0000000-0000-4000-8000-000000000003','10000000-0000-4000-8000-000000000002','e0000000-0000-4000-8000-000000000002','2026-02-05');
insert into progression_boundary_results values ('stage3_house_favorite',public.accept_receipt(
 'd0000000-0000-4000-8000-000000000003','f0000000-0000-4000-8000-000000000009','f1000000-0000-4000-8000-000000000009',
 '{"draftId":"f0000000-0000-4000-8000-000000000009","submissionId":"f1000000-0000-4000-8000-000000000009","restaurantId":"10000000-0000-4000-8000-000000000002","receiptDate":"2026-02-06","receiptNumber":"house-favorite","totalMinor":1200,"currency":"USD","items":[{"originalText":"WINGS","confirmedName":"Smoked wings","quantity":1,"menuItemId":"20000000-0000-4000-8000-000000000004"}]}'::jsonb));
insert into progression_boundary_results values ('stage6',public.accept_receipt(
 'd0000000-0000-4000-8000-000000000003','f0000000-0000-4000-8000-000000000005','f1000000-0000-4000-8000-000000000005',
 '{"draftId":"f0000000-0000-4000-8000-000000000005","submissionId":"f1000000-0000-4000-8000-000000000005","restaurantId":"10000000-0000-4000-8000-000000000003","receiptDate":"2026-03-06","receiptNumber":"six","totalMinor":1200,"currency":"USD","items":[{"originalText":"DUMPLINGS","confirmedName":"Chicken and dumplings","quantity":1,"menuItemId":"20000000-0000-4000-8000-000000000007"}]}'::jsonb));
insert into progression_boundary_results values ('stage6_replay',public.accept_receipt(
 'd0000000-0000-4000-8000-000000000003','f0000000-0000-4000-8000-000000000005','f1000000-0000-4000-8000-000000000005',
 '{"draftId":"f0000000-0000-4000-8000-000000000005","submissionId":"f1000000-0000-4000-8000-000000000005","restaurantId":"10000000-0000-4000-8000-000000000003","receiptDate":"2026-03-06","receiptNumber":"six","totalMinor":1200,"currency":"USD","items":[{"originalText":"DUMPLINGS","confirmedName":"Chicken and dumplings","quantity":1,"menuItemId":"20000000-0000-4000-8000-000000000007"}]}'::jsonb));
insert into progression_boundary_results values ('fingerprint',public.accept_receipt(
 'd0000000-0000-4000-8000-000000000004','f0000000-0000-4000-8000-000000000006','f1000000-0000-4000-8000-000000000006',
 '{"draftId":"f0000000-0000-4000-8000-000000000006","submissionId":"f1000000-0000-4000-8000-000000000006","restaurantId":"10000000-0000-4000-8000-000000000005","receiptDate":"2026-07-01","receiptNumber":"fp-only","totalMinor":4500,"currency":"USD","items":[{"originalText":"PIZZA","confirmedName":"Margherita pizza","quantity":2,"menuItemId":"20000000-0000-4000-8000-000000000013"}]}'::jsonb));
select throws_ok($fp$
 select public.accept_receipt(
  'd0000000-0000-4000-8000-000000000005','f0000000-0000-4000-8000-000000000007','f1000000-0000-4000-8000-000000000007',
  '{"draftId":"f0000000-0000-4000-8000-000000000007","submissionId":"f1000000-0000-4000-8000-000000000007","restaurantId":"10000000-0000-4000-8000-000000000005","receiptDate":"2026-07-01","receiptNumber":"fp-only","totalMinor":4500,"currency":"USD","items":[{"originalText":"MARINARA","confirmedName":"Margherita pizza","quantity":2,"menuItemId":"20000000-0000-4000-8000-000000000013"}]}'::jsonb)
$fp$,'P0001','DUPLICATE_RECEIPT: receipt appears to have already been submitted','fingerprint catches same receipt when image hashes differ');
reset role;

select is((select result->'xpBreakdown'->'purchaseBaseXP' from progression_boundary_results where result_key='quantity'),'90'::jsonb,'duplicate quantities merge before the receipt-wide unit cap');
select is((select result->'xpBreakdown'->'totalXP' from progression_boundary_results where result_key='quantity'),'190'::jsonb,'purchase XP caps additional units at ten before adding first-visit XP');
select is((select quantity from public.receipt_items where receipt_id='f0000000-0000-4000-8000-000000000001' and menu_item_id='20000000-0000-4000-8000-000000000001'),12,'merged duplicate quantity is persisted');
select is((select result->'xpBreakdown'->'multiplier' from progression_boundary_results where result_key='multiplier'),'1.1'::jsonb,'fourth distinct visit uses the 1.1 purchase multiplier');
select is((select result->'xpBreakdown'->'totalXP' from progression_boundary_results where result_key='multiplier'),'105'::jsonb,'three prior visits with familiar and new dishes earn 105 XP');
select is((select result->>'cardXP' from progression_boundary_results where result_key='stage2'),'300','300 XP at two visits reaches the XP gate only');
select is((select result->>'stage' from progression_boundary_results where result_key='stage2'),'discovered','300 XP with two visits remains Discovered');
select is((select result->>'stage' from progression_boundary_results where result_key='stage2_later_regular'),'regular','a later third visit unlocks Regular after the earlier Discovered event');
select is((select viewed_at from public.reward_events where receipt_id='f0000000-0000-4000-8000-000000000003' and payload->>'stage'='discovered'),null,'a later receipt leaves the earlier unacknowledged Discovered event pending');
select is((select count(*)::integer from public.reward_events where receipt_id in ('f0000000-0000-4000-8000-000000000003','f0000000-0000-4000-8000-000000000008') and event_type='card_stage' and viewed_at is null),2,'pending recovery retains the earlier Discovered and later Regular events');
select is((select result->>'cardXP' from progression_boundary_results where result_key='stage3'),'300','300 XP and three visits fixture lands exactly on 300');
select is((select result->>'stage' from progression_boundary_results where result_key='stage3'),'regular','300 XP and three visit dates unlock Regular');
select is((select result->'stageAwards' from progression_boundary_results where result_key='stage3'),'[{"stage":"discovered","accountXP":100},{"stage":"regular","accountXP":150}]'::jsonb,'Regular summary lists all newly earned stage rewards in order');
select is((select result->>'stage' from progression_boundary_results where result_key='stage3_house_favorite'),'house_favorite','sixth same-restaurant visit reaches House Favorite');
select is((select result->'stageAwards' from progression_boundary_results where result_key='stage3_house_favorite'),'[{"stage":"house_favorite","accountXP":300}]'::jsonb,'House Favorite summary returns its newly earned award');
select is((select viewed_at from public.reward_events where id=((select result->>'revealEventId' from progression_boundary_results where result_key='stage3')::uuid)),null,'later House Favorite leaves the earlier Regular reveal recoverable');
select is((select count(*)::integer from public.reward_events where receipt_id in ('f0000000-0000-4000-8000-000000000004','f0000000-0000-4000-8000-000000000009') and event_type='card_stage' and viewed_at is null),2,'pending recovery keeps both same-card acceptance reveals');
select is((select result->>'stage' from progression_boundary_results where result_key='stage3'),'regular','stored earlier acceptance result remains the Regular reveal');
select is((select result->>'cardXP' from progression_boundary_results where result_key='stage6'),'750','750 XP and six visits fixture lands exactly on 750');
select is((select result->>'stage' from progression_boundary_results where result_key='stage6'),'house_favorite','750 XP and six visit dates unlock House Favorite');
select is((select result->'stageAwards' from progression_boundary_results where result_key='stage6'),'[{"stage":"discovered","accountXP":100},{"stage":"regular","accountXP":150},{"stage":"house_favorite","accountXP":300}]'::jsonb,'one receipt returns every newly earned stage award');
select is((select result->'stageAwards' from progression_boundary_results where result_key='stage6_replay'),(select result->'stageAwards' from progression_boundary_results where result_key='stage6'),'replay preserves the stored multi-stage summary');
select is((select count(*)::integer from public.reward_events where receipt_id='f0000000-0000-4000-8000-000000000005' and event_type='card_stage'),3,'all three stage rewards are persisted once');
select is((select count(*)::integer from public.reward_events where receipt_id='f0000000-0000-4000-8000-000000000005' and event_type='card_stage' and viewed_at is null),1,'only the highest-stage reveal remains pending');
select is((select payload->>'stage' from public.reward_events where id=((select result->>'revealEventId' from progression_boundary_results where result_key='stage6'))::uuid),'house_favorite','pending reveal points to the highest stage');
select is((select payload->'stageAwards' from public.reward_events where id=((select result->>'revealEventId' from progression_boundary_results where result_key='stage6'))::uuid),(select result->'stageAwards' from progression_boundary_results where result_key='stage6'),'pending event carries the complete award summary');
select is((select result->>'accountXP' from progression_boundary_results where result_key='stage6'),'1450','stage and eligible first-time badge awards apply once');
select is((select status from public.receipts where id='f0000000-0000-4000-8000-000000000007'),'draft','fingerprint failure rolls back receipt acceptance');
select is((select account_xp from public.profiles where id='d0000000-0000-4000-8000-000000000005'),0,'fingerprint failure rolls back account rewards');
select is((select count(*)::integer from public.cards where user_id='d0000000-0000-4000-8000-000000000005'),0,'fingerprint failure rolls back card creation');

set local role service_role;
insert into progression_boundary_results values ('blank_review',public.save_review('d0000000-0000-4000-8000-000000000006','10000000-0000-4000-8000-000000000001',0,'   '));
insert into progression_boundary_results values ('whitespace_review',public.save_review('d0000000-0000-4000-8000-000000000006','10000000-0000-4000-8000-000000000001',null,E'\t\n'));
insert into progression_boundary_results values ('written_review',public.save_review('d0000000-0000-4000-8000-000000000006','10000000-0000-4000-8000-000000000001',null,'This meal was not good'));
insert into progression_boundary_results values ('edited_review',public.save_review('d0000000-0000-4000-8000-000000000006','10000000-0000-4000-8000-000000000001',4.5,'Updated positive review'));
reset role;
select is((select result->'review'->>'rating' from progression_boundary_results where result_key='blank_review'),'0.0','zero-star rating remains distinct from unrated');
select is((select result->'review'->>'text' from progression_boundary_results where result_key='blank_review'),'','whitespace-only text is stored as blank');
select ok(not ((select result->'newBadges' from progression_boundary_results where result_key='blank_review') @> '["first_impressions"]'::jsonb),'stars alone and blank text do not earn a review badge');
select is((select result->'review'->>'text' from progression_boundary_results where result_key='whitespace_review'),'','tab/newline-only text normalizes to blank');
select ok(not ((select result->'newBadges' from progression_boundary_results where result_key='whitespace_review') @> '["first_impressions"]'::jsonb),'tab/newline-only text earns no review badge');
select is((select result->'review'->>'rating' from progression_boundary_results where result_key='written_review'),null,'null remains the stored unrated value');
select is((select result->'review'->>'text' from progression_boundary_results where result_key='written_review'),'This meal was not good','negative written text receives writing recognition');
select is((select count(*)::integer from public.badge_awards where user_id='d0000000-0000-4000-8000-000000000006' and badge_key='first_impressions'),1,'first written review awards First Impressions exactly once');
select is((select account_xp from public.profiles where id='d0000000-0000-4000-8000-000000000006'),100,'first-card and first-written-review badges each award 50 XP');
select is((select jsonb_array_length(result->'newBadges') from progression_boundary_results where result_key='edited_review'),0,'review edit does not award another badge');
select is((select result->'review'->>'rating' from progression_boundary_results where result_key='edited_review'),'4.5','positive half-star rating remains valid on review edit');
select is((select account_xp from public.profiles where id='d0000000-0000-4000-8000-000000000006'),100,'review edit does not award duplicate XP');

set local role service_role;
insert into progression_boundary_results values ('reviews10',public.save_review('d0000000-0000-4000-8000-000000000007','30000000-0000-4000-8000-000000000010',null,'Review ten'));
insert into progression_boundary_results values ('reviews10_edit',public.save_review('d0000000-0000-4000-8000-000000000007','30000000-0000-4000-8000-000000000010',null,'Edited review ten'));
reset role;
select is((select result->'newBadges' from progression_boundary_results where result_key='reviews10'),'["cafe_crawler","first_bite","first_impressions","food_critic","loyal_regular","menu_explorer"]'::jsonb,'ten written reviews unlock each then-eligible badge');
select is((select result->>'accountXP' from progression_boundary_results where result_key='reviews10'),'700','six first-time badges grant 300 account XP');
select is((select result->>'accountLevel' from progression_boundary_results where result_key='reviews10'),'4','titles see the level after badge XP');
select is((select result->'newTitles' from progression_boundary_results where result_key='reviews10'),'["cafe_crawler","food_critic","loyal_regular","mega_food_crawler","menu_explorer"]'::jsonb,'eligible badge titles and twenty-card title unlock');
select is((select jsonb_array_length(result->'newBadges') from progression_boundary_results where result_key='reviews10_edit'),0,'editing the tenth review does not award badges again');

insert into public.reviews(user_id,restaurant_id,card_id,rating,text)
select 'd0000000-0000-4000-8000-000000000007',
       ('30000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,
       ('40000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,null,'Seed review '||n
from generate_series(11,24) n;
set local role service_role;
insert into progression_boundary_results values ('reviews25',public.save_review('d0000000-0000-4000-8000-000000000007','30000000-0000-4000-8000-000000000025',null,'Review twenty-five'));
reset role;
select is((select result->'newBadges' from progression_boundary_results where result_key='reviews25'),'["seasoned_reviewer"]'::jsonb,'twenty-fifth written review unlocks Seasoned Reviewer once');
select is((select result->>'accountXP' from progression_boundary_results where result_key='reviews25'),'750','twenty-fifth review adds one 50-XP award');
select is((select result->'newTitles' from progression_boundary_results where result_key='reviews25'),'["seasoned_reviewer"]'::jsonb,'Seasoned Reviewer title follows its badge');

insert into public.reviews(user_id,restaurant_id,card_id,rating,text)
select 'd0000000-0000-4000-8000-000000000007',
       ('30000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,
       ('40000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,null,'Seed review '||n
from generate_series(26,49) n;
set local role service_role;
insert into progression_boundary_results values ('reviews50',public.save_review('d0000000-0000-4000-8000-000000000007','30000000-0000-4000-8000-000000000050',null,'Review fifty'));

reset role;
select is((select result->'newBadges' from progression_boundary_results where result_key='reviews50'),'["critics_club"]'::jsonb,'fiftieth written review unlocks Critics Club once');
select is((select result->>'accountXP' from progression_boundary_results where result_key='reviews50'),'800','fiftieth review reaches 800 account XP');
select is((select result->>'accountLevel' from progression_boundary_results where result_key='reviews50'),'5','800 account XP reaches level five');
select is((select result->'newTitles' from progression_boundary_results where result_key='reviews50'),'["critics_club","ultra_foodie"]'::jsonb,'Critics Club and level-five titles unlock after awards');
select is((select count(*)::integer from public.badge_awards where user_id='d0000000-0000-4000-8000-000000000007'),8,'all eight badges are awarded exactly once');
select is((select count(*)::integer from public.title_unlocks where user_id='d0000000-0000-4000-8000-000000000007'),8,'all eight titles are unlocked');
select is((select count(*)::integer from public.user_items where user_id='d0000000-0000-4000-8000-000000000007'),10,'Menu Explorer fixture covers ten restaurant/item combinations');
select is((select count(distinct c.restaurant_id)::integer from public.cards c join public.restaurants r on r.id=c.restaurant_id where c.user_id='d0000000-0000-4000-8000-000000000007' and r.category='cafe'),3,'CafÃ© Crawler uses three synthetic cafe locations');
select is((select count(*)::integer from public.reviews where user_id='d0000000-0000-4000-8000-000000000007' and length(btrim(text))>0),50,'review thresholds count fifty distinct written reviews');

select * from finish();
rollback;
