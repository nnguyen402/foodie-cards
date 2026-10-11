import { useEffect, useState } from 'react';
import * as Location from 'expo-location';
import type { Coordinate } from './coordinates';

export type UserLocation = { status: 'pending' | 'granted' | 'denied'; coordinate: Coordinate | null };

// Asks once for while-in-use location. A refusal or a failed fix is not an error: the map falls back to downtown.
export function useUserLocation(): UserLocation {
  const [location, setLocation] = useState<UserLocation>({ status: 'pending', coordinate: null });

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const permission = await Location.requestForegroundPermissionsAsync();
        if (!active) return;
        if (!permission.granted) return setLocation({ status: 'denied', coordinate: null });
        const fix = (await Location.getLastKnownPositionAsync()) ?? (await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }));
        if (active) setLocation({ status: 'granted', coordinate: { latitude: fix.coords.latitude, longitude: fix.coords.longitude } });
      } catch {
        if (active) setLocation((current) => (current.status === 'pending' ? { status: 'denied', coordinate: null } : current));
      }
    })();
    return () => { active = false; };
  }, []);

  return location;
}
