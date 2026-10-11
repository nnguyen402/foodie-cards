-- Place resolution, generated menu rows and receipt acceptance share one transaction.
alter table public.restaurants
  add column source text not null default 'catalog' check (source in ('catalog', 'osm')),
  add column osm_type text check (osm_type in ('node', 'way', 'relation')),
  add column osm_id bigint,
  add column brand_key text,
  add column brand_wikidata text,
  add column latitude double precision check (latitude between -90 and 90),
  add column longitude double precision check (longitude between -180 and 180),
  add column created_by uuid references auth.users(id) on delete set null,
  add constraint restaurants_osm_pair check ((osm_type is null) = (osm_id is null));

create unique index restaurants_osm_unique on public.restaurants (osm_type, osm_id) where osm_id is not null;
create unique index restaurants_brand_unique on public.restaurants (brand_key) where brand_key is not null;

create function public.place_names_match(p_left text, p_right text)
returns boolean language plpgsql immutable set search_path = '' as $function$
declare
  v_left text := btrim(regexp_replace(translate(lower(regexp_replace(coalesce(p_left,''), '#?[0-9]+', ' ', 'g')), 'áàäâãåéèëêíìïîóòöôõúùüûñçýÿ', 'aaaaaaeeeeiiiiooooouuuuncyy'), '[^a-z0-9]+', ' ', 'g'));
  v_right text := btrim(regexp_replace(translate(lower(regexp_replace(coalesce(p_right,''), '#?[0-9]+', ' ', 'g')), 'áàäâãåéèëêíìïîóòöôõúùüûñçýÿ', 'aaaaaaeeeeiiiiooooouuuuncyy'), '[^a-z0-9]+', ' ', 'g'));
  v_left_words text[];
  v_right_words text[];
  v_overlap integer;
begin
  if v_left = '' or v_right = '' then return false; end if;
  if v_left = v_right then return true; end if;
  v_left_words := regexp_split_to_array(v_left, '\s+');
  v_right_words := regexp_split_to_array(v_right, '\s+');
  select count(distinct word)::integer into v_overlap from unnest(v_left_words) word where word=any(v_right_words) and length(word)>=3;
  return v_overlap > 0 and v_overlap::numeric / greatest(cardinality(v_left_words),cardinality(v_right_words)) >= 0.8;
end;
$function$;
revoke all on function public.place_names_match(text,text) from public, anon, authenticated;

update public.restaurants set brand_key = case slug
  when 'busy-bee-cafe-west-end' then 'name:busy bee cafe'
  when 'fox-bros-bbq-dekalb-ave' then 'name:fox bros bar b q'
  when 'mary-macs-tea-room' then 'name:mary mac s tea room'
  when 'the-varsity-atlanta' then 'name:varsity'
  when 'antico-pizza-west-midtown' then 'name:antico pizza'
  when 'chick-fil-a-atlanta' then 'name:chick fil a'
end where slug in ('busy-bee-cafe-west-end','fox-bros-bbq-dekalb-ave','mary-macs-tea-room','the-varsity-atlanta','antico-pizza-west-midtown','chick-fil-a-atlanta');

create function public.accept_place_receipt(p_user_id uuid, p_receipt_id uuid, p_submission_id uuid, p_confirmed jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $function$
declare
  v_place jsonb := p_confirmed -> 'place';
  v_type text := v_place ->> 'osmType';
  v_osm bigint := (v_place ->> 'osmId')::bigint;
  v_name text := btrim(v_place ->> 'name');
  v_brand text := nullif(btrim(v_place ->> 'brandKey'), '');
  v_restaurant public.restaurants%rowtype;
  v_receipt public.receipts%rowtype;
  v_slug text;
  v_lines jsonb;
  v_line jsonb;
  v_id uuid;
  v_canonical text;
  v_source text;
  v_result jsonb;
begin
  if p_user_id is null or jsonb_typeof(v_place) is distinct from 'object'
     or v_type not in ('node','way','relation') or v_osm <= 0
     or char_length(v_name) not between 1 and 200
     or jsonb_typeof(p_confirmed -> 'items') is distinct from 'array'
     or jsonb_array_length(p_confirmed -> 'items') not between 1 and 100 then
    raise exception using errcode='P0001', message='INVALID_RECEIPT: place confirmation is invalid';
  end if;

  -- Replay exits before creating a restaurant or generated menu rows.
  perform 1 from public.profiles p where p.id=p_user_id for update;
  if not found then raise exception using errcode='P0001', message='NOT_FOUND: profile not found'; end if;
  select r.* into v_receipt from public.receipts r where r.id=p_receipt_id and r.user_id=p_user_id for update;
  if not found then raise exception using errcode='P0001', message='FORBIDDEN: receipt draft not found'; end if;
  if v_receipt.status='accepted' then
    if v_receipt.submission_id=p_submission_id and v_receipt.acceptance_result is not null then return v_receipt.acceptance_result; end if;
    raise exception using errcode='P0001', message='DUPLICATE_RECEIPT: receipt appears to have already been submitted';
  end if;
  if v_receipt.status not in ('draft','confirmed') then raise exception using errcode='P0001', message='FORBIDDEN: receipt draft not found'; end if;
  if not public.place_names_match(v_receipt.extraction_draft->>'restaurantName', v_name) then
    raise exception using errcode='P0001', message='INVALID_RECEIPT: receipt does not match chosen place';
  end if;

  -- Serialize per-user cap checks and concurrent submissions for the same place.
  perform pg_advisory_xact_lock(hashtextextended(p_user_id::text, 0));
  perform pg_advisory_xact_lock(hashtextextended(coalesce(v_brand, v_type || ':' || v_osm::text), 1));

  select r.* into v_restaurant from public.restaurants r
   where (v_brand is not null and r.brand_key = v_brand) or (r.osm_type = v_type and r.osm_id = v_osm)
   order by case when v_brand is not null and r.brand_key = v_brand then 0 else 1 end limit 1;

  if not found then
    if (select count(*) from public.restaurants r where r.created_by=p_user_id and r.created_at > now()-interval '24 hours') >= 5 then
      raise exception using errcode='P0001', message='RATE_LIMITED: too many new restaurants today';
    end if;
    v_slug := coalesce(nullif(trim(both '-' from lower(regexp_replace(v_name, '[^a-zA-Z0-9]+', '-', 'g'))), ''), 'place') || '-' || v_type || '-' || v_osm;
    insert into public.restaurants (slug,name,location_label,category,source,osm_type,osm_id,brand_key,brand_wikidata,latitude,longitude,created_by)
    values (v_slug, left(v_name,120), left(coalesce(nullif(btrim(v_place->>'address'),''),'Nearby'),160),
      left(coalesce(nullif(lower(btrim(split_part(coalesce(v_place->>'cuisine',''),';',1))),''),'restaurant'),40),
      'osm',v_type,v_osm,v_brand,case when v_brand like 'wikidata:%' then substr(v_brand,10) end,
      (v_place->>'latitude')::double precision,(v_place->>'longitude')::double precision,p_user_id)
    returning * into v_restaurant;
  end if;
  if not public.place_names_match(v_restaurant.name, v_name) then
    raise exception using errcode='P0001', message='INVALID_RECEIPT: place brand does not match its restaurant';
  end if;
  v_source := v_restaurant.source;

  v_lines := '[]'::jsonb;
  for v_line in select value from jsonb_array_elements(p_confirmed->'items') loop
    v_canonical := regexp_replace(lower(btrim(v_line->>'confirmedName')), '\s+', ' ', 'g');
    if char_length(v_canonical) not between 1 and 120 then raise exception using errcode='P0001', message='INVALID_RECEIPT: item name is invalid'; end if;
    if v_source = 'osm' then
      insert into public.menu_items (restaurant_id,canonical_name) values (v_restaurant.id,v_canonical)
        on conflict (restaurant_id,canonical_name) do nothing;
      select id into v_id from public.menu_items where restaurant_id=v_restaurant.id and canonical_name=v_canonical;
    else
      select mi.id into v_id from public.menu_items mi where mi.restaurant_id=v_restaurant.id
        and (lower(regexp_replace(btrim(mi.canonical_name),'\s+',' ','g'))=v_canonical
          or exists (select 1 from unnest(mi.aliases) a where lower(regexp_replace(btrim(a),'\s+',' ','g'))=v_canonical))
        limit 1;
      if v_id is null then raise exception using errcode='P0001', message='INVALID_RECEIPT: unsupported catalog menu item'; end if;
    end if;
    v_lines := v_lines || jsonb_build_array(jsonb_build_object(
      'originalText',v_line->>'originalText','confirmedName',v_canonical,
      'quantity',v_line->'quantity','menuItemId',v_id));
  end loop;

  v_result := public.accept_receipt(p_user_id,p_receipt_id,p_submission_id,
    (p_confirmed - 'place' - 'restaurantId') || jsonb_build_object('restaurantId',v_restaurant.id,'items',v_lines));
  return v_result;
end;
$function$;

revoke all on function public.accept_place_receipt(uuid,uuid,uuid,jsonb) from public, anon, authenticated;
grant execute on function public.accept_place_receipt(uuid,uuid,uuid,jsonb) to service_role;
