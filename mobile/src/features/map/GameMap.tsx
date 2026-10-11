import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text } from '@/components/ui/reusables/text';
import { useRouter } from 'expo-router';
import MapView, { Circle, Marker } from 'react-native-maps';
import { useReducedMotion } from 'react-native-reanimated';
import { MessagePanel } from '@/components/ui/message-panel';
import { spacing } from '@/theme/tokens';
import { DISCOVERY_RADIUS_METRES, areaLabel, discoveryArea, distanceLabel, offerSearchHere, type DiscoveryArea } from './discoveryArea';
import { circleRing } from './fog';
import { MapCardPopup } from './MapCardPopup';
import { MapAtmosphere } from './MapAtmosphere';
import { MapHud } from './MapHud';
import { brandTotals, type MapRestaurant } from './mapRestaurants';
import { animatedPinIds, type Region } from './pinMotion';
import { PIN_CENTRE_OFFSET, PIN_POP_MS, RestaurantPin } from './RestaurantPin';
import { RestaurantSheet } from './RestaurantSheet';
import { areaKey, useMapRestaurants } from './useMapRestaurants';
import { placeNameOf, useUserLocation } from './useUserLocation';
import type { Coordinate } from './coordinates';

// The camera looks straight down from high above, then drops to frame the discovery circle.
// Apple Maps reads altitude, Google Maps reads zoom.
const HIGH = { altitude: 90000, zoom: 9.5 };
// Start the fly-in even if the location prompt is still open.
const LOCATION_WAIT_MS = 2500;
const NIGHT = '#120e0b';
// Room for the HUD above and the tab bar and preview card below when framing the circle.
const FRAME_PADDING = { top: 190, right: 28, bottom: 130, left: 28 };

// The pill waits for the map to be still this long, so it does not flicker while panning.
const PILL_DEBOUNCE_MS = 350;

const OSM_COPYRIGHT_URL = 'https://www.openstreetmap.org/copyright';

type PinMarkerProps = { restaurant: MapRestaurant; animate: boolean; popping: boolean; selected: boolean; distance: string | null; onOpen: (restaurant: MapRestaurant) => void };

// Memoised so that selecting one token, or the map reporting a new region, does not redraw the other markers.
const PinMarker = memo(function PinMarker({ restaurant, animate, popping, selected, distance, onOpen }: PinMarkerProps) {
  return (
    <Marker
      coordinate={restaurant.coordinate}
      centerOffset={{ x: 0, y: PIN_CENTRE_OFFSET }}
      // Only a moving token is tracked; a still one is drawn once.
      tracksViewChanges={animate || popping}
      zIndex={selected ? 3 : restaurant.card ? 2 : 1}
      accessibilityLabel={`${restaurant.name}, ${restaurant.card ? 'collected' : 'not collected yet'}`}
      onPress={(event) => {
        event.stopPropagation();
        onOpen(restaurant);
      }}
    >
      <RestaurantPin restaurant={restaurant} animate={animate} popping={popping} distance={distance} />
    </Marker>
  );
});

const flat = (centre: { latitude: number; longitude: number }, height: { altitude: number; zoom: number }) => ({ center: centre, pitch: 0, heading: 0, ...height });

export function GameMap() {
  const router = useRouter();
  const reducedMotion = useReducedMotion();
  const location = useUserLocation();
  const insets = useSafeAreaInsets();
  const map = useRef<MapView>(null);
  const framed = useRef<DiscoveryArea | null>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const [mapReady, setMapReady] = useState(false);
  const [waited, setWaited] = useState(false);
  const [region, setRegion] = useState<Region | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [poppingId, setPoppingId] = useState<string | null>(null);
  const [cardOpen, setCardOpen] = useState(false);
  const [collectedOnly, setCollectedOnly] = useState(false);
  // Set from the first location result. After that it only moves on "Search this area" or recenter, never on map gestures.
  const [area, setArea] = useState<DiscoveryArea | null>(null);
  // The name of a searched area, once geocoded; null while the area is still the player's own.
  const [searched, setSearched] = useState<{ name: string | null } | null>(null);
  const [mapCentre, setMapCentre] = useState<Coordinate | null>(null);
  const [pillWanted, setPillWanted] = useState(false);
  const [searchingKey, setSearchingKey] = useState<string | null>(null);
  const [recentering, setRecentering] = useState(false);
  const geocode = useRef(0);
  const data = useMapRestaurants(area);
  const shownArea = area ?? discoveryArea(null);
  const searching = searchingKey !== null && searchingKey === areaKey(area) && data.settledFor !== searchingKey;
  const nearby = data.restaurants;
  const brands = useMemo(() => brandTotals(nearby), [nearby]);
  const restaurants = useMemo(() => (collectedOnly ? nearby.filter((restaurant) => restaurant.card) : nearby), [nearby, collectedOnly]);
  const player = area && !area.fallback ? location.coordinate : null;
  const initialCamera = useRef(flat(discoveryArea(null).centre, HIGH)).current;

  useEffect(() => {
    if (area || (location.status === 'pending' && !waited)) return;
    setArea(discoveryArea(location.coordinate));
  }, [area, location.status, location.coordinate, waited]);

  useEffect(() => {
    const wait = setTimeout(() => setWaited(true), LOCATION_WAIT_MS);
    return () => {
      clearTimeout(wait);
      timers.current.forEach(clearTimeout);
    };
  }, []);

  // Intro: one straight zoom from high above down to the whole discovery circle. Runs again only when the area is moved.
  useEffect(() => {
    if (framed.current === area || !mapReady || !area) return;
    framed.current = area;
    map.current?.fitToCoordinates(circleRing(area.centre, DISCOVERY_RADIUS_METRES, 12), { edgePadding: FRAME_PADDING, animated: !reducedMotion });
  }, [mapReady, area, reducedMotion]);

  // Debounced: the pill follows where the map has come to rest, not where it is mid-pan.
  useEffect(() => {
    if (!area || !mapCentre) return;
    const wanted = offerSearchHere(mapCentre, area);
    const timer = setTimeout(() => setPillWanted(wanted), PILL_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [area, mapCentre]);

  const animated = useMemo(() => (reducedMotion ? new Set<string>() : animatedPinIds(restaurants, region)), [reducedMotion, restaurants, region]);
  const selected = restaurants.find((restaurant) => restaurant.id === selectedId) ?? null;
  // Moves the 5 km circle to where the map is looking and fetches there. The camera stays put.
  const searchHere = useCallback(() => {
    if (!mapCentre) return;
    const next = { centre: mapCentre, fallback: false };
    const token = ++geocode.current;
    framed.current = next;
    setSelectedId(null);
    setSearched({ name: null });
    setSearchingKey(areaKey(next));
    setPillWanted(false);
    setArea(next);
    void placeNameOf(mapCentre).then((name) => {
      if (token === geocode.current) setSearched({ name });
    });
  }, [mapCentre]);

  // Back to the player: a fresh fix, then the circle moves there and the camera frames it.
  const recenter = useCallback(async () => {
    setRecentering(true);
    try {
      const coordinate = await location.refresh();
      if (coordinate) {
        geocode.current += 1;
        setSelectedId(null);
        setSearched(null);
        setSearchingKey(null);
        setArea({ centre: coordinate, fallback: false });
      }
    } finally {
      setRecentering(false);
    }
  }, [location]);

  const openPin = useCallback((restaurant: MapRestaurant) => {
    setCardOpen(false);
    if (reducedMotion) return setSelectedId(restaurant.id);
    setPoppingId(restaurant.id);
    // The sheet follows the pop rather than covering it.
    timers.current.push(setTimeout(() => setSelectedId(restaurant.id), PIN_POP_MS * 0.55));
    timers.current.push(setTimeout(() => setPoppingId((current) => (current === restaurant.id ? null : current)), PIN_POP_MS + 60));
  }, [reducedMotion]);

  return (
    <View style={styles.screen}>
      <MapView
        ref={map}
        style={StyleSheet.absoluteFill}
        initialCamera={initialCamera}
        mapType="mutedStandard"
        userInterfaceStyle="dark"
        showsPointsOfInterests={false}
        pointsOfInterestFilter={[]}
        showsBuildings={false}
        showsTraffic={false}
        showsIndoors={false}
        showsCompass={false}
        showsScale={false}
        showsMyLocationButton={false}
        toolbarEnabled={false}
        pitchEnabled={false}
        rotateEnabled={false}
        showsUserLocation={location.status === 'granted'}
        onMapReady={() => setMapReady(true)}
        onRegionChangeComplete={(next) => {
          setRegion(next);
          setMapCentre({ latitude: next.latitude, longitude: next.longitude });
        }}
        onPress={() => setSelectedId(null)}
      >
        {area ? (
          <Circle center={area.centre} radius={DISCOVERY_RADIUS_METRES} strokeWidth={2} strokeColor="rgba(242,182,50,0.55)" fillColor="rgba(242,182,50,0.04)" />
        ) : null}
        {restaurants.map((restaurant) => {
          const distance = distanceLabel(player, restaurant.coordinate);
          return (
            <PinMarker
              // A still marker is drawn once, so it is remounted when what it shows changes.
              key={`${restaurant.id}-${restaurant.card?.stage ?? 'locked'}-${distance ?? ''}`}
              restaurant={restaurant}
              animate={animated.has(restaurant.id)}
              popping={poppingId === restaurant.id}
              selected={restaurant.id === selectedId}
              distance={distance}
              onOpen={openPin}
            />
          );
        })}
      </MapView>

      <MapAtmosphere />
      <MapHud
        discovered={brands.discovered}
        total={brands.total}
        areaLabel={areaLabel(shownArea, searched ? searched.name ?? 'Selected area' : location.placeName)}
        collectedOnly={collectedOnly}
        onToggleCollectedOnly={() => {
          setSelectedId(null);
          setCollectedOnly((current) => !current);
        }}
        onRecenter={location.status === 'granted' ? () => void recenter() : null}
        recentering={recentering}
        searchPill={{ visible: pillWanted || searching, searching, onPress: searchHere }}
        nearby={data.nearby}
        onRetryNearby={data.retryNearby}
      />

      {data.loading ? <View pointerEvents="none" style={styles.loading}><ActivityIndicator color="#f2b632" accessibilityLabel="Loading your restaurants" /></View> : null}
      {data.error && !selected ? (
        <View style={styles.error}>
          <MessagePanel title="Your collection did not load" body={data.error.message} kind="error" actionLabel="Try again" onAction={data.error.retry} />
        </View>
      ) : null}

      <Pressable
        accessibilityRole="link"
        accessibilityLabel="Map data copyright OpenStreetMap contributors. Opens the licence page."
        onPress={() => void Linking.openURL(OSM_COPYRIGHT_URL)}
        hitSlop={{ top: 14, bottom: 14, left: 10, right: 10 }}
        style={[styles.attribution, { bottom: insets.bottom + 56 }]}
      >
        <Text allowFontScaling={false} className="text-[10px] font-semibold" style={{ color: '#f6ede2' }}>© OpenStreetMap contributors</Text>
      </Pressable>

      {!data.loading && !data.error && data.nearby !== 'loading' && area && restaurants.length === 0 ? (
        <View pointerEvents="none" style={styles.empty}>
          <Text className="text-center text-sm font-semibold" style={{ color: '#f6ede2' }}>
            {collectedOnly ? 'No collected restaurants within 5 km yet.' : data.nearby === 'failed' ? 'Nearby restaurants could not be loaded, and none of ours are within 5 km.' : 'OpenStreetMap lists no restaurants within 5 km of here.'}
          </Text>
        </View>
      ) : null}

      {selected && !cardOpen ? (
        <RestaurantSheet
          restaurant={selected}
          distance={distanceLabel(player, selected.coordinate)}
          onOpenCard={() => setCardOpen(true)}
          onClose={() => setSelectedId(null)}
          onScan={() => {
            setSelectedId(null);
            router.push('/scan');
          }}
          onViewCard={(cardId) => {
            setSelectedId(null);
            router.push(`/card/${cardId}`);
          }}
        />
      ) : null}
      {selected && cardOpen ? (
        <MapCardPopup
          restaurant={selected}
          onClose={() => setCardOpen(false)}
          onScan={() => {
            setCardOpen(false);
            setSelectedId(null);
            router.push('/scan');
          }}
          onViewCard={(cardId) => {
            setCardOpen(false);
            setSelectedId(null);
            router.push(`/card/${cardId}`);
          }}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: NIGHT },
  loading: { position: 'absolute', left: 0, right: 0, bottom: 120, alignItems: 'center' },
  error: { position: 'absolute', left: spacing.page, right: spacing.page, bottom: 120 },
  attribution: { position: 'absolute', right: 10, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, backgroundColor: 'rgba(18,14,11,0.78)' },
  empty: { position: 'absolute', left: spacing.page, right: spacing.page, bottom: 150, padding: spacing.md, borderRadius: 16, backgroundColor: 'rgba(18,14,11,0.88)' },
});
