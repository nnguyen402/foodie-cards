import { describe, expect, it } from 'vitest';
import { DIAMOND_COLUMNS, DIAMOND_ROWS, SIZE_STEPS, diamondLayout, fullDiamondSize } from '../src/features/cards/diamondLayout';
import { nextStageGoal, stageLabel, stageTheme } from '../src/features/cards/stageStyles';

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

describe('stageTheme', () => {
  it('gives each stage its own dark shades and glow', () => {
    const stages = ['discovered', 'regular', 'house_favorite'] as const;
    for (const stage of stages) {
      const theme = stageTheme(stage);
      expect(theme.shades).toHaveLength(3);
      for (const shade of [...theme.shades, theme.glow, theme.label]) expect(shade).toMatch(/^#[0-9a-f]{6}$/i);
    }
    expect(new Set(stages.map((stage) => stageTheme(stage).glow)).size).toBe(3);
  });
});

describe('diamondLayout', () => {
  const first = diamondLayout(390, 844);

  it('is the same every time, and for the same screen', () => {
    expect(diamondLayout(390, 844)).toEqual(first);
  });

  it('makes 40 diamonds in sizes of 1/8 to 8/8 of the full size, in steps of 1/8', () => {
    expect(first).toHaveLength(DIAMOND_COLUMNS * DIAMOND_ROWS);
    expect(first).toHaveLength(40);
    const full = fullDiamondSize(390);
    const steps = new Set(first.map((diamond) => Math.round((diamond.size / full) * SIZE_STEPS)));
    for (const diamond of first) expect(Number.isInteger(Math.round((diamond.size / full) * SIZE_STEPS * 1e6) / 1e6)).toBe(true);
    expect([...steps].every((step) => step >= 1 && step <= SIZE_STEPS)).toBe(true);
    expect(steps.size).toBeGreaterThan(4);
  });

  it('puts one diamond in each grid cell, so they spread out', () => {
    const cells = new Set(first.map((diamond) => `${Math.floor((diamond.top + diamond.size / 2) / (844 / DIAMOND_ROWS))}:${Math.floor((diamond.left + diamond.size / 2) / (390 / DIAMOND_COLUMNS))}`));
    expect(cells.size).toBe(40);
  });
});
