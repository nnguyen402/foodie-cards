import { describe, expect, it } from 'vitest';
import { buildProfileBoard } from '../src/features/profile/board';
import { levelProgress } from '../src/features/profile/progress';
import { profileColumnUpdate } from '../src/features/profile/save-profile';

const titles = [
  { key: 'cafe_crawler', name: 'Café Crawler', description: 'Three cafés.' },
  { key: 'loyal_regular', name: 'Loyal Regular', description: 'One House Favorite.' },
];

describe('profile board', () => {
  it('keeps three pin slots and leaves missing slots empty', () => {
    const board = buildProfileBoard({
      pins: [{ slot: 2, cardId: 'card-2' }],
      cards: [{ id: 'card-2', stage: 'regular', restaurantName: 'The Varsity', locationLabel: 'Downtown', }],
      badgeKeys: [],
      titleKeys: [],
      badges: [],
      titles: [],
      equippedTitleKey: null,
    });

    expect(board.pins.map((pin) => pin.slot)).toEqual([1, 2, 3]);
    expect(board.pins[0]).toMatchObject({ cardId: null, unavailable: false });
    expect(board.pins[1]).toMatchObject({ restaurantName: 'The Varsity', stageLabel: 'Regular', unavailable: false });
    expect(board.pins[2]).toMatchObject({ cardId: null });
  });

  it('marks a pin whose card is not readable as unavailable', () => {
    const board = buildProfileBoard({
      pins: [{ slot: 1, cardId: 'missing-card' }],
      cards: [],
      badgeKeys: [],
      titleKeys: [],
      badges: [],
      titles: [],
      equippedTitleKey: null,
    });
    expect(board.pins[0]).toMatchObject({ unavailable: true, restaurantName: null });
  });

  it('uses catalog names for unlocked badges and the equipped title', () => {
    const board = buildProfileBoard({
      pins: [],
      cards: [],
      badgeKeys: ['first_bite'],
      titleKeys: ['cafe_crawler'],
      badges: [{ key: 'first_bite', name: 'First Bite', description: 'Open your first restaurant card.' }],
      titles,
      equippedTitleKey: 'cafe_crawler',
    });
    expect(board.badges).toEqual([{ key: 'first_bite', name: 'First Bite', description: 'Open your first restaurant card.' }]);
    expect(board.titles[0].name).toBe('Café Crawler');
    expect(board.equippedTitleName).toBe('Café Crawler');
  });
});

describe('account level progress', () => {
  it('measures progress inside the current 200 XP level', () => {
    expect(levelProgress(0, 1)).toEqual({ xpIntoLevel: 0, xpPerLevel: 200, nextLevel: 2 });
    expect(levelProgress(199, 1)).toMatchObject({ xpIntoLevel: 199, nextLevel: 2 });
    expect(levelProgress(200, 2)).toMatchObject({ xpIntoLevel: 0, nextLevel: 3 });
    expect(levelProgress(350, 2)).toEqual({ xpIntoLevel: 150, xpPerLevel: 200, nextLevel: 3 });
  });
});

describe('profile edits', () => {
  it('updates only the display name and avatar columns', () => {
    expect(profileColumnUpdate({ displayName: '  Nora  ', avatarKey: 'plate' })).toEqual({
      display_name: 'Nora',
      avatar_key: 'plate',
    });
    expect(() => profileColumnUpdate({ displayName: 'Nora', avatarKey: 'fork', accountXP: 999 } as never)).toThrow();
  });
});
