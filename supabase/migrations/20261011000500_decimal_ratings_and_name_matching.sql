-- Align database rating validation with the one-decimal shared contract.
alter table public.reviews drop constraint reviews_rating_check;
alter table public.reviews add constraint reviews_rating_check check (rating is null or rating between 0 and 5);

create or replace function public.save_review(
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
  if p_rating is not null and (p_rating < 0 or p_rating > 5 or p_rating * 10 <> trunc(p_rating * 10)) then
    raise exception using errcode = 'P0001', message = 'INVALID_REQUEST: rating must be between 0 and 5 with at most one decimal place';
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


-- Accept complete multi-word brand prefixes with branch or description suffixes.
create or replace function public.place_names_match(p_left text, p_right text)
returns boolean language plpgsql immutable set search_path = '' as $function$
declare
  v_left text := btrim(regexp_replace(translate(lower(regexp_replace(coalesce(p_left,''), '#?[0-9]+', ' ', 'g')), 'áàäâãåéèëêíìïîóòöôõúùüûñçýÿ', 'aaaaaaeeeeiiiiooooouuuuncyy'), '[^a-z0-9]+', ' ', 'g'));
  v_right text := btrim(regexp_replace(translate(lower(regexp_replace(coalesce(p_right,''), '#?[0-9]+', ' ', 'g')), 'áàäâãåéèëêíìïîóòöôõúùüûñçýÿ', 'aaaaaaeeeeiiiiooooouuuuncyy'), '[^a-z0-9]+', ' ', 'g'));
  v_left_words text[];
  v_right_words text[];
  v_overlap integer;
  v_prefix text := '';
  v_count integer := 0;
  v_index integer;
begin
  if v_left = '' or v_right = '' then return false; end if;
  if v_left = v_right then return true; end if;
  v_left_words := regexp_split_to_array(v_left, '\s+');
  v_right_words := regexp_split_to_array(v_right, '\s+');
  for v_index in 1..least(cardinality(v_left_words),cardinality(v_right_words)) loop
    exit when v_left_words[v_index] <> v_right_words[v_index];
    v_prefix := v_prefix || v_left_words[v_index];
    v_count := v_count + 1;
  end loop;
  if v_count >= 2 and length(v_prefix) >= 6 then return true; end if;
  select count(distinct word)::integer into v_overlap from unnest(v_left_words) word where word=any(v_right_words) and length(word)>=3;
  return v_overlap > 0 and v_overlap::numeric / greatest(cardinality(v_left_words),cardinality(v_right_words)) >= 0.8;
end;
$function$;
revoke all on function public.place_names_match(text,text) from public, anon, authenticated;

