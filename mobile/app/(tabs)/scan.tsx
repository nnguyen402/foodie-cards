import { useEffect, useMemo, useRef, useState } from 'react';
import { Image, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { File } from 'expo-file-system';
import * as ImageManipulator from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { BrandHeader } from '@/components/brand-header';
import { AppText } from '@/components/ui/app-text';
import { Button } from '@/components/ui/button';
import { MessagePanel } from '@/components/ui/message-panel';
import { colors, radius, spacing } from '@/theme/tokens';
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
      router.push({ pathname: '/receipt/confirm', params: { draftId: draft.draftId } });
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

  return (
    <ScrollView contentInsetAdjustmentBehavior="automatic" style={styles.screen} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <BrandHeader eyebrow="Add a visit" title="Scan a receipt" subtitle="Review every detail before a visit is added to your collection." />
      {error ? <MessagePanel title="Receipt not ready" body={error} kind="error" /> : null}
      {status !== 'signed-in' || !session ? (
        <MessagePanel title="Sign in to continue" body="A receipt draft is private to your account. Sign in before adding one." />
      ) : (
        <View style={styles.panel}>
          <View style={styles.mark}><AppText variant="title" strong style={styles.markText}>+</AppText></View>
          <AppText variant="heading" strong>Photograph or upload your receipt</AppText>
          <AppText muted>We’ll prepare a private editable draft. Nothing is added to your collection until you confirm it.</AppText>
          {preparedImage ? <Image source={{ uri: preparedImage.previewUri }} style={styles.preview} accessibilityLabel="Selected receipt preview" /> : null}
          {preparedImage ? <AppText variant="caption" muted>{preparedImage.name}</AppText> : null}
          <Button label="Take a photo" onPress={() => void chooseImage('camera')} loading={busy} testID="capture-receipt" />
          <Button label={cameraDenied ? 'Choose from library' : 'Upload from library'} variant="secondary" onPress={() => void chooseImage('library')} loading={busy} testID="choose-receipt" />
          {busy ? <AppText variant="small" muted>Preparing and securely reading the receipt…</AppText> : null}
          {busy ? <Button label="Cancel" variant="quiet" onPress={cancelUpload} testID="cancel-receipt-upload" /> : null}
          {error && preparedImage && !busy ? <Button label="Retry upload" variant="quiet" onPress={() => {
            const current = flow.current.snapshot();
            const operation = ++operationId.current;
            void uploadImage(preparedImage, operation, current);
          }} testID="retry-receipt-upload" /> : null}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.canvas },
  content: { padding: spacing.page, paddingBottom: spacing.xxl, gap: spacing.xl },
  panel: { padding: spacing.xl, gap: spacing.md, backgroundColor: colors.surface, borderRadius: radius.card, borderWidth: 1, borderColor: colors.border },
  mark: { height: 52, width: 52, alignItems: 'center', justifyContent: 'center', borderRadius: 18, backgroundColor: colors.accentSoft },
  markText: { color: colors.accent },
  preview: { width: '100%', height: 240, borderRadius: radius.control, backgroundColor: colors.surfaceMuted, resizeMode: 'contain' },
});
