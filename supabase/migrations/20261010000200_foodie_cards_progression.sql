-- Transactional receipt progression and profile review rewards. All RPCs are
-- called by the verified backend with service_role; clients cannot grant XP.

alter table public.receipts
  alter column restaurant_id drop not null,
  alter column receipt_date drop not null,
  alter column total_minor drop not null,
  alter column currency drop not null,
  add column acceptance_result jsonb,
  add constraint receipts_required_confirmation_fields_check check (
    status = 'draft' or (
      restaurant_id is not null
      and receipt_date is not null
      and total_minor is not null
      and currency is not null
      and image_hash is not null
      and image_hash ~ '^[0-9a-f]{64}$'
    )
  ),
  add constraint receipts_accepted_result_check check (
    status <> 'accepted' or (
      fingerprint is not null
      and submission_id is not null
      and acceptance_result is not null
      and jsonb_typeof(acceptance_result) = 'object'
    )
  );

create index receipts_user_status_created_idx
  on public.receipts (user_id, status, created_at desc);

-- Shared evaluator. The caller holds the profile row FOR UPDATE, serializing
-- receipt and review awards for this user. Badges are awarded before titles.
create function public._award_account_rewards(p_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_badge record;
  v_title_key text;
  v_account_xp integer;
  v_level integer;
  v_new_badges text[] := array[]::text[];
  v_new_titles text[] := array[]::text[];
begin
  select p.account_xp into v_account_xp
  from public.profiles p
  where p.id = p_user_id;

  if not found then
    raise exception using errcode = 'P0001', message = 'NOT_FOUND: profile not found';
  end if;

  for v_badge in
    select b.key, b.account_xp_reward
    from public.badges b
    where
      (b.key = 'first_bite' and exists (
        select 1 from public.cards c where c.user_id = p_user_id
      ))
      or (b.key = 'cafe_crawler' and (
        select count(distinct c.restaurant_id)
        from public.cards c join public.restaurants r on r.id = c.restaurant_id
        where c.user_id = p_user_id and r.category = 'cafe'
      ) >= 3)
      or (b.key = 'menu_explorer' and (
        select count(*) from public.user_items ui where ui.user_id = p_user_id
      ) >= 10)
      or (b.key = 'loyal_regular' and exists (
        select 1 from public.cards c where c.user_id = p_user_id and c.stage = 'house_favorite'
      ))
      or (b.key = 'first_impressions' and exists (
        select 1 from public.reviews r where r.user_id = p_user_id and length(regexp_replace(r.text, '[[:space:]]', '', 'g')) > 0
      ))
      or (b.key = 'food_critic' and (
        select count(*) from public.reviews r where r.user_id = p_user_id and length(regexp_replace(r.text, '[[:space:]]', '', 'g')) > 0
      ) >= 10)
      or (b.key = 'seasoned_reviewer' and (
        select count(*) from public.reviews r where r.user_id = p_user_id and length(regexp_replace(r.text, '[[:space:]]', '', 'g')) > 0
      ) >= 25)
      or (b.key = 'critics_club' and (
        select count(*) from public.reviews r where r.user_id = p_user_id and length(regexp_replace(r.text, '[[:space:]]', '', 'g')) > 0
      ) >= 50)
    order by b.key
  loop
    insert into public.badge_awards (user_id, badge_key)
    values (p_user_id, v_badge.key)
    on conflict (user_id, badge_key) do nothing;

    if found then
      v_new_badges := array_append(v_new_badges, v_badge.key);
      v_account_xp := v_account_xp + v_badge.account_xp_reward;
    end if;
  end loop;

  update public.profiles p
  set account_xp = v_account_xp
  where p.id = p_user_id;

  v_level := 1 + floor(v_account_xp::numeric / 200)::integer;

  for v_title_key in
    select t.key
    from public.titles t
    where
      (t.key in ('cafe_crawler','menu_explorer','loyal_regular','food_critic','seasoned_reviewer','critics_club')
        and exists (
          select 1 from public.badge_awards ba
          where ba.user_id = p_user_id and ba.badge_key = t.key
        ))
      or (t.key = 'ultra_foodie' and v_level >= 5)
      or (t.key = 'mega_food_crawler' and (
        select count(*) from public.cards c where c.user_id = p_user_id
      ) >= 20)
    order by t.key
  loop
    insert into public.title_unlocks (user_id, title_key)
    values (p_user_id, v_title_key)
    on conflict (user_id, title_key) do nothing;

    if found then
      v_new_titles := array_append(v_new_titles, v_title_key);
    end if;
  end loop;

  return jsonb_build_object(
    'accountXP', v_account_xp,
    'accountLevel', v_level,
    'newBadges', to_jsonb(v_new_badges),
    'newTitles', to_jsonb(v_new_titles)
  );
end;
$function$;

create function public.accept_receipt(
  p_user_id uuid,
  p_receipt_id uuid,
  p_submission_id uuid,
  p_confirmed jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_receipt public.receipts%rowtype;
  v_restaurant_id uuid;
  v_receipt_date date;
  v_receipt_number text;
  v_total_minor bigint;
  v_currency text;
  v_raw_items jsonb;
  v_merged_items jsonb;
  v_distinct_items integer;
  v_new_items integer;
  v_additional_units bigint;
  v_purchase_base integer;
  v_purchase_xp integer;
  v_visit_xp integer;
  v_total_xp integer;
  v_multiplier numeric;
  v_previous_visits integer;
  v_is_new_visit boolean;
  v_card public.cards%rowtype;
  v_card_id uuid;
  v_card_xp integer;
  v_visit_count integer;
  v_stage text;
  v_stage_row record;
  v_stage_event_id uuid;
  v_stage_xp integer;
  v_highest_event_id uuid;
  v_highest_event_rank integer := 0;
  v_stage_awards jsonb := '[]'::jsonb;
  v_fingerprint text;
  v_rewards jsonb;
  v_new_badges jsonb;
  v_new_titles jsonb;
  v_account_xp integer;
  v_account_level integer;
  v_result jsonb;
begin
  if p_user_id is null or p_receipt_id is null or p_submission_id is null
     or jsonb_typeof(p_confirmed) is distinct from 'object' then
    raise exception using errcode = 'P0001', message = 'INVALID_RECEIPT: confirmation is invalid';
  end if;

  if p_confirmed ->> 'draftId' is distinct from p_receipt_id::text
     or p_confirmed ->> 'submissionId' is distinct from p_submission_id::text then
    raise exception using errcode = 'P0001', message = 'INVALID_RECEIPT: confirmation identifiers do not match';
  end if;

  -- This is the common lock for all rewards, including review saves.
  perform 1 from public.profiles p where p.id = p_user_id for update;
  if not found then
    raise exception using errcode = 'P0001', message = 'NOT_FOUND: profile not found';
  end if;

  select r.* into v_receipt
  from public.receipts r
  where r.id = p_receipt_id and r.user_id = p_user_id
  for update;
  if not found then
    raise exception using errcode = 'P0001', message = 'FORBIDDEN: receipt draft not found';
  end if;

  if v_receipt.status = 'accepted' then
    if v_receipt.submission_id = p_submission_id and v_receipt.acceptance_result is not null then
      return v_receipt.acceptance_result;
    end if;
    raise exception using errcode = 'P0001', message = 'DUPLICATE_RECEIPT: receipt appears to have already been submitted';
  end if;

  if v_receipt.status not in ('draft','confirmed') then
    raise exception using errcode = 'P0001', message = 'FORBIDDEN: receipt draft not found';
  end if;

  if exists (
    select 1 from public.receipts other
    where other.submission_id = p_submission_id and other.id <> p_receipt_id
  ) then
    raise exception using errcode = 'P0001', message = 'DUPLICATE_RECEIPT: receipt appears to have already been submitted';
  end if;

  if v_receipt.image_hash is null or v_receipt.image_hash !~ '^[0-9a-f]{64}$'
     or split_part(v_receipt.image_path, '/', 1) <> p_user_id::text then
    raise exception using errcode = 'P0001', message = 'INVALID_RECEIPT: receipt image is unavailable';
  end if;

  begin
    v_restaurant_id := (p_confirmed ->> 'restaurantId')::uuid;
    v_receipt_date := (p_confirmed ->> 'receiptDate')::date;
    v_total_minor := (p_confirmed ->> 'totalMinor')::bigint;
    v_currency := p_confirmed ->> 'currency';
    v_receipt_number := nullif(btrim(p_confirmed ->> 'receiptNumber'), '');
    v_raw_items := p_confirmed -> 'items';
  exception when others then
    raise exception using errcode = 'P0001', message = 'INVALID_RECEIPT: confirmation fields are invalid';
  end;

  if jsonb_typeof(v_raw_items) is distinct from 'array' then
    raise exception using errcode = 'P0001', message = 'INVALID_RECEIPT: confirmed items must be an array';
  end if;

  if v_restaurant_id is null or v_receipt_date is null or v_total_minor is null or v_total_minor < 0
     or v_currency is null or v_currency !~ '^[A-Z]{3}$'
     or (p_confirmed ->> 'receiptDate') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
     or to_char(v_receipt_date, 'YYYY-MM-DD') <> p_confirmed ->> 'receiptDate'
     or jsonb_array_length(v_raw_items) = 0
     or not exists (select 1 from public.restaurants r where r.id = v_restaurant_id) then
    raise exception using errcode = 'P0001', message = 'INVALID_RECEIPT: confirmation fields are incomplete';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(v_raw_items) as line(value)
    where jsonb_typeof(line.value) <> 'object'
       or nullif(btrim(line.value ->> 'originalText'), '') is null
       or length(btrim(line.value ->> 'originalText')) > 240
       or nullif(btrim(line.value ->> 'confirmedName'), '') is null
       or length(btrim(line.value ->> 'confirmedName')) > 120
       or (line.value ->> 'quantity') is null
       or (line.value ->> 'quantity') !~ '^[1-9][0-9]*$'
       or (line.value ->> 'menuItemId') is null
       or (line.value ->> 'menuItemId') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  ) then
    raise exception using errcode = 'P0001', message = 'INVALID_RECEIPT: confirmed items are invalid';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(v_raw_items) as line(value)
    left join public.menu_items mi
      on mi.id = (line.value ->> 'menuItemId')::uuid and mi.restaurant_id = v_restaurant_id
    where mi.id is null
  ) then
    raise exception using errcode = 'P0001', message = 'INVALID_RECEIPT: confirmed item is unavailable for this restaurant';
  end if;

  select jsonb_agg(
    jsonb_build_object(
      'menuItemId', grouped.menu_item_id,
      'quantity', grouped.quantity,
      'originalText', grouped.original_text
    ) order by grouped.menu_item_id
  )
  into v_merged_items
  from (
    select
      (line.value ->> 'menuItemId')::uuid as menu_item_id,
      sum((line.value ->> 'quantity')::integer)::integer as quantity,
    (array_agg(btrim(line.value ->> 'originalText') order by line.ordinality))[1] as original_text
    from jsonb_array_elements(v_raw_items) with ordinality as line(value,ordinality)
    group by (line.value ->> 'menuItemId')::uuid
  ) grouped;

  select count(*)::integer,
         coalesce(sum(greatest((item.value ->> 'quantity')::bigint - 1, 0)), 0)
  into v_distinct_items, v_additional_units
  from jsonb_array_elements(v_merged_items) as item(value);

  -- Set the corrected restaurant while the row is still a draft so the
  -- receipt_items composite FK can validate it. Any later failure rolls this
  -- update back with the rest of the acceptance transaction.
  update public.receipts r
  set restaurant_id = v_restaurant_id,
      receipt_date = v_receipt_date,
      receipt_number = v_receipt_number,
      total_minor = v_total_minor,
      currency = v_currency
  where r.id = p_receipt_id and r.user_id = p_user_id;

  select count(*)::integer into v_new_items
  from jsonb_array_elements(v_merged_items) as item(value)
  where not exists (
    select 1 from public.user_items ui
    where ui.user_id = p_user_id
      and ui.restaurant_id = v_restaurant_id
      and ui.menu_item_id = (item.value ->> 'menuItemId')::uuid
  );

  v_is_new_visit := not exists (
    select 1 from public.visits visit
    where visit.user_id = p_user_id
      and visit.restaurant_id = v_restaurant_id
      and visit.visit_date = v_receipt_date
  );

  select c.* into v_card
  from public.cards c
  where c.user_id = p_user_id and c.restaurant_id = v_restaurant_id
  for update;
  if found then
    v_card_id := v_card.id;
    v_previous_visits := v_card.visit_count;
  else
    v_card_id := extensions.gen_random_uuid();
    v_previous_visits := 0;
    insert into public.cards (id, user_id, restaurant_id)
    values (v_card_id, p_user_id, v_restaurant_id);
  end if;

  if v_previous_visits = 0 then
    v_visit_xp := case when v_is_new_visit then 100 else 0 end;
    v_multiplier := 1.0;
  else
    v_visit_xp := case when v_is_new_visit then 50 else 0 end;
    v_multiplier := case
      when v_previous_visits >= 10 then 1.3
      when v_previous_visits >= 6 then 1.2
      when v_previous_visits >= 3 then 1.1
      else 1.0
    end;
  end if;

  v_purchase_base := 10 * v_distinct_items + 30 * v_new_items + least(10::bigint, 2 * v_additional_units)::integer;
  v_purchase_xp := floor(v_purchase_base * v_multiplier)::integer;
  v_total_xp := v_visit_xp + v_purchase_xp;

  insert into public.receipt_items (receipt_id,user_id,restaurant_id,menu_item_id,original_text,quantity)
  select p_receipt_id, p_user_id, v_restaurant_id,
         (item.value ->> 'menuItemId')::uuid,
         item.value ->> 'originalText',
         (item.value ->> 'quantity')::integer
  from jsonb_array_elements(v_merged_items) as item(value);

  insert into public.user_items (user_id,restaurant_id,card_id,menu_item_id,first_purchase_date)
  select p_user_id, v_restaurant_id, v_card_id,
         (item.value ->> 'menuItemId')::uuid, v_receipt_date
  from jsonb_array_elements(v_merged_items) as item(value)
  on conflict (user_id,restaurant_id,menu_item_id) do nothing;

  if v_is_new_visit then
    insert into public.visits (user_id,restaurant_id,card_id,visit_date)
    values (p_user_id,v_restaurant_id,v_card_id,v_receipt_date);
  end if;

  update public.cards c
  set card_xp = c.card_xp + v_total_xp,
      visit_count = c.visit_count + case when v_is_new_visit then 1 else 0 end,
      last_visit_date = case
        when c.last_visit_date is null or c.last_visit_date < v_receipt_date then v_receipt_date
        else c.last_visit_date
      end
  where c.id = v_card_id
  returning c.card_xp, c.visit_count into v_card_xp, v_visit_count;

  v_stage := (select c.stage from public.cards c where c.id = v_card_id);

  for v_stage_row in
    select milestone.stage_key, milestone.stage_rank, milestone.account_xp
    from (values
      ('discovered'::text,1,100),
      ('regular'::text,2,150),
      ('house_favorite'::text,3,300)
    ) as milestone(stage_key,stage_rank,account_xp)
    where
      (milestone.stage_key = 'discovered')
      or (milestone.stage_key = 'regular' and v_card_xp >= 300 and v_visit_count >= 3)
      or (milestone.stage_key = 'house_favorite' and v_card_xp >= 750 and v_visit_count >= 6)
    order by milestone.stage_rank
  loop
    insert into public.reward_events (user_id,receipt_id,event_type,reward_key,payload)
    values (
      p_user_id,
      p_receipt_id,
      'card_stage',
      v_restaurant_id::text || ':' || v_stage_row.stage_key,
      jsonb_build_object('cardId',v_card_id,'restaurantId',v_restaurant_id,'stage',v_stage_row.stage_key,'accountXP',v_stage_row.account_xp)
    )
    on conflict (user_id,event_type,reward_key) do nothing
    returning id into v_stage_event_id;

    if v_stage_event_id is not null then
      update public.profiles p set account_xp = p.account_xp + v_stage_row.account_xp where p.id = p_user_id;
      v_stage_awards := v_stage_awards || jsonb_build_array(jsonb_build_object(
        'stage',v_stage_row.stage_key,
        'accountXP',v_stage_row.account_xp
      ));
      if v_stage_row.stage_rank > v_highest_event_rank then
        v_highest_event_rank := v_stage_row.stage_rank;
        v_highest_event_id := v_stage_event_id;
      end if;
    end if;
    v_stage_event_id := null;
  end loop;

  update public.cards c
  set stage = case
    when v_card_xp >= 750 and v_visit_count >= 6 then 'house_favorite'
    when v_card_xp >= 300 and v_visit_count >= 3 then 'regular'
    else c.stage
  end
  where c.id = v_card_id
  returning c.stage into v_stage;

  if v_highest_event_id is not null then
    update public.reward_events e
    set payload = e.payload || jsonb_build_object('stageAwards',v_stage_awards)
    where e.id = v_highest_event_id and e.user_id = p_user_id;

    update public.reward_events e
    set viewed_at = coalesce(e.viewed_at, now())
    where e.user_id = p_user_id
      and e.event_type = 'card_stage'
      and e.receipt_id = p_receipt_id
      and e.reward_key like v_restaurant_id::text || ':%'
      and e.id <> v_highest_event_id;
  end if;

  v_rewards := public._award_account_rewards(p_user_id);
  v_new_badges := v_rewards -> 'newBadges';
  v_new_titles := v_rewards -> 'newTitles';
  v_account_xp := (v_rewards ->> 'accountXP')::integer;
  v_account_level := (v_rewards ->> 'accountLevel')::integer;

  v_fingerprint := encode(extensions.digest(
    convert_to(jsonb_build_object(
      'restaurantId',v_restaurant_id,
      'receiptDate',to_char(v_receipt_date,'YYYY-MM-DD'),
      'receiptNumber',case when v_receipt_number is null then null else lower(v_receipt_number) end,
      'totalMinor',v_total_minor,
      'currency',v_currency,
      'items',(
        select jsonb_agg(jsonb_build_object('menuItemId',item.value ->> 'menuItemId','quantity',(item.value ->> 'quantity')::integer)
          order by item.value ->> 'menuItemId')
        from jsonb_array_elements(v_merged_items) as item(value)
      )
    )::text,'UTF8'), 'sha256'), 'hex');

  if exists (
    select 1 from public.receipts other
    where other.status = 'accepted'
      and (other.image_hash = v_receipt.image_hash or other.fingerprint = v_fingerprint)
  ) then
    raise exception using errcode = 'P0001', message = 'DUPLICATE_RECEIPT: receipt appears to have already been submitted';
  end if;

  v_result := jsonb_build_object(
    'receiptId',p_receipt_id,
    'cardId',v_card_id,
    'xpBreakdown',jsonb_build_object(
      'visitXP',v_visit_xp,
      'purchaseBaseXP',v_purchase_base,
      'multiplier',v_multiplier,
      'purchaseXP',v_purchase_xp,
      'totalXP',v_total_xp
    ),
    'cardXP',v_card_xp,
    'visitCount',v_visit_count,
    'stage',v_stage,
    'accountXP',v_account_xp,
    'accountLevel',v_account_level,
    'newBadges',coalesce(v_new_badges,'[]'::jsonb),
    'newTitles',coalesce(v_new_titles,'[]'::jsonb),
    'stageAwards',v_stage_awards,
    'revealEventId',v_highest_event_id
  );

  update public.receipts r
  set restaurant_id = v_restaurant_id,
      receipt_date = v_receipt_date,
      receipt_number = v_receipt_number,
      total_minor = v_total_minor,
      currency = v_currency,
      fingerprint = v_fingerprint,
      submission_id = p_submission_id,
      status = 'accepted',
      accepted_at = now(),
      acceptance_result = v_result
  where r.id = p_receipt_id and r.user_id = p_user_id;

  return v_result;
exception
  when unique_violation then
    raise exception using errcode = 'P0001', message = 'DUPLICATE_RECEIPT: receipt appears to have already been submitted';
  when data_exception then
    raise exception using errcode = 'P0001', message = 'INVALID_RECEIPT: confirmation fields are invalid';
end;
$function$;

create function public.save_review(
  p_user_id uuid,
  p_restaurant_id uuid,
  p_rating numeric,
  p_text text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_clean_text text := regexp_replace(coalesce(p_text, ''), '^[[:space:]]+|[[:space:]]+$', '', 'g');
  v_review public.reviews%rowtype;
  v_rewards jsonb;
begin
  if p_user_id is null or p_restaurant_id is null then
    raise exception using errcode = 'P0001', message = 'INVALID_REQUEST: review identifiers are required';
  end if;
  if p_rating is not null and (p_rating < 0 or p_rating > 5 or p_rating * 2 <> trunc(p_rating * 2)) then
    raise exception using errcode = 'P0001', message = 'INVALID_REQUEST: rating must be between 0 and 5 in half-star steps';
  end if;
  if char_length(v_clean_text) > 500 then
    raise exception using errcode = 'P0001', message = 'INVALID_REQUEST: review text exceeds 500 characters';
  end if;

  perform 1 from public.profiles p where p.id = p_user_id for update;
  if not found then
    raise exception using errcode = 'P0001', message = 'NOT_FOUND: profile not found';
  end if;

  select c.id into v_review.card_id
  from public.cards c
  where c.user_id = p_user_id and c.restaurant_id = p_restaurant_id;
  if not found then
    raise exception using errcode = 'P0001', message = 'FORBIDDEN: restaurant card required';
  end if;

  insert into public.reviews (user_id,restaurant_id,card_id,rating,text)
  values (p_user_id,p_restaurant_id,v_review.card_id,p_rating,v_clean_text)
  on conflict (user_id,restaurant_id) do update
    set rating = excluded.rating,
        text = excluded.text,
        updated_at = now()
  returning * into v_review;

  v_rewards := public._award_account_rewards(p_user_id);

  return jsonb_build_object(
    'review',jsonb_build_object(
      'restaurantId',v_review.restaurant_id,
      'rating',v_review.rating,
      'text',v_review.text,
      'updatedAt',to_char(v_review.updated_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
    ),
    'accountXP',(v_rewards ->> 'accountXP')::integer,
    'accountLevel',(v_rewards ->> 'accountLevel')::integer,
    'newBadges',coalesce(v_rewards -> 'newBadges','[]'::jsonb),
    'newTitles',coalesce(v_rewards -> 'newTitles','[]'::jsonb)
  );
end;
$function$;

create function public.acknowledge_reward(p_user_id uuid, p_event_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_event public.reward_events%rowtype;
begin
  if p_user_id is null or p_event_id is null then
    raise exception using errcode = 'P0001', message = 'INVALID_REQUEST: reward identifiers are required';
  end if;

  update public.reward_events e
  set viewed_at = coalesce(e.viewed_at, now())
  where e.id = p_event_id
    and e.user_id = p_user_id
    and e.event_type = 'card_stage'
  returning * into v_event;

  if not found then
    raise exception using errcode = 'P0001', message = 'NOT_FOUND: reward event not found';
  end if;

  return jsonb_build_object(
    'eventId',v_event.id,
    'viewedAt',to_char(v_event.viewed_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
  );
end;
$function$;

revoke all on function public._award_account_rewards(uuid) from public, anon, authenticated, service_role;
revoke all on function public.accept_receipt(uuid,uuid,uuid,jsonb) from public, anon, authenticated;
revoke all on function public.save_review(uuid,uuid,numeric,text) from public, anon, authenticated;
revoke all on function public.acknowledge_reward(uuid,uuid) from public, anon, authenticated;
grant execute on function public.accept_receipt(uuid,uuid,uuid,jsonb) to service_role;
grant execute on function public.save_review(uuid,uuid,numeric,text) to service_role;
grant execute on function public.acknowledge_reward(uuid,uuid) to service_role;
