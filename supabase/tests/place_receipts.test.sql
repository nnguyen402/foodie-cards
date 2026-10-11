begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions, pg_catalog;
select plan(16);

insert into auth.users (id,aud,role,email,email_confirmed_at,raw_app_meta_data,raw_user_meta_data)
values ('a3000000-0000-4000-8000-000000000001','authenticated','authenticated','place-test@example.test',now(),'{}','{}');
insert into public.receipts (id,user_id,restaurant_id,receipt_date,total_minor,currency,image_path,image_hash,extraction_draft,status)
values
 ('a4000000-0000-4000-8000-000000000001','a3000000-0000-4000-8000-000000000001',null,null,null,null,'a3000000-0000-4000-8000-000000000001/one.jpg',repeat('1',64),'{"restaurantName":"CHICK-FIL-A #01234"}','draft'),
 ('a4000000-0000-4000-8000-000000000002','a3000000-0000-4000-8000-000000000001',null,null,null,null,'a3000000-0000-4000-8000-000000000001/two.jpg',repeat('2',64),'{"restaurantName":"Chick-fil-A"}','draft'),
 ('a4000000-0000-4000-8000-000000000003','a3000000-0000-4000-8000-000000000001',null,null,null,null,'a3000000-0000-4000-8000-000000000001/three.jpg',repeat('3',64),'{"restaurantName":"Joe Cafe"}','draft'),
 ('a4000000-0000-4000-8000-000000000004','a3000000-0000-4000-8000-000000000001',null,null,null,null,'a3000000-0000-4000-8000-000000000001/four.jpg',repeat('4',64),'{"restaurantName":"Taco Bell"}','draft'),
 ('a4000000-0000-4000-8000-000000000005','a3000000-0000-4000-8000-000000000001',null,null,null,null,'a3000000-0000-4000-8000-000000000001/five.jpg',repeat('5',64),'{"restaurantName":"Cap Cafe"}','draft'),
 ('a4000000-0000-4000-8000-000000000006','a3000000-0000-4000-8000-000000000001',null,null,null,null,'a3000000-0000-4000-8000-000000000001/six.jpg',repeat('6',64),'{"restaurantName":"Taco Bell"}','draft');

create temporary table place_test_results (key text primary key, result jsonb);
insert into place_test_results values ('first', public.accept_place_receipt(
 'a3000000-0000-4000-8000-000000000001','a4000000-0000-4000-8000-000000000001','a5000000-0000-4000-8000-000000000001',
 '{"draftId":"a4000000-0000-4000-8000-000000000001","submissionId":"a5000000-0000-4000-8000-000000000001","place":{"osmType":"node","osmId":910001,"name":"Chick-fil-A","brandKey":"wikidata:Q491516","cuisine":"chicken","latitude":33.76,"longitude":-84.38},"receiptDate":"2026-10-10","receiptNumber":"1","totalMinor":1200,"currency":"USD","items":[{"originalText":"NUGGETS","confirmedName":"8 Count Nuggets","quantity":1}]}'::jsonb));
select is((select count(*)::integer from public.restaurants where brand_key='wikidata:Q491516'),1,'first accepted place creates one brand restaurant');
select is((select count(*)::integer from public.menu_items m join public.restaurants r on r.id=m.restaurant_id where r.brand_key='wikidata:Q491516' and m.canonical_name='8 count nuggets'),1,'confirmed place lines create a fallback menu item');
insert into place_test_results values ('replay', public.accept_place_receipt(
 'a3000000-0000-4000-8000-000000000001','a4000000-0000-4000-8000-000000000001','a5000000-0000-4000-8000-000000000001',
 '{"draftId":"a4000000-0000-4000-8000-000000000001","submissionId":"a5000000-0000-4000-8000-000000000001","place":{"osmType":"node","osmId":910999,"name":"Chick-fil-A","brandKey":"wikidata:Q491516","latitude":0,"longitude":0},"receiptDate":"2026-10-10","receiptNumber":"1","totalMinor":1200,"currency":"USD","items":[{"originalText":"NUGGETS","confirmedName":"different line","quantity":1}]}'::jsonb));
select is((select result from place_test_results where key='replay'),(select result from place_test_results where key='first'),'accepted place submission replays exact result before resolving changed place data');
select is((select count(*)::integer from public.cards c join public.restaurants r on r.id=c.restaurant_id where c.user_id='a3000000-0000-4000-8000-000000000001' and r.brand_key='wikidata:Q491516'),1,'replay does not create a second card');

insert into place_test_results values ('branch',public.accept_place_receipt(
 'a3000000-0000-4000-8000-000000000001','a4000000-0000-4000-8000-000000000002','a5000000-0000-4000-8000-000000000002',
 '{"draftId":"a4000000-0000-4000-8000-000000000002","submissionId":"a5000000-0000-4000-8000-000000000002","place":{"osmType":"node","osmId":910002,"name":"Chick-fil-A","brandKey":"wikidata:Q491516","latitude":33.77,"longitude":-84.39},"receiptDate":"2026-10-11","receiptNumber":"2","totalMinor":900,"currency":"USD","items":[{"originalText":"FRIES","confirmedName":"Waffle Fries","quantity":1}]}'::jsonb));
select is((select count(*)::integer from public.restaurants where brand_key='wikidata:Q491516'),1,'another OSM branch reuses the chain restaurant');
select is((select count(*)::integer from public.cards c join public.restaurants r on r.id=c.restaurant_id where c.user_id='a3000000-0000-4000-8000-000000000001' and r.brand_key='wikidata:Q491516'),1,'another branch updates the same user card');

select throws_ok($mismatch$ select public.accept_place_receipt('a3000000-0000-4000-8000-000000000001','a4000000-0000-4000-8000-000000000004','a5000000-0000-4000-8000-000000000004','{"draftId":"a4000000-0000-4000-8000-000000000004","submissionId":"a5000000-0000-4000-8000-000000000004","place":{"osmType":"node","osmId":910004,"name":"Chick-fil-A","latitude":33,"longitude":-84},"receiptDate":"2026-10-11","receiptNumber":null,"totalMinor":500,"currency":"USD","items":[{"originalText":"TACO","confirmedName":"Taco","quantity":1}]}'::jsonb) $mismatch$,'P0001','INVALID_RECEIPT: receipt does not match chosen place','receipt name mismatch is rejected');
select is((select count(*)::integer from public.restaurants where osm_id=910004),0,'name mismatch creates no restaurant');

insert into public.restaurants (slug,name,location_label,category,brand_key)
values ('brand-spoof-target','Wrong Cafe','Nearby','restaurant','wikidata:Q900001');
select throws_ok($brandspoof$ select public.accept_place_receipt('a3000000-0000-4000-8000-000000000001','a4000000-0000-4000-8000-000000000006','a5000000-0000-4000-8000-000000000006','{"draftId":"a4000000-0000-4000-8000-000000000006","submissionId":"a5000000-0000-4000-8000-000000000006","place":{"osmType":"node","osmId":910006,"name":"Taco Bell","brandKey":"wikidata:Q900001","latitude":33,"longitude":-84},"receiptDate":"2026-10-11","receiptNumber":null,"totalMinor":500,"currency":"USD","items":[{"originalText":"TACO","confirmedName":"Taco","quantity":1}]}'::jsonb) $brandspoof$,'P0001','INVALID_RECEIPT: place brand does not match its restaurant','a submitted brand key cannot attach an unrelated existing restaurant');
select is((select count(*)::integer from public.cards c join public.restaurants r on r.id=c.restaurant_id where c.user_id='a3000000-0000-4000-8000-000000000001' and r.brand_key='wikidata:Q900001'),0,'brand key spoof creates no card on the unrelated restaurant');

select throws_ok($rollback$ select public.accept_place_receipt('a3000000-0000-4000-8000-000000000001','a4000000-0000-4000-8000-000000000003','a5000000-0000-4000-8000-000000000003','{"draftId":"a4000000-0000-4000-8000-000000000003","submissionId":"a5000000-0000-4000-8000-000000000003","place":{"osmType":"way","osmId":910003,"name":"Joe Cafe","latitude":33,"longitude":-84},"receiptDate":"2026-10-11","receiptNumber":null,"totalMinor":500,"currency":"USDX","items":[{"originalText":"CAKE","confirmedName":"Cake","quantity":1}]}'::jsonb) $rollback$,'P0001','INVALID_RECEIPT: confirmation fields are incomplete','invalid receipt data rolls back place and menu inserts');
select is((select count(*)::integer from public.restaurants where osm_id=910003),0,'failed acceptance rolls back restaurant creation');
select is((select count(*)::integer from public.menu_items m join public.restaurants r on r.id=m.restaurant_id where r.osm_id=910003),0,'failed acceptance rolls back generated menu rows');
select ok(not has_function_privilege('authenticated','public.accept_place_receipt(uuid,uuid,uuid,jsonb)','execute') and has_function_privilege('service_role','public.accept_place_receipt(uuid,uuid,uuid,jsonb)','execute'),'place acceptance RPC is service-role only');

insert into public.restaurants (slug,name,location_label,category,source,osm_type,osm_id,created_by)
select 'cap-test-'||n,'Cap test '||n,'Nearby','restaurant','osm','node',920000+n,'a3000000-0000-4000-8000-000000000001'
from generate_series(1,4) n;
select throws_ok($cap$ select public.accept_place_receipt('a3000000-0000-4000-8000-000000000001','a4000000-0000-4000-8000-000000000005','a5000000-0000-4000-8000-000000000005','{"draftId":"a4000000-0000-4000-8000-000000000005","submissionId":"a5000000-0000-4000-8000-000000000005","place":{"osmType":"node","osmId":910005,"name":"Cap Cafe","latitude":33,"longitude":-84},"receiptDate":"2026-10-11","receiptNumber":null,"totalMinor":500,"currency":"USD","items":[{"originalText":"CAKE","confirmedName":"Cake","quantity":1}]}'::jsonb) $cap$,'P0001','RATE_LIMITED: too many new restaurants today','sixth new restaurant in 24 hours is rejected');
select is((select count(*)::integer from public.restaurants where osm_id=910005),0,'daily cap rejection creates no restaurant');

select * from finish();
rollback;
