import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import MapView, { Marker, Polygon } from 'react-native-maps';
import { useReducedMotion } from 'react-native-reanimated';
import { MessagePanel } from '@/components/ui/message-panel';
import { spacing } from '@/theme/tokens';
import { mapCentre } from './coordinates';
import { circleRing, fogBounds } from './fog';
import { MapAtmosphere } from './MapAtmosphere';
import { MapHud } from './MapHud';
import { discoveredCount, type MapRestaurant } from './mapRestaurants';
import { animatedPinIds, type Region } from './pinMotion';
import { pinLook } from './pinStyle';
import { PIN_POP_MS, RestaurantPin } from './RestaurantPin';
import { RestaurantSheet } from './RestaurantSheet';
import { useMapRestaurants } from './useMapRestaurants';
import { useUserLocation } from './useUserLocation';

// The camera looks straight down. Apple Maps reads altitude, Google Maps reads zoom.
const HIGH = { altitude: 90000, zoom: 9.5 };
const ARRIVE = { altitude: 6500, zoom: 13.6 };
const SETTLE = { altitude: 8000, zoom: 13.2 };
const FLY_MS = 1900;
const SETTLE_MS = 420;
// Start the fly-in even if the location prompt is still open.
const LOCATION_WAIT_MS = 2500;
const NIGHT = '#120e0b';
// Light fog everywhere except around collected restaurants. Set to false if it costs frames.
const FOG_ENABLED = true;
const FOG_FILL = 'rgba(14,9,26,0.34)';
const CLEARING_METRES = 420;

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

  const restaurants = data.status === 'ready' ? data.restaurants : [];
  const centre = useMemo(() => mapCentre(location.coordinate), [location.coordinate]);
  const initialCamera = useRef(flat(mapCentre(null), reducedMotion ? SETTLE : HIGH)).current;

  useEffect(() => {
    const wait = setTimeout(() => setWaited(true), LOCATION_WAIT_MS);
    return () => {
      clearTimeout(wait);
      timers.current.forEach(clearTimeout);
    };
  }, []);

  // Intro: one straight zoom from high above down to the user's area, then ease back a touch.
  useEffect(() => {
    if (flown.current || !mapReady || (location.status === 'pending' && !waited)) return;
    flown.current = true;
    if (reducedMotion) {
      map.current?.setCamera(flat(centre, SETTLE));
      return;
    }
    map.current?.animateCamera(flat(centre, ARRIVE), { duration: FLY_MS });
    timers.current.push(setTimeout(() => map.current?.animateCamera(flat(centre, SETTLE), { duration: SETTLE_MS }), FLY_MS));
  }, [mapReady, location.status, waited, centre, reducedMotion]);

  const animated = useMemo(() => (reducedMotion ? new Set<string>() : animatedPinIds(restaurants, region)), [reducedMotion, restaurants, region]);
  const selected = restaurants.find((restaurant) => restaurant.id === selectedId) ?? null;
  const fogHoles = useMemo(() => restaurants.filter((restaurant) => restaurant.card).map((restaurant) => circleRing(restaurant.coordinate, CLEARING_METRES)), [restaurants]);
  const fogOutline = useMemo(() => fogBounds(mapCentre(null)), []);

  const openPin = useCallback((restaurant: MapRestaurant) => {
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
        {FOG_ENABLED && fogHoles.length > 0 ? <Polygon coordinates={fogOutline} holes={fogHoles} fillColor={FOG_FILL} strokeWidth={0} strokeColor="transparent" /> : null}
        {FOG_ENABLED ? restaurants.filter((restaurant) => restaurant.card).map((restaurant) => (
          <Polygon
            key={`clearing-${restaurant.id}`}
            coordinates={circleRing(restaurant.coordinate, CLEARING_METRES)}
            fillColor="rgba(255,226,140,0.06)"
            strokeWidth={2}
            strokeColor={`${pinLook(restaurant.card?.stage ?? null).glow ?? '#f2b632'}99`}
          />
        )) : null}
        {restaurants.map((restaurant) => {
          const live = animated.has(restaurant.id) || poppingId === restaurant.id;
          return (
            <Marker
              // A still marker is drawn once, so it is remounted when its look changes.
              key={`${restaurant.id}-${restaurant.card?.stage ?? 'locked'}`}
              coordinate={restaurant.coordinate}
              anchor={{ x: 0.5, y: 1 }}
              centerOffset={{ x: 0, y: -36 }}
              tracksViewChanges={live}
              zIndex={restaurant.card ? 2 : 1}
              accessibilityLabel={`${restaurant.name}, ${restaurant.card ? 'collected' : 'not collected yet'}`}
              onPress={(event) => {
                event.stopPropagation();
                openPin(restaurant);
              }}
            >
              <RestaurantPin restaurant={restaurant} animate={animated.has(restaurant.id)} popping={poppingId === restaurant.id} />
            </Marker>
          );
        })}
      </MapView>

      <MapAtmosphere />
      <MapHud discovered={discoveredCount(restaurants)} total={restaurants.length} />

      {data.status === 'loading' ? <View pointerEvents="none" style={styles.loading}><ActivityIndicator color="#f2b632" accessibilityLabel="Loading restaurants" /></View> : null}
      {data.status === 'error' ? (
        <View style={styles.error}>
          <MessagePanel title="Restaurants unavailable" body={data.message} kind="error" actionLabel="Try again" onAction={data.retry} />
        </View>
      ) : null}

      {selected ? (
        <RestaurantSheet
          restaurant={selected}
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
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: NIGHT },
  loading: { position: 'absolute', left: 0, right: 0, bottom: 120, alignItems: 'center' },
  error: { position: 'absolute', left: spacing.page, right: spacing.page, bottom: 120 },
});
