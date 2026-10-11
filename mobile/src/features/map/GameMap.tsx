import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { Text } from '@/components/ui/reusables/text';
import { useRouter } from 'expo-router';
import MapView, { Circle, Marker } from 'react-native-maps';
import { useReducedMotion } from 'react-native-reanimated';
import { MessagePanel } from '@/components/ui/message-panel';
import { spacing } from '@/theme/tokens';
import { DISCOVERY_RADIUS_METRES, areaLabel, discoveryArea, distanceLabel, inDiscoveryArea, type DiscoveryArea } from './discoveryArea';
import { circleRing } from './fog';
import { MapCardPopup } from './MapCardPopup';
import { MapAtmosphere } from './MapAtmosphere';
import { MapHud } from './MapHud';
import { discoveredCount, type MapRestaurant } from './mapRestaurants';
import { animatedPinIds, type Region } from './pinMotion';
import { PIN_CENTRE_OFFSET, PIN_POP_MS, RestaurantPin } from './RestaurantPin';
import { RestaurantSheet } from './RestaurantSheet';
import { useMapRestaurants } from './useMapRestaurants';
import { useUserLocation } from './useUserLocation';

// The camera looks straight down from high above, then drops to frame the discovery circle.
// Apple Maps reads altitude, Google Maps reads zoom.
const HIGH = { altitude: 90000, zoom: 9.5 };
// Start the fly-in even if the location prompt is still open.
const LOCATION_WAIT_MS = 2500;
const NIGHT = '#120e0b';
// Room for the HUD above and the tab bar and preview card below when framing the circle.
const FRAME_PADDING = { top: 190, right: 28, bottom: 130, left: 28 };

const flat = (centre: { latitude: number; longitude: number }, height: { altitude: number; zoom: number }) => ({ center: centre, pitch: 0, heading: 0, ...height });

export function GameMap() {
  const router = useRouter();
  const reducedMotion = useReducedMotion();
  const location = useUserLocation();
  const data = useMapRestaurants();
  const map = useRef<MapView>(null);
  const flown = useRef(false);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const [mapReady, setMapReady] = useState(false);
  const [waited, setWaited] = useState(false);
  const [region, setRegion] = useState<Region | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [poppingId, setPoppingId] = useState<string | null>(null);
  const [cardOpen, setCardOpen] = useState(false);
  const [collectedOnly, setCollectedOnly] = useState(false);
  // Set once, from the first location result, and never moved by later fixes or map gestures.
  const [area, setArea] = useState<DiscoveryArea | null>(null);

  const catalog = data.status === 'ready' ? data.restaurants : [];
  const shownArea = area ?? discoveryArea(null);
  const nearby = useMemo(() => catalog.filter((restaurant) => inDiscoveryArea(restaurant.coordinate, shownArea)), [catalog, shownArea]);
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

  // Intro: one straight zoom from high above down to the whole discovery circle.
  useEffect(() => {
    if (flown.current || !mapReady || !area) return;
    flown.current = true;
    map.current?.fitToCoordinates(circleRing(area.centre, DISCOVERY_RADIUS_METRES, 12), { edgePadding: FRAME_PADDING, animated: !reducedMotion });
  }, [mapReady, area, reducedMotion]);

  const animated = useMemo(() => (reducedMotion ? new Set<string>() : animatedPinIds(restaurants, region)), [reducedMotion, restaurants, region]);
  const selected = restaurants.find((restaurant) => restaurant.id === selectedId) ?? null;
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
        onRegionChangeComplete={setRegion}
        onPress={() => setSelectedId(null)}
      >
        {area ? (
          <Circle center={area.centre} radius={DISCOVERY_RADIUS_METRES} strokeWidth={2} strokeColor="rgba(242,182,50,0.55)" fillColor="rgba(242,182,50,0.04)" />
        ) : null}
        {restaurants.map((restaurant) => {
          const live = animated.has(restaurant.id) || poppingId === restaurant.id;
          return (
            <Marker
              // A still marker is drawn once, so it is remounted when its look changes.
              key={`${restaurant.id}-${restaurant.card?.stage ?? 'locked'}-${player ? 'near' : 'far'}`}
              coordinate={restaurant.coordinate}
              centerOffset={{ x: 0, y: PIN_CENTRE_OFFSET }}
              tracksViewChanges={live}
              zIndex={restaurant.id === selectedId ? 3 : restaurant.card ? 2 : 1}
              accessibilityLabel={`${restaurant.name}, ${restaurant.card ? 'collected' : 'not collected yet'}`}
              onPress={(event) => {
                event.stopPropagation();
                openPin(restaurant);
              }}
            >
              <RestaurantPin restaurant={restaurant} animate={animated.has(restaurant.id)} popping={poppingId === restaurant.id} distance={distanceLabel(player, restaurant.coordinate)} />
            </Marker>
          );
        })}
      </MapView>

      <MapAtmosphere />
      <MapHud
        discovered={discoveredCount(catalog)}
        total={catalog.length}
        areaLabel={areaLabel(shownArea, location.placeName)}
        collectedOnly={collectedOnly}
        onToggleCollectedOnly={() => {
          setSelectedId(null);
          setCollectedOnly((current) => !current);
        }}
      />

      {data.status === 'loading' ? <View pointerEvents="none" style={styles.loading}><ActivityIndicator color="#f2b632" accessibilityLabel="Loading restaurants" /></View> : null}
      {data.status === 'error' ? (
        <View style={styles.error}>
          <MessagePanel title="Restaurants unavailable" body={data.message} kind="error" actionLabel="Try again" onAction={data.retry} />
        </View>
      ) : null}

      {data.status === 'ready' && area && restaurants.length === 0 ? (
        <View pointerEvents="none" style={styles.empty}>
          <Text className="text-center text-sm font-semibold" style={{ color: '#f6ede2' }}>
            {collectedOnly ? 'No collected restaurants within 5 km yet.' : 'No Foodie Cards restaurants within 5 km of you yet.'}
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
  empty: { position: 'absolute', left: spacing.page, right: spacing.page, bottom: 130, padding: spacing.md, borderRadius: 16, backgroundColor: 'rgba(18,14,11,0.88)' },
});
