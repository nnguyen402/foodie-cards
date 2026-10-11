begin;
set local search_path = public, extensions, pg_catalog;
select plan(8);
insert into auth.users (id,aud,role,email,email_confirmed_at,raw_app_meta_data,raw_user_meta_data)
values ('a6000000-0000-4000-8000-000000000001','authenticated','authenticated','decimal-qa@example.test',now(),'{}','{}');
insert into public.cards (user_id,restaurant_id) values ('a6000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001');
select lives_ok($sql$ select public.save_review('a6000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001',4.3,'Decimal review') $sql$, '4.3-star reviews save through the real RPC');
select is((select rating from public.reviews where user_id='a6000000-0000-4000-8000-000000000001'),4.3::numeric,'decimal rating persists without rounding');
create temporary table decimal_reward_before as select account_xp from public.profiles where id='a6000000-0000-4000-8000-000000000001';
select lives_ok($sql$ select public.save_review('a6000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001',0.1,'Edited review') $sql$, 'tenths are accepted throughout the range');
select is((select account_xp from public.profiles where id='a6000000-0000-4000-8000-000000000001'),(select account_xp from decimal_reward_before),'editing decimal ratings does not repeat the review reward');
select throws_ok($sql$ select public.save_review('a6000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001',4.35,'Invalid') $sql$,'P0001','INVALID_REQUEST: rating must be between 0 and 5 with at most one decimal place','excess precision is rejected before storage can round it');
select throws_ok($sql$ select public.save_review('a6000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001',5.1,'Invalid') $sql$,'P0001','INVALID_REQUEST: rating must be between 0 and 5 with at most one decimal place','out-of-range ratings are rejected');
select throws_ok($sql$ insert into public.reviews (user_id,restaurant_id,card_id,rating,text) select user_id,restaurant_id,id,5.1,'' from public.cards where user_id='a6000000-0000-4000-8000-000000000001' on conflict (user_id,restaurant_id) do update set rating=excluded.rating $sql$,'23514',null,'table constraint also rejects out-of-range ratings');
select ok(not has_function_privilege('authenticated','public.save_review(uuid,uuid,numeric,text)','execute'),'review RPC permissions remain restricted');
select * from finish();
rollback;
