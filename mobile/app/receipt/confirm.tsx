import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, router } from 'expo-router';
import type { ReceiptDraft, ReceiptRestaurant, ProgressionResult } from '@foodie-cards/shared';
import { useAuth } from '@/providers/auth-provider';
import { supabase } from '@/lib/supabase';
import { createReceiptApi } from '@/features/receipts/receipt-api';
import { createReceiptFlowState, formatReceiptTotal, parseReceiptTotal } from '@/features/receipts/receipt-state';
import { Button } from '@/components/ui/button';
import { FormField } from '@/components/ui/form-field';
import { MessagePanel } from '@/components/ui/message-panel';
import { VintageScreen } from '@/components/vintage/VintageScreen';
import { useVintageKit, vintageCard } from '@/components/vintage/kit';
import { vintage, vintageRadius, vintageSpace, vintageText, withAlpha } from '@/theme/vintage';
import { coordinateFor, type Coordinate } from '@/features/map/coordinates';
import { sessionNearby } from '@/features/map/sessionNearby';
import { parseUnlockParams, type UnlockTarget } from '@/features/map/unlockTarget';
import { useUserLocation } from '@/features/map/useUserLocation';
import type { Candidate } from '@/features/receipts/match-place';
import { submitTargetFor } from '@/features/receipts/place-choice';
import { appendCandidates, candidateDistance, candidateKey, initialPlacePick, nearbyForReceipt, searchBias, searchCandidates } from '@/features/receipts/place-picker';
import { createPlaceSearch } from '@/features/receipts/place-search';

type Item = ReceiptDraft['items'][number] & { key: string };

// One search client for the app session, so its cache and one-request-per-second spacing hold across receipts.
const placeSearch = createPlaceSearch();
// How long to wait for a location fix before matching without one. The screen never blocks on location.
const LOCATION_WAIT_MS = 6000;

async function freshToken(userId: string): Promise<string> {
  if (!supabase) throw new Error('Receipt confirmation is unavailable because sign-in is not configured.');
  const { data, error } = await supabase.auth.getSession();
  if (error || !data.session?.access_token || data.session.user.id !== userId) {
    throw new Error('Your account changed. Sign in again before continuing.');
  }
  return data.session.access_token;
}

function validDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  return parsed.getUTCFullYear() === year && parsed.getUTCMonth() === month - 1 && parsed.getUTCDate() === day;
}

export default function ConfirmReceiptScreen() {
  const auth = useAuth();
  const params = useLocalSearchParams();
  const draftId = Array.isArray(params.draftId) ? params.draftId[0] : params.draftId;
  // The place the user tapped "Scan receipt" on in the map, forwarded by Scan.
  const unlock = parseUnlockParams(params);
  const userId = auth.session?.user.id ?? null;
  return <ConfirmReceiptContent key={`${userId ?? 'signed-out'}:${draftId ?? ''}`} auth={auth} userId={userId} draftId={draftId} unlock={unlock} />;
}

function ConfirmReceiptContent({ auth, userId, draftId, unlock: unlockParam }: { auth: ReturnType<typeof useAuth>; userId: string | null; draftId?: string; unlock: UnlockTarget | null }) {
  const flow = useRef(createReceiptFlowState());
  flow.current.transitionTo(userId);
  const snapshot = flow.current.snapshot();
  const api = useMemo(() => createReceiptApi({ baseUrl: process.env.EXPO_PUBLIC_API_URL ?? '' }), []);
  const [draft, setDraft] = useState<ReceiptDraft | null>(null);
  const [restaurants, setRestaurants] = useState<ReceiptRestaurant[]>([]);
  const [receiptDate, setReceiptDate] = useState('');
  const [receiptNumber, setReceiptNumber] = useState('');
  const [total, setTotal] = useState('');
  const [currency, setCurrency] = useState('USD');
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ProgressionResult | null>(null);
  const generation = useRef(0);
  const controllerRef = useRef<AbortController | null>(null);
  const submitInFlight = useRef(false);
  const operationKey = `${userId ?? ''}:${draftId ?? ''}`;
  // Restaurant picker. Nearby map lookup may send the user's coordinate to public Overpass; name search only gets a rounded area bias. The app backend receives the chosen place's coordinates.
  const [unlock] = useState(unlockParam);
  const location = useUserLocation();
  const [locationWaitOver, setLocationWaitOver] = useState(false);
  const user: Coordinate | null = location.status === 'granted' ? location.coordinate : null;
  const locationSettled = location.status !== 'pending' || locationWaitOver;
  const [pickReady, setPickReady] = useState(false);
  const [chosen, setChosen] = useState<Candidate | null>(null);
  const [placeConfirmed, setPlaceConfirmed] = useState(false);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [listOpen, setListOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<Candidate[] | null>(null);
  const [searchMessage, setSearchMessage] = useState<string | null>(null);
  const pickStarted = useRef(false);
  const mounted = useRef(true);
  const kit = useVintageKit();

  useEffect(() => {
    mounted.current = true;
    const timer = setTimeout(() => setLocationWaitOver(true), LOCATION_WAIT_MS);
    return () => { mounted.current = false; clearTimeout(timer); };
  }, []);

  // Once the draft is loaded and the location is known (or refused, or slow): fetch nearby places through
  // the map's client and work out the starting choice. Runs once per screen; the user's picks are never overwritten.
  useEffect(() => {
    if (!draft || !locationSettled || pickStarted.current) return;
    pickStarted.current = true;
    const centre = user;
    const seeded = restaurants.map((restaurant) => ({ id: restaurant.id, name: restaurant.name, coordinate: coordinateFor(restaurant) }));
    void (async () => {
      const nearby = centre ? await nearbyForReceipt(sessionNearby, centre) : [];
      if (!mounted.current) return;
      const pick = initialPlacePick({ receiptName: draft.restaurantName, draftRestaurantId: draft.restaurantId, user: centre, nearby, seeded, unlock });
      setChosen(pick.chosen);
      setCandidates(pick.candidates);
      setSearchOpen(pick.searchOpen);
      setQuery(pick.searchQuery);
      setPickReady(true);
    })();
  }, [draft, locationSettled, user, restaurants, unlock]);

  useEffect(() => {
    const operation = ++generation.current;
    const controller = new AbortController();
    controllerRef.current = controller;
    if (!draftId || !userId) {
      setLoading(false);
      setError(!draftId ? 'This receipt link is missing its saved draft. Return to Scan and choose the image again.' : 'Sign in to review this receipt.');
      return () => { generation.current += 1; controller.abort(); };
    }
    setLoading(true);
    void (async () => {
      try {
        const token = await freshToken(userId);
        if (generation.current !== operation || !flow.current.isCurrent(snapshot)) return;
        const [loadedDraft, catalog] = await Promise.all([
          api.getDraft(token, draftId, controller.signal),
          api.getRestaurants(token, controller.signal),
        ]);
        if (generation.current !== operation || !flow.current.isCurrent(snapshot)) return;
        setDraft(loadedDraft);
        setRestaurants(catalog.restaurants);
        setReceiptDate(loadedDraft.receiptDate ?? '');
        setReceiptNumber(loadedDraft.receiptNumber ?? '');
        setTotal(formatReceiptTotal(loadedDraft.totalMinor));
        setCurrency(loadedDraft.currency ?? 'USD');
        setItems(loadedDraft.items.map((item, index) => ({ ...item, key: `${loadedDraft.draftId}-${index}` })));
        setError(null);
      } catch (loadError) {
        if (controller.signal.aborted || generation.current !== operation) return;
        setError(loadError instanceof Error ? loadError.message : 'Could not load this receipt draft. Try again.');
      } finally {
        if (generation.current === operation) setLoading(false);
      }
    })();
    return () => { generation.current += 1; controller.abort(); };
  }, [operationKey, userId, draftId, api, snapshot]);

  useEffect(() => () => { controllerRef.current?.abort(); submitInFlight.current = false; }, []);

  function updateItem(key: string, patch: Partial<ReceiptDraft['items'][number]>) {
    setItems((current) => current.map((item) => item.key === key ? { ...item, ...patch } : item));
    setError(null);
  }

  function addItem() {
    const key = `new-${Date.now()}-${items.length}`;
    setItems((current) => [...current, { key, originalText: '', suggestedName: '', quantity: 1 }]);
  }

  function choosePlace(candidate: Candidate) {
    setChosen(candidate);
    setPlaceConfirmed(true);
    setListOpen(false);
    setSearchOpen(false);
    setError(null);
  }

  // Name search runs only when the user presses Search (or the keyboard's search key), never per keystroke.
  async function runSearch() {
    const text = query.trim();
    if (!text || searching) return;
    setSearching(true);
    setSearchMessage(null);
    try {
      const found = searchCandidates(await placeSearch(text, searchBias(user)));
      if (!mounted.current) return;
      setSearchResults(found);
      setCandidates((current) => appendCandidates(current, found));
      if (found.length === 0) setSearchMessage('No matches. Try a different spelling.');
    } catch (searchError) {
      if (!mounted.current) return;
      setSearchResults(null);
      setSearchMessage(searchError instanceof Error ? searchError.message : 'Place search is unavailable right now.');
    } finally {
      if (mounted.current) setSearching(false);
    }
  }

  function placeDetail(candidate: Candidate) {
    if (candidate.kind === 'seeded') return restaurants.find((restaurant) => restaurant.id === candidate.restaurantId)?.locationLabel || 'Location not listed';
    return [candidate.place.address, candidate.place.city].filter(Boolean).join(', ') || 'Nearby listing';
  }

  function placeRow(candidate: Candidate) {
    const key = candidateKey(candidate);
    const selected = chosen !== null && candidateKey(chosen) === key;
    const distance = candidateDistance(user, candidate);
    return <Pressable key={key} accessibilityRole="radio" accessibilityState={{ checked: selected }} onPress={() => choosePlace(candidate)} style={[styles.restaurant, selected && styles.selected]}><View style={styles.flex}><Text allowFontScaling style={[styles.placeName, kit.font('semibold')]}>{candidate.name}</Text><Text allowFontScaling style={[styles.placeDetail, kit.font('body')]}>{distance ? `${distance} · ` : ''}{placeDetail(candidate)}</Text></View><Ionicons name={selected ? 'radio-button-on' : 'radio-button-off'} size={22} color={vintage.gold} /></Pressable>;
  }

  async function submit() {
    if (!userId || auth.status !== 'signed-in' || !draft) { setError('Wait for your signed-in session before confirming.'); return; }
    if (result || submitInFlight.current) return;
    const totalMinor = parseReceiptTotal(total);
    const normalizedCurrency = currency.trim().toUpperCase();
    if (!chosen) { setError('Choose the restaurant you ate at.'); return; }
    if (!validDate(receiptDate)) { setError('Enter a valid receipt date in YYYY-MM-DD format.'); return; }
    if (receiptNumber.length > 120) { setError('Receipt number must be 120 characters or fewer.'); return; }
    if (totalMinor === null) { setError('Enter a valid total using dollars and cents, such as 24.50.'); return; }
    if (!/^[A-Z]{3}$/.test(normalizedCurrency)) { setError('Enter a three-letter currency code, such as USD.'); return; }
    if (items.length < 1 || items.length > 100) { setError('A receipt must have between 1 and 100 items.'); return; }
    if (items.some((item) => !item.originalText.trim() || item.originalText.trim().length > 240 || !item.suggestedName.trim() || item.suggestedName.trim().length > 120 || !Number.isInteger(item.quantity) || item.quantity < 1 || item.quantity > 99)) {
      setError('Each item needs receipt text (up to 240 characters), a name (up to 120), and a quantity from 1 to 99.'); return;
    }
    const submissionId = flow.current.submissionIdFor(draft.draftId);
    const current = flow.current.snapshot();
    const controller = new AbortController();
    submitInFlight.current = true;
    controllerRef.current?.abort();
    controllerRef.current = controller;
    setSubmitting(true);
    setError(null);
    try {
      const token = await freshToken(userId);
      if (!flow.current.isCurrent(current) || controller.signal.aborted) return;
      const submitted = await api.submitReceipt(token, {
        draftId: draft.draftId,
        submissionId,
        // Exactly one of restaurantId or place (with the place's own coordinates). Never the user's location.
        ...submitTargetFor(chosen),
        receiptDate,
        receiptNumber: receiptNumber.trim() || null,
        totalMinor,
        currency: normalizedCurrency,
        items: items.map(({ originalText, suggestedName, quantity }) => ({ originalText: originalText.trim(), confirmedName: suggestedName.trim(), quantity })),
      }, controller.signal);
      if (!flow.current.isCurrent(current) || controller.signal.aborted) return;
      setResult(submitted);
      void auth.refreshProfile();
    } catch (submitError) {
      if (controller.signal.aborted || !flow.current.isCurrent(current)) return;
      setError(submitError instanceof Error ? submitError.message : 'Could not confirm this receipt. Your edits are saved here.');
    } finally {
      submitInFlight.current = false;
      if (flow.current.isCurrent(current)) setSubmitting(false);
    }
  }

  const reviewTitle = { eyebrow: 'REVIEW RECEIPT', title: 'CHECK THE\nDETAILS', subtitle: 'Correct anything that was read incorrectly before confirming.' };

  if (loading) return <VintageScreen {...reviewTitle}><View style={[styles.card, styles.row]}><ActivityIndicator color={vintage.gold} /><Text allowFontScaling style={[styles.muted, kit.font('body')]}>Loading your saved receipt…</Text></View></VintageScreen>;
  if (!userId) return <VintageScreen {...reviewTitle}><MessagePanel title="Sign in to continue" body="This receipt draft is private to your account." {...kit.notice('plain')} /><Button label="Go to sign in" onPress={() => router.replace('/(auth)/sign-in')} {...kit.primaryButton} /></VintageScreen>;
  if (error && !draft) return <VintageScreen {...reviewTitle}><MessagePanel title="Receipt draft unavailable" body={error} kind="error" {...kit.notice('error')} /><Button label="Return to Scan" variant="secondary" onPress={() => router.replace('/(tabs)/scan')} {...kit.outlineButton} /></VintageScreen>;
  if (result) return <VintageScreen eyebrow="VISIT ADDED" title={'RECEIPT\nCONFIRMED'} subtitle="Your visit is saved to your collection.">
    <View style={styles.card}>
      <Text allowFontScaling style={[styles.body, kit.font('body')]}>You earned <Text style={[styles.gold, kit.font('semibold')]}>{result.xpBreakdown.totalXP} XP</Text> and now have {result.visitCount} visit{result.visitCount === 1 ? '' : 's'} at this restaurant.</Text>
      <View style={styles.rule} />
      <Text allowFontScaling style={[styles.muted, kit.font('body')]}>Card progress: {result.cardXP} XP · {result.stage}</Text>
    </View>
    <Button
      label={result.revealEventId ? 'Reveal card' : 'Back to collection'}
      onPress={() => result.revealEventId
        ? router.replace({ pathname: '/reveal/[eventId]', params: { eventId: result.revealEventId } })
        : router.replace('/(tabs)/collection')}
      {...kit.primaryButton}
    />
  </VintageScreen>;

  return <KeyboardAvoidingView style={styles.keyboard} behavior={Platform.OS === 'ios' ? 'padding' : undefined}><VintageScreen {...reviewTitle} keyboardShouldPersistTaps="handled">
    {draft?.warnings.map((warning, index) => <MessagePanel key={`${index}-${warning}`} title="Please review" body={warning} {...kit.notice('plain')} />)}
    <View style={styles.card}><Text allowFontScaling accessibilityRole="header" style={[styles.section, kit.font('display')]}>Restaurant</Text><Text allowFontScaling style={[styles.muted, kit.font('body')]}>{draft?.restaurantName ? `Detected: ${draft.restaurantName}` : 'Choose the restaurant printed on your receipt.'}</Text>
      {!pickReady ? <View style={styles.row}><ActivityIndicator color={vintage.gold} /><Text allowFontScaling style={[styles.muted, kit.font('body')]}>Finding where you ate…</Text></View> : <>
        {chosen ? <View style={[styles.restaurant, styles.selected]} accessibilityLiveRegion="polite" testID="chosen-restaurant"><View style={styles.flex}>
          <Text allowFontScaling style={[styles.eyebrow, kit.font('semibold')]}>{placeConfirmed ? 'YOU ATE AT' : 'WE THINK YOU ATE AT'}</Text>
          <Text allowFontScaling style={[styles.placeName, kit.font('semibold')]}>{chosen.name}{candidateDistance(user, chosen) ? <Text style={[styles.placeDetail, kit.font('body')]}>{` · ${candidateDistance(user, chosen)}`}</Text> : null}</Text>
          <Text allowFontScaling style={[styles.placeDetail, kit.font('body')]}>{placeDetail(chosen)}</Text>
        </View>{placeConfirmed ? <Ionicons name="checkmark-circle" size={24} color={vintage.gold} /> : null}</View>
          : <Text allowFontScaling style={[styles.muted, kit.font('body')]}>We couldn’t tell where you ate. Search by name or choose a restaurant.</Text>}
        {chosen && !placeConfirmed ? <Button label="Confirm" onPress={() => choosePlace(chosen)} testID="confirm-restaurant" {...kit.primaryButton} /> : null}
        <View style={styles.rowBetween}>
          <Button label={listOpen ? 'Hide list' : 'Choose another'} variant="quiet" fullWidth={false} onPress={() => setListOpen((open) => !open)} testID="choose-another-restaurant" {...kit.quietButton} leftIcon={<Ionicons name={listOpen ? 'chevron-up' : 'list'} size={16} color={vintage.gold} />} />
          <Button label="Search by name" variant="quiet" fullWidth={false} onPress={() => setSearchOpen((open) => !open)} testID="search-restaurant" {...kit.quietButton} leftIcon={<Ionicons name="search" size={16} color={vintage.gold} />} />
        </View>
        {listOpen ? candidates.map(placeRow) : null}
        {listOpen && candidates.length === 0 ? <Text allowFontScaling style={[styles.muted, kit.font('body')]}>No nearby places to list. Search by name instead.</Text> : null}
        {searchOpen ? <View style={styles.search}>
          <FormField label="Restaurant name" value={query} onChangeText={(value) => { setQuery(value); setSearchMessage(null); }} placeholder="Name on the receipt" returnKeyType="search" onSubmitEditing={() => void runSearch()} maxLength={120} testID="restaurant-search-query" {...kit.field} />
          <Button label="Search" variant="secondary" onPress={() => void runSearch()} loading={searching} disabled={!query.trim()} testID="restaurant-search" {...kit.outlineButton} />
          {searchMessage ? <Text allowFontScaling accessibilityLiveRegion="polite" style={[styles.muted, kit.font('body')]}>{searchMessage}</Text> : null}
          {searchResults?.map(placeRow)}
        </View> : null}
      </>}
    </View>
    <View style={styles.card}><Text allowFontScaling accessibilityRole="header" style={[styles.section, kit.font('display')]}>Receipt details</Text>
      <FormField label="Receipt date" value={receiptDate} onChangeText={setReceiptDate} placeholder="YYYY-MM-DD" hint="Use the local date printed on the receipt." testID="receipt-date" {...kit.field} />
      <FormField label="Receipt number (optional)" value={receiptNumber} onChangeText={setReceiptNumber} placeholder="Receipt number" maxLength={120} testID="receipt-number" {...kit.field} />
      <FormField label="Grand total" value={total} onChangeText={setTotal} placeholder="24.50" keyboardType="decimal-pad" hint="Enter dollars and cents, for example 24.50." testID="receipt-total" {...kit.field} />
      <FormField label="Currency" value={currency} onChangeText={(value) => setCurrency(value.toUpperCase())} placeholder="USD" autoCapitalize="characters" maxLength={3} testID="receipt-currency" {...kit.field} />
    </View>
    <View style={styles.rowBetween}><Text allowFontScaling accessibilityRole="header" style={[styles.sectionOnRed, kit.font('display')]}>Food and drinks</Text><Button label="Add item" variant="quiet" fullWidth={false} onPress={addItem} testID="add-receipt-item" {...kit.quietButton} leftIcon={<Ionicons name="add" size={18} color={vintage.gold} />} /></View>
    {items.map((item) => <View key={item.key} style={styles.card}>
      <FormField label="Original receipt text" value={item.originalText} onChangeText={(value) => updateItem(item.key, { originalText: value })} placeholder="Text as printed" maxLength={240} {...kit.field} />
      <FormField label="Dish or drink name" value={item.suggestedName} onChangeText={(value) => updateItem(item.key, { suggestedName: value })} placeholder="Confirmed name" maxLength={120} {...kit.field} />
      <FormField label="Quantity" value={String(item.quantity)} onChangeText={(value) => updateItem(item.key, { quantity: value === '' ? 0 : Number(value) })} keyboardType="number-pad" maxLength={2} {...kit.field} />
      <Pressable accessibilityRole="button" accessibilityLabel="Remove item" hitSlop={8} style={styles.removeButton} onPress={() => setItems((current) => current.filter((entry) => entry.key !== item.key))}><Ionicons name="trash-outline" size={16} color={vintage.rust} /><Text allowFontScaling style={[styles.remove, kit.font('semibold')]}>Remove item</Text></Pressable>
    </View>)}
    {error ? <MessagePanel title="Could not confirm this receipt" body={`${error} Your edits are kept on this screen.`} kind="error" {...kit.notice('error')} /> : null}
    {submitting ? <View style={styles.row}><ActivityIndicator color={vintage.gold} /><Text allowFontScaling style={[styles.muted, kit.font('body')]}>Confirming receipt…</Text></View> : null}
    <Button label={error ? 'Retry confirmation' : 'Confirm receipt'} onPress={() => void submit()} loading={submitting} disabled={auth.status !== 'signed-in' || submitting} testID="confirm-receipt" {...kit.primaryButton} />
    <Text allowFontScaling style={[styles.note, kit.font('body')]}>Nothing is added until you confirm this receipt.</Text>
  </VintageScreen></KeyboardAvoidingView>;
}

const styles = StyleSheet.create({
  keyboard: { flex: 1, backgroundColor: vintage.deepRed },
  card: { ...vintageCard, padding: vintageSpace.lg, gap: vintageSpace.md },
  section: { color: vintage.cream, fontSize: 20, lineHeight: 26 },
  sectionOnRed: { color: vintage.cream, fontSize: 20, lineHeight: 26, flexShrink: 1 },
  body: { color: vintage.cream, fontSize: 15, lineHeight: 22 },
  muted: { color: vintageText.muted, fontSize: 14, lineHeight: 20, flexShrink: 1 },
  gold: { color: vintage.gold },
  rule: { height: 1, backgroundColor: withAlpha(vintage.gold, 0.35) },
  eyebrow: { color: vintage.gold, fontSize: 11, lineHeight: 14, letterSpacing: 2 },
  restaurant: { minHeight: 60, padding: vintageSpace.md, flexDirection: 'row', alignItems: 'center', gap: vintageSpace.md, borderWidth: 1, borderColor: withAlpha(vintage.gold, 0.35), borderRadius: vintageRadius.control, backgroundColor: vintage.ink },
  selected: { borderColor: vintage.gold, backgroundColor: vintage.crimson },
  placeName: { color: vintage.cream, fontSize: 16, lineHeight: 22 },
  placeDetail: { color: vintageText.secondary, fontSize: 13, lineHeight: 18 },
  flex: { flex: 1, gap: vintageSpace.xs },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: vintageSpace.sm, flexWrap: 'wrap' },
  row: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: vintageSpace.sm },
  removeButton: { flexDirection: 'row', alignItems: 'center', gap: vintageSpace.xs, alignSelf: 'flex-start', minHeight: 32 },
  remove: { color: vintage.rustText, fontSize: 14, lineHeight: 20 },
  note: { color: vintageText.muted, fontSize: 12, lineHeight: 16, textAlign: 'center' },
  search: { gap: vintageSpace.md },
});
