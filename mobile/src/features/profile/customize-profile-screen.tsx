import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import type { Profile, ProfilePinsResponse } from '@foodie-cards/shared';
import type { Session } from '@supabase/supabase-js';
import { AppText } from '@/components/ui/app-text';
import { Button } from '@/components/ui/button';
import { MessagePanel } from '@/components/ui/message-panel';
import { useAuth } from '@/providers/auth-provider';
import { PrivateRouteGuard } from '../auth/PrivateRouteGuard';
import { colors, radius, spacing } from '@/theme/tokens';
import type { ProfileAward, ProfileBoard } from './board';
import {
  assignPin,
  movePin,
  pinRequest,
  removePin,
  titleRequest,
  type ProfilePin,
} from './customization';
import { equipProfileTitle, saveProfilePins } from './profile-actions-api';
import { useProfileBoard } from './use-profile-board';

export function CustomizeProfileScreen() {
  return <PrivateRouteGuard><CustomizeProfileContent /></PrivateRouteGuard>;
}

function CustomizeProfileContent() {
  const { profile, session, refreshProfile } = useAuth();
  if (!profile || !session) {
    return (
      <View style={styles.centered}>
        <MessagePanel title="Profile options unavailable" body="Your account details could not be loaded." kind="error" actionLabel="Retry" onAction={() => void refreshProfile()} />
      </View>
    );
  }
  return <CustomizationLoader profile={profile} session={session} />;
}

function CustomizationLoader({ profile, session }: { profile: Profile; session: Session }) {
  const { state, refresh } = useProfileBoard(session.user.id, profile.equippedTitleKey);
  if (state.status === 'error') {
    return (
      <View style={styles.centered}>
        <MessagePanel title="Profile options unavailable" body={state.message} kind="error" actionLabel="Try again" onAction={() => void refresh()} />
      </View>
    );
  }
  if (state.status !== 'ready') {
    return (
      <View style={styles.centered}>
        <MessagePanel title="Loading profile options" body="Checking your unlocked titles and cards." loading />
      </View>
    );
  }
  return <CustomizationForm board={state.board} profile={profile} session={session} refreshBoard={refresh} />;
}

function CustomizationForm({
  board,
  profile,
  session,
  refreshBoard,
}: {
  board: ProfileBoard;
  profile: Profile;
  session: Session;
  refreshBoard: () => Promise<void>;
}) {
  const router = useRouter();
  const { refreshProfile } = useAuth();
  const [titleKey, setTitleKey] = useState<string | null>(profile.equippedTitleKey);
  const [pins, setPins] = useState<ProfilePin[]>(() =>
    board.pins.flatMap((pin) => pin.cardId ? [{ slot: pin.slot, cardId: pin.cardId }] : []),
  );
  const [selectedSlot, setSelectedSlot] = useState<ProfilePin['slot']>(1);
  const [titleSaving, setTitleSaving] = useState(false);
  const [pinsSaving, setPinsSaving] = useState(false);
  const [titleMessage, setTitleMessage] = useState<{ kind: 'error' | 'success'; text: string } | null>(null);
  const [pinsMessage, setPinsMessage] = useState<{ kind: 'error' | 'success'; text: string } | null>(null);
  const ownedCardIds = board.ownedCards.map((card) => card.id);
  const unlockedTitleKeys = board.titles.map((title) => title.key);

  async function saveTitle() {
    setTitleMessage(null);
    setTitleSaving(true);
    try {
      const request = titleRequest(titleKey, unlockedTitleKeys);
      const response = await equipProfileTitle({
        apiBaseUrl: process.env.EXPO_PUBLIC_API_URL ?? '',
        accessToken: session.access_token,
        request,
      });
      if (response.equippedTitleKey !== request.titleKey) {
        throw new Error('The profile service returned an unexpected equipped title.');
      }
      setTitleMessage({ kind: 'success', text: request.titleKey ? 'Title equipped.' : 'Title unequipped.' });
      await refreshProfile();
    } catch (error) {
      setTitleMessage({
        kind: 'error',
        text: error instanceof Error && error.message ? error.message : 'Your title could not be saved.',
      });
    } finally {
      setTitleSaving(false);
    }
  }

  async function savePins() {
    setPinsMessage(null);
    setPinsSaving(true);
    try {
      const request = pinRequest(pins, ownedCardIds);
      const response = await saveProfilePins({
        apiBaseUrl: process.env.EXPO_PUBLIC_API_URL ?? '',
        accessToken: session.access_token,
        request,
      });
      const savedPins = verifiedPinsResponse(response, ownedCardIds, request.pins);
      setPins(savedPins);
      setPinsMessage({ kind: 'success', text: 'Pinned restaurants saved.' });
      await refreshBoard();
    } catch (error) {
      setPinsMessage({
        kind: 'error',
        text: error instanceof Error && error.message ? error.message : 'Your pinned restaurants could not be saved.',
      });
    } finally {
      setPinsSaving(false);
    }
  }

  const selectedPin = pins.find((pin) => pin.slot === selectedSlot);

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content} contentInsetAdjustmentBehavior="automatic">
      <Button label="Back" variant="quiet" fullWidth={false} onPress={() => router.canGoBack() ? router.back() : router.replace('/(tabs)/profile')} />
      <View style={styles.heading}>
        <AppText variant="title" strong>Customize profile</AppText>
        <AppText muted>Equip an unlocked title and arrange up to three restaurant cards.</AppText>
      </View>

      <View style={styles.section}>
        <AppText variant="heading" strong>Equipped title</AppText>
        <TitleChoice title={null} selected={titleKey === null} disabled={titleSaving} onPress={() => setTitleKey(null)} />
        {board.titles.length === 0 ? <AppText muted>No titles unlocked yet.</AppText> : null}
        {board.titles.map((title) => (
          <TitleChoice key={title.key} title={title} selected={titleKey === title.key} disabled={titleSaving} onPress={() => setTitleKey(title.key)} />
        ))}
        <StatusMessage message={titleMessage} />
        <Button label="Save title" loading={titleSaving} disabled={pinsSaving} onPress={() => void saveTitle()} />
      </View>

      <View style={styles.section}>
        <AppText variant="heading" strong>Pinned restaurants</AppText>
        <AppText variant="small" muted>Select a slot, then choose an owned card. Moving a card onto an occupied slot swaps them.</AppText>
        <View style={styles.slotRow}>
          {([1, 2, 3] as const).map((slot) => {
            const pin = pins.find((candidate) => candidate.slot === slot);
            const card = board.ownedCards.find((candidate) => candidate.id === pin?.cardId);
            return (
              <Pressable
                key={slot}
                accessibilityRole="radio"
                accessibilityLabel={`Pin slot ${slot}${card?.restaurantName ? `, ${card.restaurantName}` : ', empty'}`}
                accessibilityState={{ checked: selectedSlot === slot, disabled: pinsSaving }}
                disabled={pinsSaving}
                onPress={() => setSelectedSlot(slot)}
                style={[styles.slot, selectedSlot === slot ? styles.selected : undefined]}
              >
                <AppText variant="caption" strong>SLOT {slot}</AppText>
                <AppText variant="small" strong={!!card} numberOfLines={3}>{card?.restaurantName ?? 'Empty'}</AppText>
              </Pressable>
            );
          })}
        </View>

        {selectedPin ? (
          <View style={styles.actions}>
            <Button label="Remove" variant="secondary" fullWidth={false} disabled={pinsSaving} onPress={() => setPins((current) => removePin(current, selectedSlot, ownedCardIds))} />
            <Button label="Move left" variant="quiet" fullWidth={false} disabled={pinsSaving || selectedSlot === 1} onPress={() => {
              const destination = (selectedSlot - 1) as ProfilePin['slot'];
              setPins((current) => movePin(current, selectedSlot, destination, ownedCardIds));
              setSelectedSlot(destination);
            }} />
            <Button label="Move right" variant="quiet" fullWidth={false} disabled={pinsSaving || selectedSlot === 3} onPress={() => {
              const destination = (selectedSlot + 1) as ProfilePin['slot'];
              setPins((current) => movePin(current, selectedSlot, destination, ownedCardIds));
              setSelectedSlot(destination);
            }} />
          </View>
        ) : null}

        <View style={styles.cardChoices}>
          {board.ownedCards.length === 0 ? <AppText muted>Earn a restaurant card before adding profile pins.</AppText> : null}
          {board.ownedCards.map((card) => {
            const usedIn = pins.find((pin) => pin.cardId === card.id)?.slot;
            const unavailable = usedIn !== undefined && usedIn !== selectedSlot;
            return (
              <Pressable
                key={card.id}
                accessibilityRole="button"
                accessibilityLabel={`${card.restaurantName ?? 'Restaurant card'}${unavailable ? `, already in slot ${usedIn}` : ''}`}
                accessibilityState={{ disabled: pinsSaving || unavailable }}
                disabled={pinsSaving || unavailable}
                onPress={() => setPins((current) => assignPin(current, selectedSlot, card.id, ownedCardIds))}
                style={[styles.cardChoice, selectedPin?.cardId === card.id ? styles.selected : undefined, unavailable ? styles.disabled : undefined]}
              >
                <AppText strong>{card.restaurantName ?? 'Restaurant card'}</AppText>
                <AppText variant="small" muted>{card.locationLabel ?? card.stage}</AppText>
                {unavailable ? <AppText variant="caption" muted>Already in slot {usedIn}</AppText> : null}
              </Pressable>
            );
          })}
        </View>
        <StatusMessage message={pinsMessage} />
        <Button label="Save pins" loading={pinsSaving} disabled={titleSaving} onPress={() => void savePins()} />
      </View>
    </ScrollView>
  );
}

function verifiedPinsResponse(
  response: ProfilePinsResponse,
  ownedCardIds: readonly string[],
  requestedPins: readonly ProfilePin[],
): ProfilePin[] {
  const saved = pinRequest(response.pins, ownedCardIds).pins;
  if (JSON.stringify(saved) !== JSON.stringify(requestedPins)) {
    throw new Error('The profile service returned unexpected pinned restaurants.');
  }
  return saved;
}

function TitleChoice({
  title,
  selected,
  disabled,
  onPress,
}: {
  title: ProfileAward | null;
  selected: boolean;
  disabled: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityLabel={title?.name ?? 'No equipped title'}
      accessibilityState={{ checked: selected, disabled }}
      disabled={disabled}
      onPress={onPress}
      style={[styles.choice, selected ? styles.selected : undefined]}
    >
      <AppText strong>{title?.name ?? 'No title'}</AppText>
      {title?.description ? <AppText variant="small" muted>{title.description}</AppText> : null}
    </Pressable>
  );
}

function StatusMessage({ message }: { message: { kind: 'error' | 'success'; text: string } | null }) {
  if (!message) return null;
  return (
    <View style={message.kind === 'error' ? styles.error : styles.success} accessibilityRole="alert">
      <AppText variant="small" style={message.kind === 'error' ? styles.errorText : styles.successText}>{message.text}</AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.canvas },
  content: { padding: spacing.page, paddingBottom: spacing.xxl, gap: spacing.xl },
  centered: { flex: 1, justifyContent: 'center', padding: spacing.page, backgroundColor: colors.canvas },
  heading: { gap: spacing.sm },
  section: { padding: spacing.lg, gap: spacing.md, borderRadius: radius.card, backgroundColor: colors.surface },
  choice: { padding: spacing.md, gap: spacing.xs, borderWidth: 1, borderColor: colors.border, borderRadius: radius.control },
  selected: { borderColor: colors.accent, backgroundColor: colors.accentSoft },
  slotRow: { flexDirection: 'row', gap: spacing.sm },
  slot: { flex: 1, minHeight: 100, padding: spacing.md, gap: spacing.xs, borderWidth: 1, borderColor: colors.border, borderRadius: radius.control },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  cardChoices: { gap: spacing.sm },
  cardChoice: { padding: spacing.md, gap: spacing.xs, borderWidth: 1, borderColor: colors.border, borderRadius: radius.control },
  disabled: { opacity: 0.5 },
  error: { padding: spacing.md, borderRadius: radius.control, backgroundColor: colors.errorSoft },
  errorText: { color: colors.error },
  success: { padding: spacing.md, borderRadius: radius.control, backgroundColor: colors.surfaceMuted },
  successText: { color: colors.success },
});
