import { supabase } from '@/lib/supabase';
import { buildProfileBoard, type CatalogEntry, type OwnedCardRow, type ProfileBoard } from './board';

type QueryError = { message: string };
type QueryResult<T> = { data: T[] | null; error: QueryError | null };

function restaurantFields(value: unknown): { name: string | null; locationLabel: string | null } {
  const row = Array.isArray(value) ? value[0] : value;
  if (!row || typeof row !== 'object') return { name: null, locationLabel: null };
  const record = row as Record<string, unknown>;
  return {
    name: typeof record.name === 'string' ? record.name : null,
    locationLabel: typeof record.location_label === 'string' ? record.location_label : null,
  };
}

function requireRows<T>(result: QueryResult<T>, label: string): T[] {
  if (result.error) throw new Error(result.error.message || `${label} could not be loaded.`);
  return result.data ?? [];
}

export async function loadProfileBoard(userId: string, equippedTitleKey: string | null): Promise<ProfileBoard> {
  if (!supabase) throw new Error('Supabase is not configured.');
  const client = supabase;

  const [pinsResult, cardsResult, badgeAwardsResult, badgesResult, titleUnlocksResult, titlesResult] = await Promise.all([
    client.from('profile_pins').select('slot,card_id').eq('user_id', userId),
    client.from('cards').select('id,stage,restaurants(name,location_label)').eq('user_id', userId),
    client.from('badge_awards').select('badge_key').eq('user_id', userId),
    client.from('badges').select('key,name,description'),
    client.from('title_unlocks').select('title_key').eq('user_id', userId),
    client.from('titles').select('key,name,description'),
  ]);

  const pins = requireRows(pinsResult as QueryResult<{ slot: number; card_id: string }>, 'Pins');
  const cards = requireRows(cardsResult as QueryResult<{ id: string; stage: string; restaurants: unknown }>, 'Cards').map((row): OwnedCardRow => {
    const restaurant = restaurantFields(row.restaurants);
    return { id: row.id, stage: row.stage, restaurantName: restaurant.name, locationLabel: restaurant.locationLabel };
  });
  const badgeKeys = requireRows(badgeAwardsResult as QueryResult<{ badge_key: string }>, 'Badges').map((row) => row.badge_key);
  const titleKeys = requireRows(titleUnlocksResult as QueryResult<{ title_key: string }>, 'Titles').map((row) => row.title_key);
  const badges = requireRows(badgesResult as QueryResult<CatalogEntry>, 'Badge catalog');
  const titles = requireRows(titlesResult as QueryResult<CatalogEntry>, 'Title catalog');

  return buildProfileBoard({
    pins: pins.map((pin) => ({ slot: pin.slot, cardId: pin.card_id })),
    cards,
    badgeKeys,
    titleKeys,
    badges,
    titles,
    equippedTitleKey,
  });
}
