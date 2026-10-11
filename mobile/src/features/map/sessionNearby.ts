import AsyncStorage from '@react-native-async-storage/async-storage';
import { createNearbySource } from './nearbySource';

// One Overpass client for the whole session, shared by the map and the receipt confirm screen,
// so its cache and rate-limit rests survive leaving and returning to either.
export const sessionNearby = createNearbySource({ fetcher: (url, init) => fetch(url, init), storage: AsyncStorage, log: (message) => console.warn(message) });
