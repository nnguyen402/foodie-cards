import { DEMO_FIXTURE_LABEL } from '@foodie-cards/shared/fixtures';
import type { RestaurantStage } from '@foodie-cards/shared';
import type { CardView } from './types';

/** Synthetic cards for the dev gallery only. Never shown in a live collection and never awarded. */
export const CARD_FIXTURE_LABEL = DEMO_FIXTURE_LABEL;

// Mirrors supabase/seed.sql so the gallery shows the real demo themes.
const restaurants: CardView['restaurant'][] = [
  { id: '10000000-0000-4000-8000-000000000001', name: 'Busy Bee Café', locationLabel: 'West End · 810 Martin Luther King Jr Dr SW', category: 'soul_food', theme: { primaryColor: '#6E3C2F', accentColor: '#E2A94F', fontKey: 'friendly', patternKey: 'paper' }, heroImagePath: null, heroImageKind: null },
  { id: '10000000-0000-4000-8000-000000000002', name: 'Fox Bros Bar-B-Q', locationLabel: 'Candler Park · 1238 DeKalb Ave NE', category: 'barbecue', theme: { primaryColor: '#38261F', accentColor: '#D97942', fontKey: 'bold', patternKey: 'lines' }, heroImagePath: null, heroImageKind: null },
  { id: '10000000-0000-4000-8000-000000000003', name: 'Mary Mac’s Tea Room', locationLabel: 'Midtown · 224 Ponce de Leon Ave NE', category: 'southern', theme: { primaryColor: '#6F4D45', accentColor: '#D5B37A', fontKey: 'elegant', patternKey: 'paper' }, heroImagePath: null, heroImageKind: null },
  { id: '10000000-0000-4000-8000-000000000004', name: 'The Varsity', locationLabel: 'Downtown · 61 North Ave NW', category: 'burger', theme: { primaryColor: '#9E1B32', accentColor: '#F2C94C', fontKey: 'bold', patternKey: 'dots' }, heroImagePath: null, heroImageKind: null },
  { id: '10000000-0000-4000-8000-000000000005', name: 'Antico Pizza', locationLabel: 'West Midtown · 1093 Hemphill Ave NW', category: 'pizza', theme: { primaryColor: '#3D5138', accentColor: '#D58B4A', fontKey: 'friendly', patternKey: 'none' }, heroImagePath: null, heroImageKind: null },
];

const stageProgress: Record<RestaurantStage, Pick<CardView, 'cardXP' | 'visitCount' | 'lastVisitDate'>> = {
  discovered: { cardXP: 140, visitCount: 1, lastVisitDate: '2026-09-20' },
  regular: { cardXP: 330, visitCount: 3, lastVisitDate: '2026-10-04' },
  house_favorite: { cardXP: 790, visitCount: 6, lastVisitDate: '2026-10-09' },
};

// Covers unrated, zero stars and half stars so the gallery shows each rating state.
const ratings: (number | null)[] = [4.5, null, 0, 3, 5];

export function fixtureCards(stage: RestaurantStage): CardView[] {
  return restaurants.map((restaurant, index) => ({
    id: `demo-card-${stage}-${index + 1}`,
    stage,
    ...stageProgress[stage],
    rating: ratings[index],
    restaurant,
  }));
}
