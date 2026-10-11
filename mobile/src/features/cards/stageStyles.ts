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
