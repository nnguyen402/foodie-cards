import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useCollection } from '../cards/useCollection';
import type { DiscoveryArea } from './discoveryArea';
import { buildMapRestaurants, type MapRestaurant } from './mapRestaurants';
import { mergeNearby } from './mergeNearby';
import { createNearbySource } from './nearbySource';
import type { OsmPlace } from './osm';

export type MapRestaurants = {
  /** Our own catalog and the user's cards are still loading. */
  loading: boolean;
  error: { message: string; retry: () => void } | null;
  /** What the map shows for this area: our restaurants in range, then nearby OpenStreetMap places, capped. */
  restaurants: MapRestaurant[];
  nearby: 'idle' | 'loading' | 'ready' | 'failed';
  retryNearby: () => void;
};

// One client for the whole session, so its cache survives leaving and returning to the tab.
const nearbySource = createNearbySource({ fetcher: (url, init) => fetch(url, init) });

// The one place the map gets its restaurants from: our catalog merged with the signed-in
// user's cards, plus nearby places from OpenStreetMap. Nearby places are fetched only when
// the discovery area changes or the user retries, never from map gestures. Another source
// (for example Places) can replace the nearby part here without touching the map.
export function useMapRestaurants(area: DiscoveryArea | null): MapRestaurants {
  const { state, refresh } = useCollection();
  const [places, setPlaces] = useState<OsmPlace[]>([]);
  const [nearby, setNearby] = useState<MapRestaurants['nearby']>('idle');
  const request = useRef(0);
  const latitude = area?.centre.latitude;
  const longitude = area?.centre.longitude;

  const loadNearby = useCallback(() => {
    if (latitude === undefined || longitude === undefined) return;
    const centre = { latitude, longitude };
    const token = ++request.current;
    const cached = nearbySource.cached(centre);
    if (cached) {
      setPlaces(cached);
      setNearby('ready');
      return;
    }
    // Places already on screen stay there while the new area loads; out-of-range ones are filtered by the merge.
    setNearby('loading');
    nearbySource.load(centre).then(
      (loaded) => {
        if (token !== request.current) return;
        setPlaces(loaded);
        setNearby('ready');
      },
      () => {
        if (token === request.current) setNearby('failed');
      },
    );
  }, [latitude, longitude]);

  useEffect(() => {
    loadNearby();
    return () => { request.current += 1; };
  }, [loadNearby]);

  const catalog = useMemo(() => (state.status === 'ready' ? buildMapRestaurants(state.collection) : []), [state]);
  const restaurants = useMemo(() => (area ? mergeNearby(catalog, places, area) : []), [catalog, places, area]);
  const error = useMemo(() => (state.status === 'error' ? { message: state.message, retry: () => void refresh() } : null), [state, refresh]);

  return { loading: state.status === 'loading', error, restaurants, nearby, retryNearby: loadNearby };
}
