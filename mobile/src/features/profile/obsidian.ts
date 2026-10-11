// The Profile screen's "obsidian" look: near-black into charcoal, silver accents, near-white
// type. Pure values and helpers only (no React Native imports), so they can be unit-tested.

import { cuisineKeyFor, type CuisineKey } from '../cards/cuisineArt';
import { levelProgress } from './progress';

export const obsidian = {
  black: '#0B0B0D',
  charcoal: '#1C1C21',
  graphite: '#2A2A31',
  silver: '#C9CCD3',
  silverDeep: '#8E929B',
  white: '#F2F2F5',
} as const;

/** Text on the obsidian ground. Every value keeps at least 4.5:1 against charcoal. */
export const obsidianText = {
  primary: obsidian.white,
  secondary: 'rgba(242,242,245,0.78)',
  muted: 'rgba(242,242,245,0.62)',
  accent: obsidian.silver,
  /** Dark text on a silver pill. */
  onSilver: '#141418',
} as const;

/** Glass surfaces and hairlines laid over the obsidian ground. */
export const obsidianSurface = {
  glass: 'rgba(255,255,255,0.05)',
  glassStrong: 'rgba(255,255,255,0.08)',
  hairline: 'rgba(201,204,211,0.22)',
  hairlineStrong: 'rgba(201,204,211,0.45)',
  track: 'rgba(255,255,255,0.08)',
  glow: 'rgba(201,204,211,0.55)',
} as const;

/** Vertical background gradient, top to bottom. */
export const OBSIDIAN_GRADIENT = [obsidian.black, obsidian.charcoal, obsidian.graphite] as const;

/** Delay before a section's enter animation: sections cascade in 60ms apart. */
export const SECTION_STAGGER_MS = 60;
export function sectionEnterDelay(index: number): number {
  return Math.max(0, Math.floor(index)) * SECTION_STAGGER_MS;
}

export type XpSummary = {
  level: number;
  nextLevel: number;
  xpIntoLevel: number;
  xpPerLevel: number;
  xpToNext: number;
  /** 0..1, how full the bar is. */
  fraction: number;
  /** "120 / 200 XP · 80 to Lv 4" */
  label: string;
};

/** The level card's numbers, from the same math as progress.ts (200 XP per level). */
export function xpSummary(accountXP: number, accountLevel: number): XpSummary {
  const progress = levelProgress(accountXP, accountLevel);
  const level = progress.nextLevel - 1;
  const xpToNext = progress.xpPerLevel - progress.xpIntoLevel;
  const fraction = progress.xpPerLevel > 0 ? Math.min(1, Math.max(0, progress.xpIntoLevel / progress.xpPerLevel)) : 0;
  return {
    level,
    nextLevel: progress.nextLevel,
    xpIntoLevel: progress.xpIntoLevel,
    xpPerLevel: progress.xpPerLevel,
    xpToNext,
    fraction,
    label: `${progress.xpIntoLevel} / ${progress.xpPerLevel} XP · ${xpToNext} to Lv ${progress.nextLevel}`,
  };
}

/** "1 restaurant discovered" / "4 restaurants discovered". */
export function discoveredLabel(count: number): string {
  const n = Math.max(0, Math.floor(count));
  return `${n} ${n === 1 ? 'restaurant' : 'restaurants'} discovered`;
}

export type FavoriteCuisine = { key: CuisineKey; count: number };

/**
 * The cuisines the player collects most, worked out from their owned cards' restaurant names
 * through the one cuisine decision (generic food words only, never a brand). Cards whose name
 * says nothing about the food ('default') are left out. Most collected first, then A to Z.
 */
export function favoriteCuisines(cards: readonly { restaurantName: string | null }[], limit = 6): FavoriteCuisine[] {
  const counts = new Map<CuisineKey, number>();
  for (const card of cards) {
    if (!card.restaurantName) continue;
    const key = cuisineKeyFor({ name: card.restaurantName });
    if (key === 'default') continue;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([key, count]) => ({ key, count }))
    .sort((a, b) => b.count - a.count || a.key.localeCompare(b.key))
    .slice(0, Math.max(0, limit));
}

const CUISINE_NAMES: Partial<Record<CuisineKey, string>> = { bbq: 'BBQ', default: 'Restaurant' };

/** Display name for a cuisine key: "japanese" → "Japanese", "bbq" → "BBQ". */
export function cuisineDisplayName(key: CuisineKey): string {
  return CUISINE_NAMES[key] ?? key.charAt(0).toUpperCase() + key.slice(1);
}
