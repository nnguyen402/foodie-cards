import { useMemo } from 'react';
import { useCollection } from '../cards/useCollection';
import { buildMapRestaurants, type MapRestaurant } from './mapRestaurants';

export type MapRestaurantsState =
  | { status: 'loading' }
  | { status: 'error'; message: string; retry: () => void }
  | { status: 'ready'; restaurants: MapRestaurant[] };

// The one place the map gets its restaurants from: our own catalog merged with the signed-in
// user's cards. A Places-backed source can replace this hook later without touching the map.
// Restaurants the backend adds will appear once the catalog carries coordinates for them.
export function useMapRestaurants(): MapRestaurantsState {
  const { state, refresh } = useCollection();
  return useMemo(() => {
    if (state.status === 'loading') return { status: 'loading' };
    if (state.status === 'error') return { status: 'error', message: state.message, retry: () => void refresh() };
    return { status: 'ready', restaurants: buildMapRestaurants(state.collection) };
  }, [state, refresh]);
}
