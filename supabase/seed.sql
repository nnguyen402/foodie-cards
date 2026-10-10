-- Small curated demo catalog. These are catalog examples, not a price database
-- or a claim that a dish remains on a restaurant's live menu.
insert into public.restaurants (id, slug, name, location_label, category, aliases, theme)
values
  (
    '10000000-0000-4000-8000-000000000001', 'busy-bee-cafe-west-end', 'Busy Bee Café', 'West End · 810 Martin Luther King Jr Dr SW', 'soul_food',
    array['The Busy Bee', 'Busy Bee Cafe', 'Busy Bee Café'],
    '{"primaryColor":"#6E3C2F","accentColor":"#E2A94F","fontKey":"friendly","patternKey":"paper"}'::jsonb
  ),
  (
    '10000000-0000-4000-8000-000000000002', 'fox-bros-bbq-dekalb-ave', 'Fox Bros Bar-B-Q', 'Candler Park · 1238 DeKalb Ave NE', 'barbecue',
    array['Fox Bros', 'Fox Brothers Barbecue', 'Fox Bros BBQ'],
    '{"primaryColor":"#38261F","accentColor":"#D97942","fontKey":"bold","patternKey":"lines"}'::jsonb
  ),
  (
    '10000000-0000-4000-8000-000000000003', 'mary-macs-tea-room', 'Mary Mac’s Tea Room', 'Midtown · 224 Ponce de Leon Ave NE', 'southern',
    array['Mary Macs', 'Mary Mac’s', 'Mary MacKenzie’s Tea Room'],
    '{"primaryColor":"#6F4D45","accentColor":"#D5B37A","fontKey":"elegant","patternKey":"paper"}'::jsonb
  ),
  (
    '10000000-0000-4000-8000-000000000004', 'the-varsity-atlanta', 'The Varsity', 'Downtown · 61 North Ave NW', 'fast_food',
    array['Varsity', 'The Varsity Atlanta'],
    '{"primaryColor":"#9E1B32","accentColor":"#F2C94C","fontKey":"bold","patternKey":"dots"}'::jsonb
  ),
  (
    '10000000-0000-4000-8000-000000000005', 'antico-pizza-west-midtown', 'Antico Pizza', 'West Midtown · 1093 Hemphill Ave NW', 'pizza',
    array['Antico', 'Antico Pizza Napoletana', 'Antico Casa'],
    '{"primaryColor":"#3D5138","accentColor":"#D58B4A","fontKey":"friendly","patternKey":"none"}'::jsonb
  )
on conflict (slug) do update set
  name = excluded.name,
  location_label = excluded.location_label,
  category = excluded.category,
  aliases = excluded.aliases,
  theme = excluded.theme;

insert into public.menu_items (id, restaurant_id, canonical_name, aliases)
values
  ('20000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', 'Fried chicken', array['fried chicken', 'honey chicken']),
  ('20000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000001', 'Macaroni and cheese', array['mac and cheese', 'macaroni & cheese']),
  ('20000000-0000-4000-8000-000000000003', '10000000-0000-4000-8000-000000000001', 'Peach cobbler', array['peach cobbler']),
  ('20000000-0000-4000-8000-000000000004', '10000000-0000-4000-8000-000000000002', 'Smoked wings', array['smoked chicken wings', 'wings']),
  ('20000000-0000-4000-8000-000000000005', '10000000-0000-4000-8000-000000000002', 'Pulled pork sandwich', array['pulled pork', 'pulled pork sandwich']),
  ('20000000-0000-4000-8000-000000000006', '10000000-0000-4000-8000-000000000002', 'Texas Fries', array['texas fries']),
  ('20000000-0000-4000-8000-000000000007', '10000000-0000-4000-8000-000000000003', 'Chicken and dumplings', array['chicken & dumplings', 'chicken dumplings']),
  ('20000000-0000-4000-8000-000000000008', '10000000-0000-4000-8000-000000000003', 'Fried green tomatoes', array['green tomatoes']),
  ('20000000-0000-4000-8000-000000000009', '10000000-0000-4000-8000-000000000003', 'Peach cobbler', array['peach cobbler']),
  ('20000000-0000-4000-8000-000000000010', '10000000-0000-4000-8000-000000000004', 'Chili dog', array['chili dogs', 'Varsity dog']),
  ('20000000-0000-4000-8000-000000000011', '10000000-0000-4000-8000-000000000004', 'Onion rings', array['rings']),
  ('20000000-0000-4000-8000-000000000012', '10000000-0000-4000-8000-000000000004', 'Frosted Orange', array['frosted orange']),
  ('20000000-0000-4000-8000-000000000013', '10000000-0000-4000-8000-000000000005', 'Margherita pizza', array['margherita', 'margherita pizza']),
  ('20000000-0000-4000-8000-000000000014', '10000000-0000-4000-8000-000000000005', 'San Gennaro pizza', array['San Gennaro']),
  ('20000000-0000-4000-8000-000000000015', '10000000-0000-4000-8000-000000000005', 'Diavola pizza', array['Diavola'])
on conflict (id) do update set
  restaurant_id = excluded.restaurant_id,
  canonical_name = excluded.canonical_name,
  aliases = excluded.aliases;

insert into public.badges (key, name, description, account_xp_reward)
values
  ('first_bite', 'First Bite', 'Open your first restaurant card.', 50),
  ('cafe_crawler', 'Café Crawler', 'Collect cards from three different cafés.', 50),
  ('menu_explorer', 'Menu Explorer', 'Try ten distinct restaurant and dish combinations.', 50),
  ('loyal_regular', 'Loyal Regular', 'Reach House Favorite at a restaurant.', 50),
  ('first_impressions', 'First Impressions', 'Write your first restaurant review.', 50),
  ('food_critic', 'Food Critic', 'Write reviews for ten restaurants.', 50),
  ('seasoned_reviewer', 'Seasoned Reviewer', 'Write reviews for twenty-five restaurants.', 50),
  ('critics_club', 'Critic’s Club', 'Write reviews for fifty restaurants.', 50)
on conflict (key) do update set
  name = excluded.name,
  description = excluded.description,
  account_xp_reward = excluded.account_xp_reward;

insert into public.titles (key, name, description)
values
  ('cafe_crawler', 'Café Crawler', 'Unlocked by collecting three different café cards.'),
  ('menu_explorer', 'Menu Explorer', 'Unlocked by trying ten distinct restaurant and dish combinations.'),
  ('loyal_regular', 'Loyal Regular', 'Unlocked by reaching House Favorite at a restaurant.'),
  ('food_critic', 'Food Critic', 'Unlocked by writing reviews for ten restaurants.'),
  ('seasoned_reviewer', 'Seasoned Reviewer', 'Unlocked by writing reviews for twenty-five restaurants.'),
  ('critics_club', 'Critic’s Club', 'Unlocked by writing reviews for fifty restaurants.'),
  ('ultra_foodie', 'Ultra Foodie', 'Unlocked at account level five.'),
  ('mega_food_crawler', 'Mega Food Crawler', 'Unlocked after collecting twenty restaurant cards.')
on conflict (key) do update set
  name = excluded.name,
  description = excluded.description;
