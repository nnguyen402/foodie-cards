-- Foodie Cards foundation: user-owned data is private by default. Receipt and
-- progression writes are reserved for the authenticated backend/service role.

create extension if not exists pgcrypto with schema extensions;

create table public.restaurants (
  id uuid primary key default extensions.gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name text not null check (length(btrim(name)) between 1 and 120),
  location_label text not null check (length(btrim(location_label)) between 1 and 160),
  category text not null check (length(btrim(category)) between 1 and 40),
  aliases text[] not null default '{}',
  hero_image_path text,
  hero_image_kind text check (hero_image_kind in ('logo', 'storefront', 'food')),
  theme jsonb,
  created_at timestamptz not null default now(),
  check ((hero_image_path is null) = (hero_image_kind is null)),
  check (theme is null or jsonb_typeof(theme) = 'object')
);

create table public.menu_items (
  id uuid primary key default extensions.gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete restrict,
  canonical_name text not null check (length(btrim(canonical_name)) between 1 and 120),
  aliases text[] not null default '{}',
  created_at timestamptz not null default now(),
  unique (restaurant_id, canonical_name),
  unique (id, restaurant_id)
);

create table public.badges (
  key text primary key check (key ~ '^[a-z0-9_]+$'),
  name text not null,
  description text not null,
  account_xp_reward integer not null default 50 check (account_xp_reward >= 0),
  created_at timestamptz not null default now()
);

create table public.titles (
  key text primary key check (key ~ '^[a-z0-9_]+$'),
  name text not null,
  description text not null,
  created_at timestamptz not null default now()
);

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default 'Foodie'
    check (length(btrim(display_name)) between 1 and 40),
  avatar_key text not null default 'fork'
    check (avatar_key in ('fork', 'plate', 'bowl', 'noodles', 'taco', 'donut')),
  account_xp integer not null default 0 check (account_xp >= 0),
  equipped_title_key text references public.titles(key) on delete restrict,
  share_token uuid not null default extensions.gen_random_uuid() unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.cards (
  id uuid primary key default extensions.gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  restaurant_id uuid not null references public.restaurants(id) on delete restrict,
  card_xp integer not null default 0 check (card_xp >= 0),
  stage text not null default 'discovered'
    check (stage in ('discovered', 'regular', 'house_favorite')),
  visit_count integer not null default 0 check (visit_count >= 0),
  last_visit_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, restaurant_id),
  unique (id, user_id),
  unique (id, user_id, restaurant_id)
);

create table public.receipts (
  id uuid primary key default extensions.gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  restaurant_id uuid not null references public.restaurants(id) on delete restrict,
  receipt_date date not null,
  receipt_number text,
  total_minor bigint not null check (total_minor >= 0),
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  image_path text not null,
  image_hash text,
  fingerprint text,
  extraction_draft jsonb not null default '{}'::jsonb,
  status text not null default 'draft'
    check (status in ('draft', 'confirmed', 'accepted', 'rejected')),
  submission_id uuid,
  created_at timestamptz not null default now(),
  accepted_at timestamptz,
  unique (id, user_id),
  unique (id, user_id, restaurant_id),
  unique (submission_id)
);

create unique index receipts_accepted_image_hash_key
  on public.receipts (image_hash) where status = 'accepted' and image_hash is not null;
create unique index receipts_accepted_fingerprint_key
  on public.receipts (fingerprint) where status = 'accepted' and fingerprint is not null;

create table public.receipt_items (
  id uuid primary key default extensions.gen_random_uuid(),
  receipt_id uuid not null,
  user_id uuid not null,
  restaurant_id uuid not null,
  menu_item_id uuid not null,
  original_text text not null check (length(btrim(original_text)) between 1 and 240),
  quantity integer not null check (quantity > 0),
  created_at timestamptz not null default now(),
  foreign key (receipt_id, user_id, restaurant_id)
    references public.receipts(id, user_id, restaurant_id) on delete cascade,
  foreign key (menu_item_id, restaurant_id)
    references public.menu_items(id, restaurant_id) on delete restrict
);

create table public.visits (
  id uuid primary key default extensions.gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  restaurant_id uuid not null references public.restaurants(id) on delete restrict,
  card_id uuid not null,
  visit_date date not null,
  created_at timestamptz not null default now(),
  unique (user_id, restaurant_id, visit_date),
  unique (id, user_id),
  foreign key (card_id, user_id, restaurant_id)
    references public.cards(id, user_id, restaurant_id) on delete cascade
);

create table public.user_items (
  id uuid primary key default extensions.gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  restaurant_id uuid not null references public.restaurants(id) on delete restrict,
  card_id uuid not null,
  menu_item_id uuid not null,
  first_purchase_date date not null,
  created_at timestamptz not null default now(),
  unique (user_id, restaurant_id, menu_item_id),
  foreign key (card_id, user_id, restaurant_id)
    references public.cards(id, user_id, restaurant_id) on delete cascade,
  foreign key (menu_item_id, restaurant_id)
    references public.menu_items(id, restaurant_id) on delete restrict
);

create table public.reviews (
  id uuid primary key default extensions.gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  restaurant_id uuid not null references public.restaurants(id) on delete restrict,
  card_id uuid not null,
  rating numeric(2,1) check (rating is null or (rating >= 0 and rating <= 5 and rating * 2 = trunc(rating * 2))),
  text text not null default '' check (char_length(text) <= 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, restaurant_id),
  foreign key (card_id, user_id, restaurant_id)
    references public.cards(id, user_id, restaurant_id) on delete cascade
);

create table public.badge_awards (
  user_id uuid not null references auth.users(id) on delete cascade,
  badge_key text not null references public.badges(key) on delete restrict,
  awarded_at timestamptz not null default now(),
  primary key (user_id, badge_key)
);

create table public.title_unlocks (
  user_id uuid not null references auth.users(id) on delete cascade,
  title_key text not null references public.titles(key) on delete restrict,
  unlocked_at timestamptz not null default now(),
  primary key (user_id, title_key)
);

create table public.profile_pins (
  user_id uuid not null references auth.users(id) on delete cascade,
  card_id uuid not null,
  slot smallint not null check (slot between 1 and 3),
  created_at timestamptz not null default now(),
  primary key (user_id, card_id),
  unique (user_id, slot),
  foreign key (card_id, user_id) references public.cards(id, user_id) on delete cascade
);

create table public.reward_events (
  id uuid primary key default extensions.gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  receipt_id uuid,
  event_type text not null check (event_type in ('card_stage', 'badge_award', 'title_unlock')),
  reward_key text not null,
  payload jsonb not null default '{}'::jsonb check (jsonb_typeof(payload) = 'object'),
  viewed_at timestamptz,
  created_at timestamptz not null default now(),
  foreign key (receipt_id, user_id) references public.receipts(id, user_id) on delete cascade,
  unique (user_id, event_type, reward_key)
);

-- The auth trigger never trusts a user-supplied display name. A signup may select
-- only one of the bundled avatar keys; invalid or missing choices use "fork".
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  requested_avatar text := new.raw_user_meta_data ->> 'avatar_key';
begin
  insert into public.profiles (id, display_name, avatar_key)
  values (
    new.id,
    'Foodie',
    case when requested_avatar in ('fork', 'plate', 'bowl', 'noodles', 'taco', 'donut') then requested_avatar else 'fork' end
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger profiles_set_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();
create trigger cards_set_updated_at before update on public.cards
  for each row execute function public.set_updated_at();
create trigger reviews_set_updated_at before update on public.reviews
  for each row execute function public.set_updated_at();

alter table public.profiles enable row level security;
alter table public.restaurants enable row level security;
alter table public.menu_items enable row level security;
alter table public.badges enable row level security;
alter table public.titles enable row level security;
alter table public.cards enable row level security;
alter table public.receipts enable row level security;
alter table public.receipt_items enable row level security;
alter table public.visits enable row level security;
alter table public.user_items enable row level security;
alter table public.reviews enable row level security;
alter table public.badge_awards enable row level security;
alter table public.title_unlocks enable row level security;
alter table public.profile_pins enable row level security;
alter table public.reward_events enable row level security;

create policy restaurants_catalog_read on public.restaurants for select to anon, authenticated using (true);
create policy menu_items_catalog_read on public.menu_items for select to anon, authenticated using (true);
create policy badges_catalog_read on public.badges for select to anon, authenticated using (true);
create policy titles_catalog_read on public.titles for select to anon, authenticated using (true);

create policy profiles_read_own on public.profiles for select to authenticated using (id = (select auth.uid()));
create policy profiles_update_own on public.profiles for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));
create policy cards_read_own on public.cards for select to authenticated using (user_id = (select auth.uid()));
create policy receipts_read_own on public.receipts for select to authenticated using (user_id = (select auth.uid()));
create policy receipt_items_read_own on public.receipt_items for select to authenticated
  using (user_id = (select auth.uid()));
create policy visits_read_own on public.visits for select to authenticated using (user_id = (select auth.uid()));
create policy user_items_read_own on public.user_items for select to authenticated using (user_id = (select auth.uid()));
create policy reviews_read_own on public.reviews for select to authenticated using (user_id = (select auth.uid()));
create policy badge_awards_read_own on public.badge_awards for select to authenticated using (user_id = (select auth.uid()));
create policy title_unlocks_read_own on public.title_unlocks for select to authenticated using (user_id = (select auth.uid()));
create policy profile_pins_read_own on public.profile_pins for select to authenticated using (user_id = (select auth.uid()));
create policy profile_pins_insert_own on public.profile_pins for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy profile_pins_delete_own on public.profile_pins for delete to authenticated
  using (user_id = (select auth.uid()));
create policy reward_events_read_own on public.reward_events for select to authenticated
  using (user_id = (select auth.uid()));

-- Revoke implicit access first, then grant only each client's intended surface.
revoke all on all tables in schema public from public, anon, authenticated;
grant usage on schema public to anon, authenticated;
grant usage on schema public to service_role;
grant all on all tables in schema public to service_role;
grant select on public.restaurants, public.menu_items, public.badges, public.titles to anon, authenticated;
grant select on public.profiles, public.cards, public.receipts, public.receipt_items,
  public.visits, public.user_items, public.reviews, public.badge_awards,
  public.title_unlocks, public.profile_pins, public.reward_events to authenticated;
grant update (display_name, avatar_key) on public.profiles to authenticated;
grant insert, delete on public.profile_pins to authenticated;

-- RPCs are intentionally absent in this foundation migration. Backend calls use
-- the service role until transactional receipt/review functions are implemented.
revoke all on function public.handle_new_user() from public, anon, authenticated;
revoke all on function public.set_updated_at() from public, anon, authenticated;

-- Receipt images are private. The first path segment must be the authenticated
-- user's UUID, for example <uid>/<generated-receipt-id>.jpg.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('receipts', 'receipts', false, 10485760, array['image/jpeg', 'image/png', 'image/webp', 'image/heic'])
on conflict (id) do update set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy receipt_objects_read_own on storage.objects for select to authenticated
  using (bucket_id = 'receipts' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy receipt_objects_insert_own on storage.objects for insert to authenticated
  with check (bucket_id = 'receipts' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy receipt_objects_update_own on storage.objects for update to authenticated
  using (bucket_id = 'receipts' and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id = 'receipts' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy receipt_objects_delete_own on storage.objects for delete to authenticated
  using (bucket_id = 'receipts' and (storage.foldername(name))[1] = (select auth.uid())::text);

revoke all on storage.objects from public, anon;
grant usage on schema storage to authenticated;
grant select, insert, update, delete on storage.objects to authenticated;
grant all on storage.objects to service_role;
