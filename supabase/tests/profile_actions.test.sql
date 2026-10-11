begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions, pg_catalog;
select plan(31);

select has_function('public', 'edit_profile', array['uuid','text','text'], 'edit_profile has the service RPC signature');
select has_function('public', 'set_profile_pins', array['uuid','jsonb'], 'set_profile_pins has the service RPC signature');
select has_function('public', 'equip_title', array['uuid','text'], 'equip_title has the service RPC signature');

select ok(not has_function_privilege('anon', 'public.edit_profile(uuid,text,text)', 'execute'), 'anon cannot execute edit_profile');
select ok(not has_function_privilege('authenticated', 'public.edit_profile(uuid,text,text)', 'execute'), 'authenticated cannot execute edit_profile');
select ok(has_function_privilege('service_role', 'public.edit_profile(uuid,text,text)', 'execute'), 'service_role can execute edit_profile');
select ok(not has_function_privilege('anon', 'public.set_profile_pins(uuid,jsonb)', 'execute'), 'anon cannot execute set_profile_pins');
select ok(not has_function_privilege('authenticated', 'public.set_profile_pins(uuid,jsonb)', 'execute'), 'authenticated cannot execute set_profile_pins');
select ok(has_function_privilege('service_role', 'public.set_profile_pins(uuid,jsonb)', 'execute'), 'service_role can execute set_profile_pins');
select ok(not has_function_privilege('anon', 'public.equip_title(uuid,text)', 'execute'), 'anon cannot execute equip_title');
select ok(not has_function_privilege('authenticated', 'public.equip_title(uuid,text)', 'execute'), 'authenticated cannot execute equip_title');
select ok(has_function_privilege('service_role', 'public.equip_title(uuid,text)', 'execute'), 'service_role can execute equip_title');

insert into auth.users (id, aud, role, email, email_confirmed_at, raw_app_meta_data, raw_user_meta_data)
values
  ('c0000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'profile-actions-a@example.test', now(), '{}'::jsonb, '{}'::jsonb),
  ('c0000000-0000-4000-8000-000000000002', 'authenticated', 'authenticated', 'profile-actions-b@example.test', now(), '{}'::jsonb, '{}'::jsonb);

insert into public.cards (id, user_id, restaurant_id)
values
  ('c1000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001'),
  ('c1000000-0000-4000-8000-000000000002', 'c0000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000002'),
  ('c1000000-0000-4000-8000-000000000004', 'c0000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000003'),
  ('c1000000-0000-4000-8000-000000000005', 'c0000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000004'),
  ('c1000000-0000-4000-8000-000000000003', 'c0000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000001');

insert into public.title_unlocks (user_id, title_key)
values ('c0000000-0000-4000-8000-000000000001', 'ultra_foodie');

set local role service_role;

select lives_ok(
  $$select public.edit_profile('c0000000-0000-4000-8000-000000000001', '  Nora  ', 'plate')$$,
  'edit_profile trims display name and accepts a bundled avatar'
);
select is((select display_name from public.profiles where id = 'c0000000-0000-4000-8000-000000000001'), 'Nora', 'profile edit persists trimmed display name');
select is((select avatar_key from public.profiles where id = 'c0000000-0000-4000-8000-000000000001'), 'plate', 'profile edit persists avatar key');

select lives_ok(
  $$select public.set_profile_pins('c0000000-0000-4000-8000-000000000001', '[{"cardId":"c1000000-0000-4000-8000-000000000001","slot":1},{"cardId":"c1000000-0000-4000-8000-000000000002","slot":2}]'::jsonb)$$,
  'set_profile_pins atomically stores up to three distinct owned cards'
);
select is((select count(*)::integer from public.profile_pins where user_id = 'c0000000-0000-4000-8000-000000000001'), 2, 'both requested owned pins are stored');

select throws_ok(
  $$select public.set_profile_pins('c0000000-0000-4000-8000-000000000001', '[{"cardId":"c1000000-0000-4000-8000-000000000001","slot":1},{"cardId":"c1000000-0000-4000-8000-000000000003","slot":2}]'::jsonb)$$,
  '42501', 'FORBIDDEN: one or more cards are not owned by this user', 'a foreign card rejects the full pin replacement'
);
select is((select count(*)::integer from public.profile_pins where user_id = 'c0000000-0000-4000-8000-000000000001'), 2, 'failed pin replacement leaves prior pins unchanged');
select is((select count(*)::integer from public.profile_pins where user_id = 'c0000000-0000-4000-8000-000000000001' and card_id = 'c1000000-0000-4000-8000-000000000002' and slot = 2), 1, 'failed replacement preserves the second prior slot');

select throws_ok(
  $$select public.set_profile_pins('c0000000-0000-4000-8000-000000000001', '[{"cardId":"c1000000-0000-4000-8000-000000000001","slot":1},{"cardId":"c1000000-0000-4000-8000-000000000001","slot":2}]'::jsonb)$$,
  '22023', 'INVALID_REQUEST: duplicate card or slot', 'duplicate card pins are rejected'
);
select throws_ok(
  $$select public.set_profile_pins('c0000000-0000-4000-8000-000000000001', '[{"cardId":"c1000000-0000-4000-8000-000000000001","slot":1},{"cardId":"c1000000-0000-4000-8000-000000000002","slot":1}]'::jsonb)$$,
  '22023', 'INVALID_REQUEST: duplicate card or slot', 'duplicate pin slots are rejected'
);
select throws_ok(
  $$select public.set_profile_pins('c0000000-0000-4000-8000-000000000001', '[{"cardId":"c1000000-0000-4000-8000-000000000001","slot":4}]'::jsonb)$$,
  '22023', 'INVALID_REQUEST: duplicate card or slot', 'pin slots outside one through three are rejected'
);
select throws_ok(
  $$select public.set_profile_pins('c0000000-0000-4000-8000-000000000001', '[{"cardId":"c1000000-0000-4000-8000-000000000001","slot":1},{"cardId":"c1000000-0000-4000-8000-000000000002","slot":2},{"cardId":"c1000000-0000-4000-8000-000000000004","slot":3},{"cardId":"c1000000-0000-4000-8000-000000000005","slot":1}]'::jsonb)$$,
  '22023', 'INVALID_REQUEST: pins must contain at most three entries', 'four pins are rejected before replacement'
);
select throws_ok(
  $$select public.set_profile_pins('c0000000-0000-4000-8000-000000000001', '[{"cardId":"not-a-uuid","slot":1}]'::jsonb)$$,
  '22023', 'INVALID_REQUEST: duplicate card or slot', 'malformed card IDs are rejected as invalid input'
);

select throws_ok(
  $$select public.equip_title('c0000000-0000-4000-8000-000000000001', 'food_critic')$$,
  '42501', 'FORBIDDEN: title is not unlocked', 'locked titles cannot be equipped'
);
select lives_ok(
  $$select public.equip_title('c0000000-0000-4000-8000-000000000001', 'ultra_foodie')$$,
  'an unlocked title can be equipped'
);
select is((select equipped_title_key from public.profiles where id = 'c0000000-0000-4000-8000-000000000001'), 'ultra_foodie', 'equipped title is persisted');
select lives_ok(
  $$select public.equip_title('c0000000-0000-4000-8000-000000000001', null)$$,
  'null clears an equipped title'
);
select is((select equipped_title_key from public.profiles where id = 'c0000000-0000-4000-8000-000000000001'), null, 'title clear is persisted');

set local role authenticated;
select throws_ok(
  $$select public.edit_profile('c0000000-0000-4000-8000-000000000001', 'Nora', 'plate')$$,
  '42501', null, 'authenticated callers cannot invoke profile mutation RPCs'
);
reset role;

select * from finish();
rollback;
