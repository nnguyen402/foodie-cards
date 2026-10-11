import { describe, expect, it } from 'vitest';
import { describeProgress } from '../src/features/cards/progress';

describe('card progress summary', () => {
  it('shows XP and visit requirements separately', () => {
    expect(describeProgress({ stage: 'discovered', cardXP: 240, visitCount: 2 })).toEqual({
      nextStageLabel: 'Rare',
      text: '240/300 XP · 2/3 visits',
      xpMet: false,
      visitsMet: false,
    });
  });

  it('keeps the visit requirement visible when XP alone is satisfied', () => {
    const progress = describeProgress({ stage: 'discovered', cardXP: 420, visitCount: 2 });
    expect(progress.text).toBe('420/300 XP · 2/3 visits');
    expect(progress.xpMet).toBe(true);
    expect(progress.visitsMet).toBe(false);
  });

  it('measures a Rare card against the Ultra Rare requirements', () => {
    expect(describeProgress({ stage: 'regular', cardXP: 330, visitCount: 3 })).toEqual({
      nextStageLabel: 'Ultra Rare',
      text: '330/750 XP · 3/6 visits',
      xpMet: false,
      visitsMet: false,
    });
  });

  it('says the highest stage is reached while XP keeps counting', () => {
    expect(describeProgress({ stage: 'house_favorite', cardXP: 900, visitCount: 8 })).toEqual({
      nextStageLabel: null,
      text: 'Highest stage reached · 900 XP · 8 visits',
      xpMet: true,
      visitsMet: true,
    });
  });

  it('uses the singular for one visit at the highest stage', () => {
    expect(describeProgress({ stage: 'house_favorite', cardXP: 750, visitCount: 1 }).text)
      .toBe('Highest stage reached · 750 XP · 1 visit');
  });
});
