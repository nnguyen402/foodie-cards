import { describe, expect, it } from 'vitest';
import { nextStageGoal, stageLabel } from '../src/features/cards/stageStyles';

describe('card stage presentation', () => {
  it('shows the collector label for each persisted stage', () => {
    expect(stageLabel('discovered')).toBe('Common');
    expect(stageLabel('regular')).toBe('Rare');
    expect(stageLabel('house_favorite')).toBe('Ultra Rare');
  });

  it('targets Rare at 300 XP and 3 visits from Common', () => {
    expect(nextStageGoal('discovered')).toEqual({ stage: 'regular', xp: 300, visits: 3 });
  });

  it('targets Ultra Rare at 750 XP and 6 visits from Rare', () => {
    expect(nextStageGoal('regular')).toEqual({ stage: 'house_favorite', xp: 750, visits: 6 });
  });

  it('has no further goal at the highest stage', () => {
    expect(nextStageGoal('house_favorite')).toBeNull();
  });
});
