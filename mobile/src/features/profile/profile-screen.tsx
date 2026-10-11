import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { Easing, FadeInUp, useAnimatedStyle, useReducedMotion, useSharedValue, withDelay, withTiming } from 'react-native-reanimated';
import { Button } from '@/components/ui/button';
import { MessagePanel } from '@/components/ui/message-panel';
import { useAuth } from '@/providers/auth-provider';
import { tabBarClearance, vintageSpace } from '@/theme/vintage';
import { useVintageFonts } from '@/theme/use-vintage-fonts';
import { CuisineArt } from '@/features/cards/CuisineArtView';
import { cuisineKeyFor } from '@/features/cards/cuisineArt';
import { RarityBackground } from '@/features/cards/RarityBackground';
import { avatarLabels } from './avatars';
import { avatarArtFor, type AvatarKey } from './avatars/avatar-art';
import type { ProfileReview, ProfileStatistics } from './activity';
import type { ProfileAward, ProfilePinSlot } from './board';
import {
  cuisineDisplayName,
  discoveredLabel,
  favoriteCuisines,
  obsidian,
  obsidianSurface,
  obsidianText,
  sectionEnterDelay,
  xpSummary,
  type FavoriteCuisine,
} from './obsidian';
import { useProfileBoard } from './use-profile-board';

/** Room kept free at the top right for the floating settings gear. */
const GEAR_CLEARANCE = 64;
const AVATAR_SIZE = 104;
const RING_SIZE = AVATAR_SIZE + 14;
const TOKEN_SIZE = 64;
const ENTER_MS = 460;
const ENTER_EASING = Easing.out(Easing.cubic);

type Font = ReturnType<typeof useVintageFonts>['font'];

export function ProfileScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { font } = useVintageFonts();
  const { profile, session, status, profileError, refreshProfile, signOut, busy } = useAuth();
  const userId = session?.user.id ?? '';
  const { state: boardState, refresh } = useProfileBoard(profile ? userId : '', profile?.equippedTitleKey ?? null);

  // The obsidian ground needs light status-bar text, but only while this tab is on screen.
  const [focused, setFocused] = useState(false);
  useFocusEffect(useCallback(() => {
    setFocused(true);
    return () => setFocused(false);
  }, []));

  const favorites = useMemo(
    () => (boardState.status === 'ready' ? favoriteCuisines(boardState.board.ownedCards) : []),
    [boardState],
  );

  if (!profile) {
    return (
      <View style={styles.screen}>
        {focused ? <StatusBar style="light" /> : null}
        <RarityBackground palette="obsidian" />
        <View style={[styles.centered, { paddingTop: insets.top, paddingBottom: tabBarClearance(insets.bottom) }]}>
          <ObsidianNotice
            font={font}
            title={status === 'loading' ? 'Loading your profile' : 'Profile unavailable'}
            body={profileError ?? 'Your profile is private to your account.'}
            kind={status === 'loading' ? 'plain' : 'error'}
            loading={status === 'loading'}
            actionLabel={status === 'profile-error' ? 'Retry' : undefined}
            onAction={() => void refreshProfile()}
          />
        </View>
      </View>
    );
  }

  const xp = xpSummary(profile.accountXP, profile.accountLevel);
  const titleName = boardState.status === 'ready'
    ? boardState.board.equippedTitleName ?? (profile.equippedTitleKey ? profile.equippedTitleKey : null)
    : profile.equippedTitleKey;
  const statistics = boardState.status === 'ready' ? boardState.board.statistics : null;

  let section = 0;
  const next = () => section++;

  return (
    <View style={styles.screen}>
      {focused ? <StatusBar style="light" /> : null}
      <RarityBackground palette="obsidian" />
      <ScrollView
        contentInsetAdjustmentBehavior="never"
        style={styles.scroll}
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + vintageSpace.xl, paddingBottom: tabBarClearance(insets.bottom) + vintageSpace.xl },
        ]}
        indicatorStyle="white"
      >
        <Reveal index={next()} style={styles.header}>
          <Text allowFontScaling style={[styles.eyebrow, font('semibold')]}>YOUR ACCOUNT</Text>
          <Text allowFontScaling maxFontSizeMultiplier={1.25} accessibilityRole="header" style={[styles.title, font('display')]}>PROFILE</Text>
          <Text allowFontScaling style={[styles.subtitle, font('body')]}>The restaurants, titles, and badges that make up your journal.</Text>
        </Reveal>

        <Reveal index={next()}>
          <GlassCard style={styles.heroCard}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Edit profile"
              hitSlop={8}
              onPress={() => router.push('/profile/edit')}
              style={({ pressed }) => [styles.editButton, pressed ? styles.pressedSmall : undefined]}
            >
              <Ionicons name="pencil" size={18} color={obsidian.silver} />
            </Pressable>
            <AvatarRing avatarKey={profile.avatarKey} font={font} />
            <Text allowFontScaling numberOfLines={2} style={[styles.username, font('semibold')]}>{profile.displayName}</Text>
            {titleName ? (
              <LinearGradient colors={[obsidian.white, obsidian.silver, obsidian.silverDeep]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.titlePill}>
                <Ionicons name="ribbon" size={14} color={obsidianText.onSilver} />
                <Text allowFontScaling numberOfLines={1} style={[styles.titlePillText, font('semibold')]}>{titleName}</Text>
              </LinearGradient>
            ) : (
              <View style={styles.noTitlePill}>
                <Text allowFontScaling style={[styles.noTitleText, font('medium')]}>No title yet</Text>
              </View>
            )}
            <View style={styles.heroDivider} />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Manage title and pins"
              onPress={() => router.push('/profile/customize')}
              style={({ pressed }) => [styles.linkRow, pressed ? styles.pressedRow : undefined]}
            >
              <View style={styles.linkIcon}><Ionicons name="color-wand-outline" size={18} color={obsidian.silver} /></View>
              <Text allowFontScaling style={[styles.linkText, font('semibold')]}>Manage title and pins</Text>
              <Ionicons name="chevron-forward" size={18} color={obsidianText.muted} />
            </Pressable>
          </GlassCard>
        </Reveal>

        <Reveal index={next()}>
          <GlassCard style={styles.levelCard}>
            <View style={styles.levelHeading}>
              <View style={styles.levelTitleBlock}>
                <Text allowFontScaling style={[styles.cardEyebrow, font('semibold')]}>ACCOUNT LEVEL</Text>
                <Text allowFontScaling maxFontSizeMultiplier={1.3} style={[styles.levelTitle, font('display')]}>LEVEL {profile.accountLevel}</Text>
              </View>
              <View style={styles.totalXp}>
                <Ionicons name="sparkles" size={14} color={obsidian.silver} />
                <Text allowFontScaling style={[styles.totalXpText, font('semibold')]}>{profile.accountXP} XP</Text>
              </View>
            </View>
            <XpBar
              fraction={xp.fraction}
              accessibilityLabel={`${xp.xpIntoLevel} of ${xp.xpPerLevel} XP toward level ${xp.nextLevel}`}
              accessibilityValue={{ min: 0, max: xp.xpPerLevel, now: xp.xpIntoLevel }}
            />
            <Text allowFontScaling style={[styles.xpLabel, font('medium')]}>{xp.label}</Text>
            {statistics ? (
              <View style={styles.levelMeta}>
                <MetaItem icon="compass-outline" label={discoveredLabel(statistics.restaurantCount)} font={font} />
                <MetaItem icon="restaurant-outline" label={`${statistics.distinctDishCount} ${statistics.distinctDishCount === 1 ? 'dish' : 'dishes'} tried`} font={font} />
              </View>
            ) : null}
          </GlassCard>
        </Reveal>

        {boardState.status === 'loading' ? (
          <Reveal index={next()}>
            <ObsidianNotice font={font} title="Loading your journal" body="Pins, badges, and titles stay private to your account." loading />
          </Reveal>
        ) : null}
        {boardState.status === 'error' ? (
          <Reveal index={next()}>
            <ObsidianNotice font={font} title="Some profile details did not load" body={boardState.message} kind="error" actionLabel="Try again" onAction={() => void refresh()} />
          </Reveal>
        ) : null}
        {boardState.status === 'ready' ? (
          <>
            <Reveal index={next()}>
              <StatisticsRow statistics={boardState.board.statistics} reviewCount={boardState.board.reviews.length} font={font} />
            </Reveal>
            <Reveal index={next()}>
              <FavoriteCuisinesSection favorites={favorites} font={font} />
            </Reveal>
            <Reveal index={next()}>
              <PinSection pins={boardState.board.pins} font={font} />
            </Reveal>
            <Reveal index={next()}>
              <ReviewsSection reviews={boardState.board.reviews} onOpen={(cardId) => router.push(`/card/${cardId}`)} font={font} />
            </Reveal>
            <Reveal index={next()}>
              <AwardSection title="Badges" icon="medal-outline" empty="Badges appear here after you earn them." awards={boardState.board.badges} font={font} />
            </Reveal>
            <Reveal index={next()}>
              <AwardSection
                title="Titles"
                icon="ribbon-outline"
                empty="Titles you unlock will appear here."
                awards={boardState.board.titles}
                equippedKey={profile.equippedTitleKey}
                font={font}
              />
            </Reveal>
          </>
        ) : null}

        <Reveal index={next()}>
          <Button
            label="Sign out"
            variant="secondary"
            onPress={() => void signOut()}
            loading={busy}
            style={styles.signOut}
            textStyle={[styles.signOutText, font('semibold')]}
            leftIcon={<Ionicons name="log-out-outline" size={18} color={obsidian.silver} />}
          />
        </Reveal>
      </ScrollView>
    </View>
  );
}

/** Fades and slides a section up on mount, 60ms after the one before. Still under Reduce Motion. */
function Reveal({ index, style, children }: { index: number; style?: StyleProp<ViewStyle>; children: ReactNode }) {
  const reducedMotion = useReducedMotion();
  return (
    <Animated.View
      style={style}
      entering={reducedMotion ? undefined : FadeInUp.delay(sectionEnterDelay(index)).duration(ENTER_MS).easing(ENTER_EASING)}
    >
      {children}
    </Animated.View>
  );
}

/** A charcoal glass surface: a faint top-lit sheen and a silver hairline. */
function GlassCard({ style, children }: { style?: StyleProp<ViewStyle>; children: ReactNode }) {
  return (
    <LinearGradient
      colors={['rgba(255,255,255,0.09)', 'rgba(255,255,255,0.025)']}
      start={{ x: 0, y: 0 }}
      end={{ x: 0, y: 1 }}
      style={[styles.glassCard, style]}
    >
      {children}
    </LinearGradient>
  );
}

function AvatarRing({ avatarKey, font }: { avatarKey: AvatarKey; font: Font }) {
  const Art = avatarArtFor(avatarKey);
  const label = avatarLabels[avatarKey];
  return (
    <View style={styles.avatarGlow} accessible accessibilityRole="image" accessibilityLabel={`${label} avatar`}>
      <LinearGradient colors={[obsidian.white, obsidian.silver, obsidian.silverDeep, obsidian.silver]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.avatarRing}>
        <View style={styles.avatarDisc}>
          {Art ? <Art size={AVATAR_SIZE} /> : (
            <Text allowFontScaling={false} numberOfLines={1} adjustsFontSizeToFit style={[styles.avatarFallback, font('display')]}>{label}</Text>
          )}
        </View>
      </LinearGradient>
    </View>
  );
}

function XpBar({ fraction, accessibilityLabel, accessibilityValue }: {
  fraction: number;
  accessibilityLabel: string;
  accessibilityValue: { min: number; max: number; now: number };
}) {
  const reducedMotion = useReducedMotion();
  const progress = useSharedValue(reducedMotion ? fraction : 0);

  useEffect(() => {
    progress.set(reducedMotion ? fraction : withDelay(220, withTiming(fraction, { duration: 900, easing: Easing.out(Easing.cubic) })));
  }, [fraction, progress, reducedMotion]);

  const fillStyle = useAnimatedStyle(() => ({ width: `${progress.get() * 100}%` }));

  return (
    <View style={styles.track} accessibilityRole="progressbar" accessibilityLabel={accessibilityLabel} accessibilityValue={accessibilityValue}>
      <Animated.View style={[styles.fill, fillStyle]}>
        <LinearGradient colors={[obsidian.silverDeep, obsidian.silver, '#FFFFFF']} start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }} style={StyleSheet.absoluteFill} />
      </Animated.View>
    </View>
  );
}

function MetaItem({ icon, label, font }: { icon: keyof typeof Ionicons.glyphMap; label: string; font: Font }) {
  return (
    <View style={styles.metaItem}>
      <Ionicons name={icon} size={15} color={obsidianText.muted} />
      <Text allowFontScaling style={[styles.metaText, font('medium')]}>{label}</Text>
    </View>
  );
}

function SectionHeading({ title, count, font }: { title: string; count?: number; font: Font }) {
  return (
    <View style={styles.sectionHeading}>
      <Text allowFontScaling accessibilityRole="header" style={[styles.sectionTitle, font('display')]}>{title}</Text>
      {count !== undefined ? (
        <View style={styles.countChip}>
          <Text allowFontScaling style={[styles.countText, font('semibold')]}>{count}</Text>
        </View>
      ) : null}
    </View>
  );
}

function ObsidianNotice({ font, kind = 'plain', ...props }: {
  font: Font;
  title: string;
  body: string;
  kind?: 'plain' | 'error';
  loading?: boolean;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <MessagePanel
      {...props}
      kind={kind}
      style={[styles.notice, kind === 'error' ? styles.noticeError : undefined]}
      titleStyle={[styles.noticeTitle, font('semibold')]}
      bodyStyle={[styles.noticeBody, font('body')]}
      icon={<Ionicons name={kind === 'error' ? 'alert-circle' : 'information-circle'} size={24} color={kind === 'error' ? '#E8877A' : obsidian.silver} />}
      actionStyle={styles.outlineButton}
      actionTextStyle={[styles.outlineButtonText, font('semibold')]}
      indicatorColor={obsidian.silver}
    />
  );
}

function StatisticsRow({ statistics, reviewCount, font }: { statistics: ProfileStatistics; reviewCount: number; font: Font }) {
  // The profile has no city data, so the middle tile shows verified visits (what this screen
  // already reported) instead.
  const items: { label: string; value: number; icon: keyof typeof Ionicons.glyphMap; spoken: string }[] = [
    { label: 'Cards', value: statistics.restaurantCount, icon: 'albums-outline', spoken: 'Restaurants collected' },
    { label: 'Visits', value: statistics.verifiedVisitCount, icon: 'receipt-outline', spoken: 'Verified visits' },
    { label: 'Reviews', value: reviewCount, icon: 'chatbubble-ellipses-outline', spoken: 'Reviews' },
  ];
  return (
    <View style={styles.statRow}>
      {items.map((item) => (
        <GlassCard key={item.label} style={styles.statTile}>
          <View accessible accessibilityLabel={`${item.spoken}: ${item.value}`} style={styles.statInner}>
            <View style={styles.statIcon}><Ionicons name={item.icon} size={18} color={obsidian.silver} /></View>
            <Text allowFontScaling maxFontSizeMultiplier={1.3} numberOfLines={1} adjustsFontSizeToFit style={[styles.statValue, font('semibold')]}>{item.value}</Text>
            <Text allowFontScaling numberOfLines={1} style={[styles.statLabel, font('semibold')]}>{item.label.toUpperCase()}</Text>
          </View>
        </GlassCard>
      ))}
    </View>
  );
}

function FavoriteCuisinesSection({ favorites, font }: { favorites: FavoriteCuisine[]; font: Font }) {
  return (
    <View style={styles.section}>
      <SectionHeading title="Favorite cuisines" font={font} />
      {favorites.length === 0 ? (
        <GlassCard style={styles.emptyCard}>
          <Text allowFontScaling style={[styles.emptyText, font('body')]}>Your most-collected cuisines will appear here as your collection grows.</Text>
        </GlassCard>
      ) : (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.bleed} contentContainerStyle={styles.cuisineRow}>
          {favorites.map((favorite) => (
            <View
              key={favorite.key}
              style={styles.cuisineItem}
              accessible
              accessibilityLabel={`${cuisineDisplayName(favorite.key)}, ${favorite.count} ${favorite.count === 1 ? 'card' : 'cards'}`}
            >
              <View style={styles.cuisineRing}>
                <View style={styles.cuisineToken}>
                  <CuisineArt cuisine={favorite.key} variant="token" />
                </View>
                <View style={styles.cuisineCount}>
                  <Text allowFontScaling={false} style={[styles.cuisineCountText, font('semibold')]}>{favorite.count}</Text>
                </View>
              </View>
              <Text allowFontScaling numberOfLines={1} style={[styles.cuisineLabel, font('medium')]}>{cuisineDisplayName(favorite.key)}</Text>
            </View>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

function PinSection({ pins, font }: { pins: ProfilePinSlot[]; font: Font }) {
  return (
    <View style={styles.section}>
      <SectionHeading title="Pinned restaurants" font={font} />
      <View style={styles.pinRow}>
        {pins.map((pin) => {
          const filled = Boolean(pin.cardId) && !pin.unavailable;
          return (
            <View key={pin.slot} accessible accessibilityLabel={pinLabel(pin)} style={[styles.pinSlot, filled ? styles.pinFilled : styles.pinEmpty]}>
              <Text allowFontScaling style={[styles.pinEyebrow, font('semibold')]}>SLOT {pin.slot}</Text>
              {filled && pin.restaurantName ? (
                <View style={styles.pinToken}>
                  <CuisineArt cuisine={cuisineKeyFor({ name: pin.restaurantName })} variant="token" />
                </View>
              ) : (
                <View style={styles.pinPlaceholder}>
                  <Ionicons name={pin.unavailable ? 'alert-circle-outline' : 'add'} size={20} color={obsidianText.muted} />
                </View>
              )}
              {pin.unavailable ? <Text allowFontScaling style={[styles.pinName, font('semibold')]}>Card unavailable</Text> : null}
              {!pin.cardId ? <Text allowFontScaling style={[styles.pinMuted, font('medium')]}>Empty</Text> : null}
              {pin.restaurantName ? <Text allowFontScaling numberOfLines={2} style={[styles.pinName, font('semibold')]}>{pin.restaurantName}</Text> : null}
              {pin.stageLabel ? <Text allowFontScaling style={[styles.pinMuted, font('medium')]}>{pin.stageLabel}</Text> : null}
            </View>
          );
        })}
      </View>
    </View>
  );
}

function pinLabel(pin: ProfilePinSlot): string {
  if (pin.unavailable) return `Pin slot ${pin.slot}, card unavailable`;
  if (!pin.cardId) return `Pin slot ${pin.slot}, empty`;
  return `Pin slot ${pin.slot}, ${pin.restaurantName ?? 'restaurant'}${pin.stageLabel ? `, ${pin.stageLabel}` : ''}`;
}

function ReviewsSection({ reviews, onOpen, font }: { reviews: ProfileReview[]; onOpen: (cardId: string) => void; font: Font }) {
  return (
    <View style={styles.section}>
      <SectionHeading title="My Reviews" count={reviews.length} font={font} />
      {reviews.length === 0 ? (
        <GlassCard style={styles.emptyCard}>
          <Text allowFontScaling style={[styles.rowTitle, font('semibold')]}>No ratings or reviews yet</Text>
          <Text allowFontScaling style={[styles.emptyText, font('body')]}>Your restaurant ratings and written notes will appear here.</Text>
        </GlassCard>
      ) : (
        <View style={styles.list}>
          {reviews.map((review) => (
            <Pressable
              key={review.restaurantId}
              accessibilityRole="button"
              accessibilityHint="Opens this restaurant's card to edit your review"
              onPress={() => onOpen(review.cardId)}
              style={({ pressed }) => [styles.row, pressed ? styles.pressedRow : undefined]}
            >
              <View style={styles.rowHeading}>
                <Text allowFontScaling style={[styles.rowTitle, styles.flex, font('semibold')]}>{review.restaurantName}</Text>
                {review.rating === null ? (
                  <View style={styles.unratedPill}>
                    <Text allowFontScaling style={[styles.unratedText, font('semibold')]}>Unrated</Text>
                  </View>
                ) : (
                  <View style={styles.ratingPill}>
                    <Ionicons name="star" size={12} color={obsidianText.onSilver} />
                    <Text allowFontScaling style={[styles.ratingText, font('semibold')]}>{`${review.rating.toFixed(1)} / 5`}</Text>
                  </View>
                )}
              </View>
              {review.text.trim() ? (
                <Text allowFontScaling selectable style={[styles.rowBody, font('body')]}>{review.text}</Text>
              ) : (
                <Text allowFontScaling style={[styles.rowMuted, font('body')]}>Rating only</Text>
              )}
              <View style={styles.rowFooter}>
                <Text allowFontScaling style={[styles.rowMuted, styles.flex, font('medium')]}>Updated {formatReviewDate(review.updatedAt)}</Text>
                <Ionicons name="chevron-forward" size={16} color={obsidianText.muted} />
              </View>
            </Pressable>
          ))}
        </View>
      )}
    </View>
  );
}

function formatReviewDate(value: string): string {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return value;
  return date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

function AwardSection({ title, icon, empty, awards, equippedKey, font }: {
  title: string;
  icon: keyof typeof Ionicons.glyphMap;
  empty: string;
  awards: ProfileAward[];
  equippedKey?: string | null;
  font: Font;
}) {
  return (
    <View style={styles.section}>
      <SectionHeading title={title} count={awards.length} font={font} />
      {awards.length === 0 ? (
        <GlassCard style={styles.emptyCard}>
          <Text allowFontScaling style={[styles.emptyText, font('body')]}>{empty}</Text>
        </GlassCard>
      ) : (
        <View style={styles.list}>
          {awards.map((award) => {
            const equipped = equippedKey != null && award.key === equippedKey;
            return (
              <View key={award.key} style={[styles.row, styles.awardRow, equipped ? styles.awardEquipped : undefined]}>
                <View style={styles.awardIcon}><Ionicons name={icon} size={20} color={obsidian.silver} /></View>
                <View style={styles.awardText}>
                  <View style={styles.rowHeading}>
                    <Text allowFontScaling style={[styles.rowTitle, styles.flex, font('semibold')]}>{award.name}</Text>
                    {equipped ? (
                      <View style={styles.ratingPill}>
                        <Text allowFontScaling style={[styles.ratingText, font('semibold')]}>Equipped</Text>
                      </View>
                    ) : null}
                  </View>
                  {award.description ? <Text allowFontScaling style={[styles.rowMuted, font('body')]}>{award.description}</Text> : null}
                </View>
              </View>
            );
          })}
        </View>
      )}
    </View>
  );
}

const S = vintageSpace;

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: obsidian.black },
  scroll: { flex: 1, backgroundColor: 'transparent' },
  content: { paddingHorizontal: S.xl, gap: S.xl },
  centered: { flex: 1, justifyContent: 'center', paddingHorizontal: S.xl },
  flex: { flex: 1 },

  header: { paddingRight: GEAR_CLEARANCE - S.xl, gap: S.sm },
  eyebrow: { color: obsidian.silver, fontSize: 12, lineHeight: 16, letterSpacing: 2.5 },
  title: {
    color: obsidian.white,
    fontSize: 44,
    lineHeight: 50,
    letterSpacing: 1,
    textShadowColor: obsidianSurface.glow,
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 14,
  },
  subtitle: { color: obsidianText.secondary, fontSize: 15, lineHeight: 22, maxWidth: 320 },

  glassCard: {
    borderRadius: 24,
    borderWidth: 1,
    borderColor: obsidianSurface.hairline,
    overflow: 'hidden',
  },
  heroCard: { paddingTop: S.xxl, paddingBottom: S.sm, paddingHorizontal: S.xl, alignItems: 'center', gap: S.md },
  editButton: {
    position: 'absolute',
    top: S.lg,
    right: S.lg,
    zIndex: 1,
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: obsidianSurface.glassStrong,
    borderWidth: 1,
    borderColor: obsidianSurface.hairline,
  },
  pressedSmall: { opacity: 0.7, transform: [{ scale: 0.94 }] },
  pressedRow: { opacity: 0.75 },
  avatarGlow: {
    width: RING_SIZE,
    height: RING_SIZE,
    borderRadius: RING_SIZE / 2,
    marginBottom: S.xs,
    boxShadow: '0 0 28px rgba(201,204,211,0.35)',
  },
  avatarRing: { width: RING_SIZE, height: RING_SIZE, borderRadius: RING_SIZE / 2, padding: 3, alignItems: 'center', justifyContent: 'center' },
  avatarDisc: {
    width: RING_SIZE - 6,
    height: RING_SIZE - 6,
    borderRadius: (RING_SIZE - 6) / 2,
    backgroundColor: obsidian.black,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarFallback: { color: obsidian.silver, fontSize: 20, lineHeight: 26, paddingHorizontal: S.md, letterSpacing: 0.5 },
  username: { color: obsidianText.primary, fontSize: 26, lineHeight: 32, textAlign: 'center', letterSpacing: 0.2 },
  titlePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: S.xs + 2,
    paddingHorizontal: S.lg,
    paddingVertical: S.xs + 2,
    borderRadius: 999,
    maxWidth: '100%',
  },
  titlePillText: { color: obsidianText.onSilver, fontSize: 13, lineHeight: 18, letterSpacing: 0.4, flexShrink: 1 },
  noTitlePill: {
    paddingHorizontal: S.lg,
    paddingVertical: S.xs + 2,
    borderRadius: 999,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: obsidianSurface.hairlineStrong,
  },
  noTitleText: { color: obsidianText.muted, fontSize: 13, lineHeight: 18 },
  heroDivider: { alignSelf: 'stretch', height: StyleSheet.hairlineWidth, backgroundColor: obsidianSurface.hairline, marginTop: S.sm },
  linkRow: { alignSelf: 'stretch', flexDirection: 'row', alignItems: 'center', gap: S.md, minHeight: 52 },
  linkIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: obsidianSurface.glassStrong,
  },
  linkText: { flex: 1, color: obsidianText.primary, fontSize: 15, lineHeight: 20 },

  levelCard: { padding: S.xl, gap: S.md },
  levelHeading: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: S.md },
  levelTitleBlock: { flexShrink: 1, gap: S.xs },
  cardEyebrow: { color: obsidianText.muted, fontSize: 11, lineHeight: 14, letterSpacing: 2 },
  levelTitle: { color: obsidian.white, fontSize: 30, lineHeight: 36, letterSpacing: 1 },
  totalXp: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: S.xs,
    paddingHorizontal: S.md,
    paddingVertical: S.xs,
    borderRadius: 999,
    backgroundColor: obsidianSurface.glassStrong,
    marginBottom: S.xs,
  },
  totalXpText: { color: obsidianText.secondary, fontSize: 12, lineHeight: 16 },
  track: { height: 14, borderRadius: 7, backgroundColor: obsidianSurface.track, overflow: 'hidden', marginTop: S.xs },
  fill: { height: '100%', borderRadius: 7, overflow: 'hidden' },
  xpLabel: { color: obsidianText.primary, fontSize: 14, lineHeight: 20 },
  levelMeta: { flexDirection: 'row', flexWrap: 'wrap', columnGap: S.lg, rowGap: S.xs, paddingTop: S.md, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: obsidianSurface.hairline },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: S.xs + 2 },
  metaText: { color: obsidianText.muted, fontSize: 13, lineHeight: 18 },

  statRow: { flexDirection: 'row', gap: S.md },
  statTile: { flex: 1, borderRadius: 20 },
  statInner: { paddingVertical: S.lg, paddingHorizontal: S.md, gap: S.xs, alignItems: 'flex-start' },
  statIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: obsidianSurface.glassStrong,
    marginBottom: S.xs,
  },
  statValue: { color: obsidianText.primary, fontSize: 30, lineHeight: 36, fontVariant: ['tabular-nums'] },
  statLabel: { color: obsidianText.muted, fontSize: 11, lineHeight: 14, letterSpacing: 1.2 },

  section: { gap: S.md },
  sectionHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: S.md },
  sectionTitle: { color: obsidianText.primary, fontSize: 19, lineHeight: 26, letterSpacing: 0.6 },
  countChip: {
    minWidth: 28,
    paddingHorizontal: S.sm,
    paddingVertical: 2,
    borderRadius: 999,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: obsidianSurface.hairline,
    backgroundColor: obsidianSurface.glass,
  },
  countText: { color: obsidianText.secondary, fontSize: 12, lineHeight: 18 },

  emptyCard: { padding: S.lg, gap: S.xs, borderRadius: 16 },
  emptyText: { color: obsidianText.muted, fontSize: 14, lineHeight: 20 },

  bleed: { marginHorizontal: -S.xl },
  cuisineRow: { paddingHorizontal: S.xl, gap: S.lg },
  cuisineItem: { width: TOKEN_SIZE + 12, alignItems: 'center', gap: S.sm },
  cuisineRing: {
    width: TOKEN_SIZE + 8,
    height: TOKEN_SIZE + 8,
    borderRadius: (TOKEN_SIZE + 8) / 2,
    borderWidth: 2,
    borderColor: obsidian.silver,
    padding: 2,
    boxShadow: '0 0 12px rgba(201,204,211,0.25)',
  },
  cuisineToken: { width: TOKEN_SIZE, height: TOKEN_SIZE, borderRadius: TOKEN_SIZE / 2, overflow: 'hidden' },
  cuisineCount: {
    position: 'absolute',
    right: -4,
    bottom: -4,
    minWidth: 22,
    height: 22,
    paddingHorizontal: 6,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: obsidian.silver,
    borderWidth: 2,
    borderColor: obsidian.charcoal,
  },
  cuisineCountText: { color: obsidianText.onSilver, fontSize: 11, lineHeight: 14 },
  cuisineLabel: { color: obsidianText.secondary, fontSize: 12, lineHeight: 16 },

  pinRow: { flexDirection: 'row', gap: S.md },
  pinSlot: { flex: 1, minHeight: 156, padding: S.md, gap: S.sm, borderRadius: 20, borderWidth: 1 },
  pinFilled: { backgroundColor: obsidianSurface.glassStrong, borderColor: obsidianSurface.hairlineStrong },
  pinEmpty: { backgroundColor: 'transparent', borderStyle: 'dashed', borderColor: obsidianSurface.hairline },
  pinEyebrow: { color: obsidianText.muted, fontSize: 10, lineHeight: 14, letterSpacing: 1.5 },
  pinToken: { width: 44, height: 44, borderRadius: 22, overflow: 'hidden', borderWidth: 1.5, borderColor: obsidian.silver },
  pinPlaceholder: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: obsidianSurface.hairlineStrong,
  },
  pinName: { color: obsidianText.primary, fontSize: 13, lineHeight: 18 },
  pinMuted: { color: obsidianText.muted, fontSize: 12, lineHeight: 16 },

  list: { gap: S.sm },
  row: {
    padding: S.lg,
    gap: S.sm,
    borderRadius: 16,
    backgroundColor: obsidianSurface.glass,
    borderWidth: 1,
    borderColor: obsidianSurface.hairline,
  },
  rowHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: S.md },
  rowTitle: { color: obsidianText.primary, fontSize: 16, lineHeight: 22 },
  rowBody: { color: obsidianText.secondary, fontSize: 15, lineHeight: 22 },
  rowMuted: { color: obsidianText.muted, fontSize: 13, lineHeight: 18 },
  rowFooter: { flexDirection: 'row', alignItems: 'center', gap: S.sm },
  ratingPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: S.xs,
    paddingHorizontal: S.md,
    paddingVertical: S.xs,
    borderRadius: 999,
    backgroundColor: obsidian.silver,
  },
  ratingText: { color: obsidianText.onSilver, fontSize: 12, lineHeight: 16 },
  unratedPill: {
    paddingHorizontal: S.md,
    paddingVertical: S.xs,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: obsidianSurface.hairlineStrong,
  },
  unratedText: { color: obsidianText.muted, fontSize: 12, lineHeight: 16 },
  awardRow: { flexDirection: 'row', alignItems: 'flex-start', gap: S.md },
  awardEquipped: { borderColor: obsidianSurface.hairlineStrong, backgroundColor: obsidianSurface.glassStrong },
  awardIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: obsidianSurface.glassStrong,
    borderWidth: 1,
    borderColor: obsidianSurface.hairline,
  },
  awardText: { flex: 1, gap: S.xs },

  notice: {
    backgroundColor: obsidianSurface.glassStrong,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: obsidianSurface.hairline,
    borderLeftWidth: 4,
    borderLeftColor: obsidian.silver,
    padding: S.lg,
    alignSelf: 'stretch',
  },
  noticeError: { borderLeftColor: '#E8877A' },
  noticeTitle: { color: obsidianText.primary, fontSize: 17, lineHeight: 22 },
  noticeBody: { color: obsidianText.secondary, fontSize: 14, lineHeight: 20 },
  outlineButton: { minHeight: 48, borderRadius: 14, backgroundColor: 'transparent', borderColor: obsidianSurface.hairlineStrong, borderWidth: 1 },
  outlineButtonText: { color: obsidianText.primary, fontSize: 15, lineHeight: 20 },

  signOut: {
    minHeight: 52,
    borderRadius: 16,
    backgroundColor: obsidianSurface.glass,
    borderColor: obsidianSurface.hairlineStrong,
    borderWidth: 1,
  },
  signOutText: { color: obsidianText.primary, fontSize: 16, lineHeight: 22, letterSpacing: 0.3 },
});
