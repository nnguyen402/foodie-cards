begin;

select plan(5);

insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
  created_at, updated_at, raw_app_meta_data, raw_user_meta_data
) values
  ('11111111-1111-4111-8111-111111111111', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'draft-owner@example.test', '', now(), now(), now(), '{}', '{}'),
  ('22222222-2222-4222-8222-222222222222', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'draft-other@example.test', '', now(), now(), now(), '{}', '{}');

insert into public.receipts (
  id, user_id, restaurant_id, receipt_date, receipt_number, total_minor,
  currency, image_path, extraction_draft, status
) values
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1', '11111111-1111-4111-8111-111111111111', null, null, null, null, null,
    '11111111-1111-4111-8111-111111111111/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1.png',
    '{"draftId":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1","restaurantName":"Busy Bee","restaurantId":null,"receiptDate":null,"receiptNumber":null,"totalMinor":null,"currency":null,"items":[],"warnings":[]}', 'draft'),
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2', '22222222-2222-4222-8222-222222222222', null, null, null, null, null,
    '22222222-2222-4222-8222-222222222222/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2.png',
    '{"draftId":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2","restaurantName":null,"restaurantId":null,"receiptDate":null,"receiptNumber":null,"totalMinor":null,"currency":null,"items":[],"warnings":[]}', 'draft');

select is(
  (select count(*)::integer from public.receipts where status = 'draft' and restaurant_id is null and receipt_date is null and total_minor is null and currency is null),
  2,
  'drafts can persist while essential extraction fields are unresolved'
);
select throws_ok(
  $$insert into public.receipts (id, user_id, restaurant_id, receipt_date, total_minor, currency, image_path, status)
    values ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', '11111111-1111-4111-8111-111111111111', null, null, null, null,
      '11111111-1111-4111-8111-111111111111/confirmed.png', 'confirmed')$$,
  '23514', null, 'non-draft receipts require every essential field'
);
insert into public.receipts (id, user_id, restaurant_id, receipt_date, total_minor, currency, image_path, image_hash, status)
values ('cccccccc-cccc-4ccc-8ccc-cccccccccccc', '11111111-1111-4111-8111-111111111111',
  '10000000-0000-4000-8000-000000000001', current_date, 1200, 'USD',
  '11111111-1111-4111-8111-111111111111/confirmed.png', repeat('a', 64), 'confirmed');
select is((select count(*)::integer from public.receipts where id = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'), 1,
  'complete non-draft receipts remain valid');

set local role authenticated;
select set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111111', true);
select set_config('request.jwt.claims', '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}', true);
select is((select count(*)::integer from public.receipts where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1'), 1,
  'an authenticated owner can read their receipt draft');
select is((select count(*)::integer from public.receipts where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2'), 0,
  'an authenticated user cannot read another account receipt draft');

select * from finish();
rollback;
