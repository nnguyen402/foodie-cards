-- THROWAWAY demo stopgap. Not part of the real catalog.
-- Run this by hand in the Supabase SQL editor (the user or Nathan). The agent never runs it.
-- Delete the rows (and this file) once the place-based backend lands.
-- Safe to re-run: both inserts upsert.
insert into public.restaurants (id, slug, name, location_label, category, aliases, theme)
values
  (
    '10000000-0000-4000-8000-000000000006', 'chick-fil-a-atlanta', 'Chick-fil-A', 'Atlanta', 'chicken',
    array['Chick-fil-A', 'Chick fil A', 'Chickfila', 'CFA'],
    '{"primaryColor":"#8A3B2E","accentColor":"#E8B85C","fontKey":"friendly","patternKey":"paper"}'::jsonb
  )
on conflict (slug) do update set
  name = excluded.name,
  location_label = excluded.location_label,
  category = excluded.category,
  aliases = excluded.aliases,
  theme = excluded.theme;

insert into public.menu_items (id, restaurant_id, canonical_name, aliases)
values
  ('20000000-0000-4000-8000-000000000016', '10000000-0000-4000-8000-000000000006', 'Chicken sandwich', array['chicken sandwich', 'chick-fil-a chicken sandwich', 'chicken sandwich meal', 'deluxe sandwich']),
  ('20000000-0000-4000-8000-000000000017', '10000000-0000-4000-8000-000000000006', 'Spicy chicken sandwich', array['spicy chicken sandwich', 'spicy sandwich', 'spicy deluxe', 'spicy chicken sandwich meal']),
  ('20000000-0000-4000-8000-000000000018', '10000000-0000-4000-8000-000000000006', 'Chicken nuggets', array['nuggets', '8 ct nuggets', '12 ct nuggets', '8 count nuggets', 'nugget meal']),
  ('20000000-0000-4000-8000-000000000019', '10000000-0000-4000-8000-000000000006', 'Waffle fries', array['waffle potato fries', 'waffle fries', 'medium waffle fries', 'large waffle fries']),
  ('20000000-0000-4000-8000-000000000020', '10000000-0000-4000-8000-000000000006', 'Lemonade', array['lemonade', 'freshly squeezed lemonade', 'diet lemonade', 'frozen lemonade']),
  ('20000000-0000-4000-8000-000000000021', '10000000-0000-4000-8000-000000000006', 'Sweet tea', array['sweet tea', 'iced tea sweet', 'sweetened iced tea']),
  ('20000000-0000-4000-8000-000000000022', '10000000-0000-4000-8000-000000000006', 'Milkshake', array['milkshake', 'chocolate milkshake', 'vanilla milkshake', 'cookies & cream milkshake', 'strawberry milkshake'])
on conflict (id) do update set
  restaurant_id = excluded.restaurant_id,
  canonical_name = excluded.canonical_name,
  aliases = excluded.aliases;
