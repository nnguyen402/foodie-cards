-- Profile mutations are routed through the verified backend so ownership comes
-- from its bearer-token check and all profile changes share one row lock.

create function public.edit_profile(p_user_id uuid, p_display_name text, p_avatar_key text)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_profile public.profiles%rowtype;
  v_display_name text := btrim(coalesce(p_display_name, ''));
begin
  select * into v_profile
  from public.profiles
  where id = p_user_id
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'NOT_FOUND: profile not found';
  end if;

  if length(v_display_name) not between 1 and 40
    or p_avatar_key is null
    or p_avatar_key not in ('fork', 'plate', 'bowl', 'noodles', 'taco', 'donut') then
    raise exception using errcode = '22023', message = 'INVALID_REQUEST: profile fields are invalid';
  end if;

  update public.profiles
  set display_name = v_display_name,
      avatar_key = p_avatar_key
  where id = p_user_id
  returning * into v_profile;

  return jsonb_build_object(
    'id', v_profile.id,
    'display_name', v_profile.display_name,
    'avatar_key', v_profile.avatar_key,
    'account_xp', v_profile.account_xp,
    'equipped_title_key', v_profile.equipped_title_key
  );
end;
$$;

create function public.set_profile_pins(p_user_id uuid, p_pins jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_pin_count integer;
  v_distinct_cards integer;
  v_distinct_slots integer;
  v_owned_count integer;
begin
  perform 1
  from public.profiles
  where id = p_user_id
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'NOT_FOUND: profile not found';
  end if;

  if p_pins is null or jsonb_typeof(p_pins) is distinct from 'array'
    or jsonb_array_length(p_pins) > 3 then
    raise exception using errcode = '22023', message = 'INVALID_REQUEST: pins must contain at most three entries';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(p_pins) as requested(value)
    where jsonb_typeof(requested.value) is distinct from 'object'
      or jsonb_typeof(requested.value -> 'cardId') is distinct from 'string'
      or (requested.value ->> 'cardId') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      or jsonb_typeof(requested.value -> 'slot') is distinct from 'number'
      or (requested.value ->> 'slot') !~ '^[1-3]$'
  ) then
    raise exception using errcode = '22023', message = 'INVALID_REQUEST: duplicate card or slot';
  end if;

  select count(*)::integer,
         count(distinct (requested.value ->> 'cardId'))::integer,
         count(distinct (requested.value ->> 'slot'))::integer
  into v_pin_count, v_distinct_cards, v_distinct_slots
  from jsonb_array_elements(p_pins) as requested(value);

  if v_pin_count <> v_distinct_cards or v_pin_count <> v_distinct_slots then
    raise exception using errcode = '22023', message = 'INVALID_REQUEST: duplicate card or slot';
  end if;

  select count(*)::integer
  into v_owned_count
  from jsonb_array_elements(p_pins) as requested(value)
  join public.cards as owned_card
    on owned_card.id = (requested.value ->> 'cardId')::uuid
   and owned_card.user_id = p_user_id;

  if v_owned_count <> v_pin_count then
    raise exception using errcode = '42501', message = 'FORBIDDEN: one or more cards are not owned by this user';
  end if;

  delete from public.profile_pins where user_id = p_user_id;

  insert into public.profile_pins (user_id, card_id, slot)
  select p_user_id, (requested.value ->> 'cardId')::uuid, (requested.value ->> 'slot')::smallint
  from jsonb_array_elements(p_pins) as requested(value);

  return jsonb_build_object(
    'pins', coalesce((
      select jsonb_agg(jsonb_build_object('cardId', card_id, 'slot', slot) order by slot)
      from public.profile_pins
      where user_id = p_user_id
    ), '[]'::jsonb)
  );
end;
$$;

create function public.equip_title(p_user_id uuid, p_title_key text)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_profile public.profiles%rowtype;
begin
  select * into v_profile
  from public.profiles
  where id = p_user_id
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'NOT_FOUND: profile not found';
  end if;

  if p_title_key is not null and not exists (
    select 1
    from public.title_unlocks
    where user_id = p_user_id and title_key = p_title_key
  ) then
    raise exception using errcode = '42501', message = 'FORBIDDEN: title is not unlocked';
  end if;

  update public.profiles
  set equipped_title_key = p_title_key
  where id = p_user_id
  returning * into v_profile;

  return jsonb_build_object('equippedTitleKey', v_profile.equipped_title_key);
end;
$$;

revoke all on function public.edit_profile(uuid, text, text) from public, anon, authenticated, service_role;
revoke all on function public.set_profile_pins(uuid, jsonb) from public, anon, authenticated, service_role;
revoke all on function public.equip_title(uuid, text) from public, anon, authenticated, service_role;

grant execute on function public.edit_profile(uuid, text, text) to service_role;
grant execute on function public.set_profile_pins(uuid, jsonb) to service_role;
grant execute on function public.equip_title(uuid, text) to service_role;
