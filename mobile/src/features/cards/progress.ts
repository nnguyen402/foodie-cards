import type { RestaurantStage } from '@foodie-cards/shared';
import { nextStageGoal, stageLabel } from './stageStyles';

export type CardProgress = {
  nextStageLabel: string | null;
  text: string;
  xpMet: boolean;
  visitsMet: boolean;
};

export function describeProgress({ stage, cardXP, visitCount }: { stage: RestaurantStage; cardXP: number; visitCount: number }): CardProgress {
  const goal = nextStageGoal(stage);
  if (!goal) {
    return {
      nextStageLabel: null,
      text: `Highest stage reached · ${cardXP} XP · ${visitCount} ${visitCount === 1 ? 'visit' : 'visits'}`,
      xpMet: true,
      visitsMet: true,
    };
  }
  return {
    nextStageLabel: stageLabel(goal.stage),
    text: `${cardXP}/${goal.xp} XP · ${visitCount}/${goal.visits} visits`,
    xpMet: cardXP >= goal.xp,
    visitsMet: visitCount >= goal.visits,
  };
}
