import { useEffect, useMemo, useRef, useState } from 'react';
import { Image, Platform, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { File } from 'expo-file-system';
import * as ImageManipulator from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import { router, useLocalSearchParams } from 'expo-router';
import { Button } from '@/components/ui/button';
import { MessagePanel } from '@/components/ui/message-panel';
import { VintageScreen } from '@/components/vintage/VintageScreen';
import { useVintageKit, vintageCard } from '@/components/vintage/kit';
import { framedPrintSize, tabScrollBottomPadding, vintage, vintageRadius, vintageSpace, vintageText, withAlpha } from '@/theme/vintage';
import { UnlockBanner } from '@/features/map/UnlockBanner';
import { paramsForTarget, parseUnlockParams } from '@/features/map/unlockTarget';
import { useAuth } from '@/providers/auth-provider';
import { supabase } from '@/lib/supabase';
import { createReceiptApi, type ReceiptImageUpload } from '@/features/receipts/receipt-api';
import { nativeReceiptPart, prepareWebReceiptBlob } from '@/features/receipts/receipt-image';
import { createReceiptFlowState } from '@/features/receipts/receipt-state';

const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const MAX_IMAGE_EDGE = 2048;

type PreparedImage = ReceiptImageUpload & { previewUri: string };

async function getFreshAccessToken(userId: string): Promise<string> {
  if (!supabase) throw new Error('Receipt upload is unavailable because sign-in is not configured.');
  const { data, error } = await supabase.auth.getSession();
  if (error) throw new Error('Could not refresh your session. Sign in again and retry.');
  if (!data.session || data.session.user.id !== userId || !data.session.access_token) {
    throw new Error('Your account changed. Sign in again before uploading this receipt.');
  }
  return data.session.access_token;
}

async function prepareReceiptImage(asset: ImagePicker.ImagePickerAsset): Promise<PreparedImage> {
  const longestEdge = Math.max(asset.width, asset.height);
  const resize = longestEdge > MAX_IMAGE_EDGE
    ? (asset.width >= asset.height
      ? [{ resize: { width: MAX_IMAGE_EDGE } }]
      : [{ resize: { height: MAX_IMAGE_EDGE } }])
    : [];
  const image = await ImageManipulator.manipulateAsync(asset.uri, resize, {
    compress: 0.85,
    format: ImageManipulator.SaveFormat.JPEG,
  });
  const timestamp = Date.now();
  if (Platform.OS === 'web') {
    const file = await prepareWebReceiptBlob(image.uri);
    const extension = file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg';
    const name = `receipt-${timestamp}.${extension}`;
    return { uri: image.uri, name, type: file.type as ReceiptImageUpload['type'], file, previewUri: image.uri };
  }
  const file = new File(image.uri);
  if (!file.exists || file.size <= 0) throw new Error('The edited image could not be opened. Choose the receipt again.');
  if (file.size > MAX_IMAGE_BYTES) throw new Error('This receipt image is still over 10 MB after compression. Choose another photo.');
  const name = `receipt-${timestamp}.jpg`;
  return { uri: image.uri, name, type: 'image/jpeg', file: nativeReceiptPart(file, name, 'image/jpeg'), previewUri: image.uri };
}

export default function ScanScreen() {
  const auth = useAuth();
  const identity = auth.session?.user.id ?? 'signed-out';
  return <ScanScreenContent key={identity} auth={auth} />;
}

function ScanScreenContent({ auth }: { auth: ReturnType<typeof useAuth> }) {
  const { status, session } = auth;
  const unlockTarget = parseUnlockParams(useLocalSearchParams());
  const flow = useRef(createReceiptFlowState());
  const userId = session?.user.id ?? null;
  flow.current.transitionTo(userId);
  const snapshot = flow.current.snapshot();
  const api = useMemo(() => createReceiptApi({ baseUrl: process.env.EXPO_PUBLIC_API_URL ?? '' }), []);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cameraDenied, setCameraDenied] = useState(false);
  const [preparedImage, setPreparedImage] = useState<PreparedImage | null>(null);
  const operationId = useRef(0);
  const activeController = useRef<AbortController | null>(null);

  useEffect(() => () => {
    operationId.current += 1;
    activeController.current?.abort();
  }, [userId]);

  function isCurrent(operation: number) {
    return operationId.current === operation && flow.current.isCurrent(snapshot);
  }

  async function uploadImage(image: PreparedImage, operation: number, requestSnapshot: ReturnType<typeof flow.current.snapshot>) {
    if (!requestSnapshot.userId || !flow.current.isCurrent(requestSnapshot)) return;
    const controller = new AbortController();
    activeController.current = controller;
    setBusy(true);
    setError(null);
    try {
      const token = await getFreshAccessToken(requestSnapshot.userId);
      if (!isCurrent(operation) || !flow.current.isCurrent(requestSnapshot)) return;
      const draft = await api.extractReceipt(token, image, controller.signal);
      if (!isCurrent(operation) || !flow.current.isCurrent(requestSnapshot)) return;
      // Hand the map's place on so the confirm screen can preselect it.
      router.push({ pathname: '/receipt/confirm', params: { draftId: draft.draftId, ...(unlockTarget ? paramsForTarget(unlockTarget) : {}) } });
    } catch (uploadError) {
      if (controller.signal.aborted || !isCurrent(operation)) return;
      setError(uploadError instanceof Error ? uploadError.message : 'Receipt upload failed. Try again.');
    } finally {
      if (isCurrent(operation)) setBusy(false);
      if (activeController.current === controller) activeController.current = null;
    }
  }

  async function chooseImage(source: 'camera' | 'library') {
    const requestSnapshot = flow.current.snapshot();
    if (!requestSnapshot.userId) {
      setError('Sign in to add a receipt.');
      return;
    }
    const operation = ++operationId.current;
    setError(null);
    setCameraDenied(false);
    setBusy(true);
    let result: ImagePicker.ImagePickerResult;
    try {
      if (source === 'camera') {
        const permission = await ImagePicker.requestCameraPermissionsAsync();
        if (!flow.current.isCurrent(requestSnapshot) || operationId.current !== operation) return;
        if (!permission.granted) {
          setCameraDenied(true);
          setError('Camera access was denied. You can still choose a receipt photo from your library.');
          setBusy(false);
          return;
        }
        result = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], allowsEditing: false, quality: 1 });
      } else {
        result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: false, quality: 1 });
      }
      if (!flow.current.isCurrent(requestSnapshot) || operationId.current !== operation) return;
      if (result.canceled || !result.assets[0]) {
        setBusy(false);
        return;
      }
      let image: PreparedImage;
      try {
        image = await prepareReceiptImage(result.assets[0]);
      } catch (prepareError) {
        if (flow.current.isCurrent(requestSnapshot) && operationId.current === operation) {
          setError(prepareError instanceof Error ? prepareError.message : 'Could not prepare the photo. Choose the receipt again.');
          setPreparedImage(null);
          setBusy(false);
        }
        return;
      }
      if (!flow.current.isCurrent(requestSnapshot) || operationId.current !== operation) return;
      setPreparedImage(image);
      await uploadImage(image, operation, requestSnapshot);
    } catch (pickerError) {
      if (flow.current.isCurrent(requestSnapshot) && operationId.current === operation) {
        setError(pickerError instanceof Error ? pickerError.message : 'Could not open the image picker. Try again.');
        setBusy(false);
      }
    }
  }

  function cancelUpload() {
    operationId.current += 1;
    activeController.current?.abort();
    activeController.current = null;
    setBusy(false);
    setError(null);
  }

  // Visual-only state: the banner can be hidden here without touching the target forwarded to confirm.
  const kit = useVintageKit();
  const insets = useSafeAreaInsets();
  const screen = useWindowDimensions();
  const scrollRef = useRef<ScrollView>(null);
  const [bannerHidden, setBannerHidden] = useState(false);
  const [photoSize, setPhotoSize] = useState<{ uri: string; width: number; height: number } | null>(null);
  const previewUri = preparedImage?.previewUri ?? null;

  useEffect(() => {
    if (!previewUri) return;
    let live = true;
    Image.getSize(previewUri, (width, height) => { if (live) setPhotoSize({ uri: previewUri, width, height }); }, () => undefined);
    // Bring the print and its actions into view above the tab bar.
    const timer = setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 250);
    return () => { live = false; clearTimeout(timer); };
  }, [previewUri]);

  // The print fits the card's inner width and at most ~45% of the screen height; the mat hugs it.
  const printBox = framedPrintSize(
    photoSize && photoSize.uri === previewUri ? photoSize : null,
    screen.width - vintageSpace.xl * 4 - (PRINT_MAT + 1) * 2,
    screen.height * 0.45 - (PRINT_MAT + 1) * 2,
  );
  const signedIn = status === 'signed-in' && !!session;

  return (
    <VintageScreen
      ref={scrollRef}
      eyebrow="ADD A VISIT"
      title={'SCAN A\nRECEIPT'}
      subtitle="Review every detail before a visit is added to your collection."
      bottomPadding={tabScrollBottomPadding(insets.bottom)}
      keyboardShouldPersistTaps="handled"
    >
      {unlockTarget && !bannerHidden ? <UnlockBanner target={unlockTarget} onDismiss={() => setBannerHidden(true)} /> : null}
      {error ? <MessagePanel title="Receipt not ready" body={error} kind="error" {...kit.notice('error')} /> : null}
      {!signedIn ? (
        <MessagePanel title="Sign in to continue" body="A receipt draft is private to your account. Sign in before adding one." {...kit.notice('plain')} />
      ) : (
        <View style={styles.card}>
          {preparedImage ? null : <View pointerEvents="none" style={styles.dashed} />}
          {preparedImage ? (
            <>
              <View style={styles.printRow}>
                <View style={[styles.print, { width: printBox.width + (PRINT_MAT + 1) * 2 }]}>
                  <Image source={{ uri: preparedImage.previewUri }} resizeMode="contain" style={{ width: printBox.width, height: printBox.height }} accessibilityLabel="Selected receipt preview" />
                </View>
              </View>
              <View style={styles.attachedRow}>
                <View style={styles.chip} accessible accessibilityLabel="Receipt attached">
                  <Text allowFontScaling style={[styles.chipText, kit.font('semibold')]}>Receipt attached ✓</Text>
                </View>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Retake: take a new photo of the receipt"
                  accessibilityState={{ disabled: busy }}
                  disabled={busy}
                  hitSlop={8}
                  onPress={() => void chooseImage('camera')}
                  style={[styles.retake, busy ? styles.unavailable : undefined]}
                  testID="retake-receipt"
                >
                  <Ionicons name="camera-outline" size={18} color={vintage.gold} />
                  <Text allowFontScaling style={[styles.retakeText, kit.font('semibold')]}>Retake</Text>
                </Pressable>
              </View>
            </>
          ) : (
            <>
              <View style={styles.cameraRing}>
                <View style={styles.cameraCircle}><Ionicons name="camera" size={28} color={vintage.cream} /></View>
              </View>
              <Text allowFontScaling accessibilityRole="header" style={[styles.cardTitle, kit.font('display')]}>Photograph or upload your receipt</Text>
              <Text allowFontScaling style={[styles.helper, kit.font('body')]}>We’ll prepare a private editable draft. Nothing is added to your collection until you confirm it.</Text>
            </>
          )}
          <View style={styles.actions}>
            {preparedImage ? null : <Button label="Take a photo" onPress={() => void chooseImage('camera')} loading={busy} testID="capture-receipt" {...kit.primaryButton} leftIcon={<Ionicons name="camera-outline" size={20} color={vintage.cream} />} />}
            {error && preparedImage && !busy ? <Button label="Retry upload" onPress={() => {
              const current = flow.current.snapshot();
              const operation = ++operationId.current;
              void uploadImage(preparedImage, operation, current);
            }} testID="retry-receipt-upload" {...kit.primaryButton} /> : null}
            <Button label={cameraDenied ? 'Choose from library' : 'Upload from library'} variant="secondary" onPress={() => void chooseImage('library')} loading={busy} testID="choose-receipt" {...kit.outlineButton} leftIcon={<Ionicons name="images-outline" size={20} color={vintage.cream} />} />
            {busy ? <Text allowFontScaling accessibilityLiveRegion="polite" style={[styles.status, kit.font('body')]}>Preparing and securely reading the receipt…</Text> : null}
            {busy ? <Button label="Cancel" variant="quiet" onPress={cancelUpload} testID="cancel-receipt-upload" {...kit.quietButton} /> : null}
          </View>
        </View>
      )}
    </VintageScreen>
  );
}

const PRINT_MAT = 10;

const styles = StyleSheet.create({
  card: { ...vintageCard, padding: vintageSpace.xl, alignItems: 'center' },
  dashed: { position: 'absolute', top: vintageSpace.sm, left: vintageSpace.sm, right: vintageSpace.sm, bottom: vintageSpace.sm, borderWidth: 1, borderStyle: 'dashed', borderColor: withAlpha(vintage.gold, 0.7), borderRadius: vintageRadius.card - vintageSpace.sm / 2 },
  cameraRing: { width: 64, height: 64, borderRadius: 32, borderWidth: 2, borderColor: vintage.gold, padding: 3, marginTop: vintageSpace.sm },
  cameraCircle: { flex: 1, borderRadius: 29, backgroundColor: vintage.rust, alignItems: 'center', justifyContent: 'center' },
  cardTitle: { color: vintage.cream, fontSize: 20, lineHeight: 26, textAlign: 'center' },
  helper: { color: vintageText.muted, fontSize: 14, lineHeight: 20, textAlign: 'center', maxWidth: 300 },
  actions: { alignSelf: 'stretch', gap: vintageSpace.md, marginTop: vintageSpace.sm },
  status: { color: vintageText.muted, fontSize: 14, lineHeight: 20, textAlign: 'center' },
  printRow: { alignSelf: 'stretch', alignItems: 'center' },
  print: {
    padding: PRINT_MAT,
    backgroundColor: vintage.cream,
    borderWidth: 1,
    borderColor: vintage.gold,
    borderRadius: 4,
    shadowColor: '#000',
    shadowOpacity: 0.35,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  attachedRow: { alignSelf: 'stretch', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: vintageSpace.md },
  chip: { flexDirection: 'row', alignItems: 'center', gap: vintageSpace.xs, paddingVertical: vintageSpace.xs, paddingHorizontal: vintageSpace.md, borderRadius: 999, backgroundColor: withAlpha(vintage.sage, 0.25), borderWidth: 1, borderColor: vintage.sage },
  chipText: { color: vintage.cream, fontSize: 13, lineHeight: 18 },
  retake: { flexDirection: 'row', alignItems: 'center', gap: vintageSpace.xs, minHeight: 44, paddingHorizontal: vintageSpace.sm },
  retakeText: { color: vintage.gold, fontSize: 15, lineHeight: 20 },
  unavailable: { opacity: 0.55 },
});
