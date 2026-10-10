begin;

select plan(19);

-- Two real auth rows exercise the signup trigger and the same role/claims used by PostgREST.
insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
  created_at, updated_at, raw_app_meta_data, raw_user_meta_data
) values
  ('11111111-1111-4111-8111-111111111111', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'alice@example.test', '', now(), now(), now(), '{}', '{}'),
  ('22222222-2222-4222-8222-222222222222', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'bob@example.test', '', now(), now(), now(), '{}', '{}');

insert into public.cards (id, user_id, restaurant_id)
values
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '11111111-1111-4111-8111-111111111111', '10000000-0000-4000-8000-000000000001'),
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2', '22222222-2222-4222-8222-222222222222', '10000000-0000-4000-8000-000000000001');

insert into public.receipts (
  id, user_id, restaurant_id, receipt_date, total_minor, currency,
  image_path, image_hash, fingerprint, status
) values (
  'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', '11111111-1111-4111-8111-111111111111',
  '10000000-0000-4000-8000-000000000001', current_date, 1200, 'USD',
  '11111111-1111-4111-8111-111111111111/receipt.jpg', repeat('a', 64), repeat('b', 64), 'accepted'
);
insert into storage.objects (bucket_id, name)
values ('receipts', '11111111-1111-4111-8111-111111111111/receipt.jpg');

select is((select account_xp from public.profiles where id = '11111111-1111-4111-8111-111111111111'), 0, 'signup starts at zero account XP');
select is((select display_name from public.profiles where id = '11111111-1111-4111-8111-111111111111'), 'Foodie', 'signup uses the safe default display name');
select is((select avatar_key from public.profiles where id = '11111111-1111-4111-8111-111111111111'), 'fork', 'signup uses a bundled default avatar');

set local role authenticated;
select set_config('request.jwt.claim.sub', '22222222-2222-4222-8222-222222222222', true);
select set_config('request.jwt.claims', '{"sub":"22222222-2222-4222-8222-222222222222","role":"authenticated"}', true);

select is((select count(*)::integer from public.profiles where id = '11111111-1111-4111-8111-111111111111'), 0, 'a user cannot read another profile');
select is((select count(*)::integer from public.cards where user_id = '11111111-1111-4111-8111-111111111111'), 0, 'a user cannot read another collection');
select is((select count(*)::integer from public.receipts where user_id = '11111111-1111-4111-8111-111111111111'), 0, 'a user cannot read another receipt row');
select is((select count(*)::integer from storage.objects where bucket_id = 'receipts' and name = '11111111-1111-4111-8111-111111111111/receipt.jpg'), 0, 'a user cannot read another receipt image object');
select throws_ok(
  $$insert into storage.objects (bucket_id, name) values ('receipts', '11111111-1111-4111-8111-111111111111/stolen.jpg')$$,
  '42501', null, 'a user cannot upload into another user folder'
);
insert into storage.objects (bucket_id, name)
values ('receipts', '22222222-2222-4222-8222-222222222222/own.jpg');
select is((select count(*)::integer from storage.objects where bucket_id = 'receipts' and name = '22222222-2222-4222-8222-222222222222/own.jpg'), 1, 'a user can upload a receipt into their own folder');
update public.profiles set display_name = 'Alice Example', avatar_key = 'plate'
where id = '22222222-2222-4222-8222-222222222222';
select is((select display_name from public.profiles where id = '22222222-2222-4222-8222-222222222222'), 'Alice Example', 'a user can update their own display name');
select is((select avatar_key from public.profiles where id = '22222222-2222-4222-8222-222222222222'), 'plate', 'a user can update their own bundled avatar');
insert into public.profile_pins (user_id, card_id, slot)
values ('22222222-2222-4222-8222-222222222222', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2', 1);
select is((select count(*)::integer from public.profile_pins where user_id = '22222222-2222-4222-8222-222222222222' and slot = 1), 1, 'a user can pin an owned card');
select throws_ok(
  $$insert into public.profile_pins (user_id, card_id, slot) values ('22222222-2222-4222-8222-222222222222', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2', 1)$$,
  '23505', null, 'a user cannot pin the same card twice or reuse a slot'
);
select throws_ok(
  $$update public.profiles set account_xp = 999 where id = '22222222-2222-4222-8222-222222222222'$$,
  '42501', null, 'clients cannot update account XP'
);
select throws_ok(
  $$update public.profiles set equipped_title_key = 'first_bite' where id = '22222222-2222-4222-8222-222222222222'$$,
  '42501', null, 'clients cannot equip a title directly'
);
select throws_ok(
  $$update public.cards set card_xp = 999, stage = 'house_favorite' where user_id = '22222222-2222-4222-8222-222222222222'$$,
  '42501', null, 'clients cannot write card progression'
);
select throws_ok(
  $$insert into public.profile_pins (user_id, card_id, slot) values ('11111111-1111-4111-8111-111111111111', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 1)$$,
  '42501', null, 'a user cannot create a pin under another account'
);

reset role;
select throws_ok(
  $$insert into public.profile_pins (user_id, card_id, slot) values ('22222222-2222-4222-8222-222222222222', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 2)$$,
  '23503', null, 'the database rejects a cross-owner card reference'
);
select throws_ok(
  $$insert into public.profile_pins (user_id, card_id, slot) values ('11111111-1111-4111-8111-111111111111', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 4)$$,
  '23514', null, 'pin slots are limited to one through three'
);

select * from finish();
rollback;
