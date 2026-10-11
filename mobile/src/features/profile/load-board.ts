import { supabase } from '@/lib/supabase';
import {
  buildProfileActivity,
  type ActivityCardRow,
  type ActivityDishRow,
  type ActivityReviewRow,
  type ActivityVisitRow,
} from './activity';
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

  const [
    pinsResult,
    cardsResult,
    badgeAwardsResult,
    badgesResult,
    titleUnlocksResult,
    titlesResult,
    visitsResult,
    dishesResult,
    reviewsResult,
  ] = await Promise.all([
    client.from('profile_pins').select('slot,card_id').eq('user_id', userId),
    client.from('cards').select('id,user_id,restaurant_id,stage,restaurants(name,location_label)').eq('user_id', userId),
    client.from('badge_awards').select('badge_key').eq('user_id', userId),
    client.from('badges').select('key,name,description'),
    client.from('title_unlocks').select('title_key').eq('user_id', userId),
    client.from('titles').select('key,name,description'),
    client.from('visits').select('id,user_id').eq('user_id', userId),
    client.from('user_items').select('user_id,restaurant_id,menu_item_id').eq('user_id', userId),
    client
      .from('reviews')
      .select('user_id,card_id,restaurant_id,rating,text,updated_at,restaurants(name)')
      .eq('user_id', userId)
      .order('updated_at', { ascending: false }),
  ]);

  const pins = requireRows(pinsResult as QueryResult<{ slot: number; card_id: string }>, 'Pins');
  const cardRows = requireRows(cardsResult as QueryResult<{
    id: string;
    user_id: string;
    restaurant_id: string;
    stage: string;
    restaurants: unknown;
  }>, 'Cards');
  const cards = cardRows.map((row): OwnedCardRow => {
    const restaurant = restaurantFields(row.restaurants);
    return { id: row.id, stage: row.stage, restaurantName: restaurant.name, locationLabel: restaurant.locationLabel };
  });
  const badgeKeys = requireRows(badgeAwardsResult as QueryResult<{ badge_key: string }>, 'Badges').map((row) => row.badge_key);
  const titleKeys = requireRows(titleUnlocksResult as QueryResult<{ title_key: string }>, 'Titles').map((row) => row.title_key);
  const badges = requireRows(badgesResult as QueryResult<CatalogEntry>, 'Badge catalog');
  const titles = requireRows(titlesResult as QueryResult<CatalogEntry>, 'Title catalog');
  const visits = requireRows(visitsResult as QueryResult<{ id: string; user_id: string }>, 'Visits');
  const dishes = requireRows(dishesResult as QueryResult<{
    user_id: string;
    restaurant_id: string;
    menu_item_id: string;
  }>, 'Dishes');
  const reviewRows = requireRows(reviewsResult as QueryResult<{
    user_id: string;
    card_id: string;
    restaurant_id: string;
    rating: number | string | null;
    text: string;
    updated_at: string;
    restaurants: unknown;
  }>, 'Reviews');
  const activity = buildProfileActivity(userId, {
    cards: cardRows.map((row): ActivityCardRow => ({
      userId: row.user_id,
      restaurantId: row.restaurant_id,
    })),
    visits: visits.map((row): ActivityVisitRow => ({
      userId: row.user_id,
      visitId: row.id,
    })),
    dishes: dishes.map((row): ActivityDishRow => ({
      userId: row.user_id,
      restaurantId: row.restaurant_id,
      menuItemId: row.menu_item_id,
    })),
    reviews: reviewRows.map((row): ActivityReviewRow => ({
      userId: row.user_id,
      cardId: row.card_id,
      restaurantId: row.restaurant_id,
      restaurantName: restaurantFields(row.restaurants).name,
      rating: row.rating,
      text: row.text,
      updatedAt: row.updated_at,
    })),
  });

  return buildProfileBoard({
    pins: pins.map((pin) => ({ slot: pin.slot, cardId: pin.card_id })),
    cards,
    badgeKeys,
    titleKeys,
    badges,
    titles,
    equippedTitleKey,
    statistics: activity.statistics,
    reviews: activity.reviews,
  });
}
