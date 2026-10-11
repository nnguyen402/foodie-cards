-- THROWAWAY demo stopgap, follow-up to stopgap-chick-fil-a.sql. Run by hand in the Supabase SQL editor
-- (the user or Nathan); the agent never runs it. Safe to re-run: aliases are unioned, the insert upserts.
--
-- Why: the server accepts a receipt line only when its confirmed name (the "Dish or drink name" field),
-- trimmed, whitespace-collapsed and lower-cased, equals a menu item's canonical_name or one of its aliases
-- (server/src/receipts/submit.ts, canonicalizeReceiptItems). It never looks at the printed receipt text.
-- An alias may belong to only one item per restaurant, or the whole receipt is rejected as ambiguous.
-- Write aliases in lower case.

-- A generic sauce item for the $0 sauce lines (CFA Sauce, Hny Rst BBQ, ...).
insert into public.menu_items (id, restaurant_id, canonical_name, aliases)
values
  ('20000000-0000-4000-8000-000000000023', '10000000-0000-4000-8000-000000000006', 'Sauce',
   array['sauce', 'cfa sauce', 'chick-fil-a sauce', 'hny rst bbq', 'hny rst bbq sauce', 'honey roasted bbq', 'honey roasted bbq sauce', 'bbq sauce', 'polynesian sauce', 'garden herb ranch sauce'])
on conflict (id) do update set
  restaurant_id = excluded.restaurant_id,
  canonical_name = excluded.canonical_name,
  aliases = excluded.aliases;

-- Receipt abbreviations for the existing items: add to the alias list, keep what is already there.
update public.menu_items m
set aliases = (select array_agg(distinct a order by a) from unnest(m.aliases || v.extra) as a)
from (values
  -- Spicy Dlx, including what the reader produced on the demo receipt: "SpcyDlx +PJ".
  -- (The reader's spelling can change between uploads of the same photo.)
  ('20000000-0000-4000-8000-000000000017'::uuid, array['spicy dlx', 'spicy dlx meal', 'spicy dlx sandwich', 'spicy deluxe sandwich', 'spicy chicken dlx', 'spcydlx', 'spcydlx +pj', 'spcy dlx', 'spcy dlx +pj', 'spicy dlx +pj', 'spcydlx meal', 'spcydlx sandwich']),
  -- Plain chicken sandwich, deluxe
  ('20000000-0000-4000-8000-000000000016'::uuid, array['chicken dlx', 'chicken sandwich dlx', 'dlx sandwich', 'dlx chicken sandwich', 'deluxe chicken sandwich']),
  -- Nug 8ct
  ('20000000-0000-4000-8000-000000000018'::uuid, array['nug', 'nug 8ct', 'nug 8 ct', 'nug 12ct', 'nug 12 ct', 'nuggets 8ct', 'nuggets 12ct', '8ct nuggets', '12ct nuggets', 'chicken nuggets 8ct', 'chicken nuggets 12ct']),
  -- Fries
  -- (the demo receipt produced "Fries MD")
  ('20000000-0000-4000-8000-000000000019'::uuid, array['fries', 'waffle fry', 'med fries', 'medium fries', 'lg fries', 'large fries', 'sm fries', 'small fries', 'fries md', 'fries lg', 'fries sm', 'fries med', 'fries large', 'fries small', 'fries medium', 'md fries'])
) as v(id, extra)
where m.id = v.id
  and m.restaurant_id = '10000000-0000-4000-8000-000000000006';
