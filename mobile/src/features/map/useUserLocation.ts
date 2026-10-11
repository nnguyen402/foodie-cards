import { useCallback, useEffect, useMemo, useState } from 'react';
import * as Location from 'expo-location';
import type { Coordinate } from './coordinates';

export type UserLocation = UserPosition & {
  /** Reads the position again on request. Resolves to null when location is not available. */
  refresh: () => Promise<Coordinate | null>;
};

type UserPosition = {
  status: 'pending' | 'granted' | 'denied';
  coordinate: Coordinate | null;
  /** "Atlanta, GA" from the device's own geocoder, when it can name the place. */
  placeName: string | null;
};

export async function placeNameOf(coordinate: Coordinate): Promise<string | null> {
  try {
    const [place] = await Location.reverseGeocodeAsync(coordinate);
    const parts = [place?.city ?? place?.district ?? place?.subregion, place?.region].filter(Boolean);
    return parts.length > 0 ? parts.join(', ') : null;
  } catch {
    return null;
  }
}

// Asks once for while-in-use location. A refusal or a failed fix is not an error: the map falls back to downtown.
export function useUserLocation(): UserLocation {
  const [location, setLocation] = useState<UserPosition>({ status: 'pending', coordinate: null, placeName: null });

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const permission = await Location.requestForegroundPermissionsAsync();
        if (!active) return;
        if (!permission.granted) return setLocation({ status: 'denied', coordinate: null, placeName: null });
        const fix = (await Location.getLastKnownPositionAsync()) ?? (await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }));
        const coordinate = { latitude: fix.coords.latitude, longitude: fix.coords.longitude };
        if (!active) return;
        setLocation({ status: 'granted', coordinate, placeName: null });
        const placeName = await placeNameOf(coordinate);
        if (active && placeName) setLocation({ status: 'granted', coordinate, placeName });
      } catch {
        if (active) setLocation((current) => (current.status === 'pending' ? { status: 'denied', coordinate: null, placeName: null } : current));
      }
    })();
    return () => { active = false; };
  }, []);

  const refresh = useCallback(async () => {
    try {
      const permission = await Location.getForegroundPermissionsAsync();
      if (!permission.granted) return null;
      const fix = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const coordinate = { latitude: fix.coords.latitude, longitude: fix.coords.longitude };
      setLocation((current) => ({ status: 'granted', coordinate, placeName: current.placeName }));
      void placeNameOf(coordinate).then((placeName) => {
        if (placeName) setLocation((current) => (current.coordinate === coordinate ? { ...current, placeName } : current));
      });
      return coordinate;
    } catch {
      return null;
    }
  }, []);

  return useMemo(() => ({ ...location, refresh }), [location, refresh]);
}
