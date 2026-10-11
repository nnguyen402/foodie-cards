import type { RestaurantStage } from '@foodie-cards/shared';

// Display labels only. Persisted stage keys and the rules that award them stay on the server.
const labels: Record<RestaurantStage, string> = {
  discovered: 'Common',
  regular: 'Rare',
  house_favorite: 'Ultra Rare',
};

export type StageGoal = { stage: RestaurantStage; xp: number; visits: number };

const goals: Record<RestaurantStage, StageGoal | null> = {
  discovered: { stage: 'regular', xp: 300, visits: 3 },
  regular: { stage: 'house_favorite', xp: 750, visits: 6 },
  house_favorite: null,
};

export function stageLabel(stage: RestaurantStage): string {
  return labels[stage];
}

export function nextStageGoal(stage: RestaurantStage): StageGoal | null {
  return goals[stage];
}

// Colours for anything lit in a card's rarity: the card detail background and the rarity
// label's glow. `shades` run dark to light and stay dark enough for text; `glow` is the bright
// edge. Common is the frame's silver, Rare its bronze and gold, Ultra Rare its indigo and gold.
export type StageTheme = { glow: string; label: string; shades: readonly [string, string, string] };

const themes: Record<RestaurantStage, StageTheme> = {
  discovered: { glow: '#c9d1dc', label: '#e6ebf2', shades: ['#171b21', '#212832', '#2d3643'] },
  regular: { glow: '#e0a23a', label: '#ffcf6b', shades: ['#1f1507', '#33230b', '#4d3410'] },
  house_favorite: { glow: '#f5c542', label: '#f5c542', shades: ['#120a2b', '#201046', '#33196b'] },
};

export function stageTheme(stage: RestaurantStage): StageTheme {
  return themes[stage];
}

/** The card detail's backdrop: midnight blue under the rarity-coloured diamonds, and behind the header. */
export const DETAIL_BACKGROUND = '#191970';
