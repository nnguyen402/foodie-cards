import { describe, expect, it } from 'vitest';
import {
  assignPin,
  movePin,
  pinRequest,
  removePin,
  titleRequest,
} from '../src/features/profile/customization';

const ownedCards = ['card-a', 'card-b', 'card-c', 'card-d'];

describe('equipped title selection', () => {
  it('allows only unlocked titles', () => {
    expect(titleRequest('loyal_regular', ['loyal_regular'])).toEqual({
      titleKey: 'loyal_regular',
    });
    expect(() => titleRequest('locked_title', ['loyal_regular'])).toThrow(
      'Only an unlocked title can be equipped.',
    );
  });

  it('uses null to unequip a title', () => {
    expect(titleRequest(null, [])).toEqual({ titleKey: null });
  });
});

describe('profile pin selection', () => {
  it('rejects cards the user does not own', () => {
    expect(() => pinRequest([{ slot: 1, cardId: 'foreign-card' }], ownedCards))
      .toThrow('Only owned restaurant cards can be pinned.');
  });

  it('rejects duplicate cards and duplicate slots', () => {
    expect(() => pinRequest([
      { slot: 1, cardId: 'card-a' },
      { slot: 2, cardId: 'card-a' },
    ], ownedCards)).toThrow();
    expect(() => pinRequest([
      { slot: 1, cardId: 'card-a' },
      { slot: 1, cardId: 'card-b' },
    ], ownedCards)).toThrow();
  });

  it('rejects more than three pins', () => {
    expect(() => pinRequest([
      { slot: 1, cardId: 'card-a' },
      { slot: 2, cardId: 'card-b' },
      { slot: 3, cardId: 'card-c' },
      { slot: 4, cardId: 'card-d' },
    ], ownedCards)).toThrow();
  });

  it('preserves explicit slots and returns them in slot order', () => {
    expect(pinRequest([
      { slot: 3, cardId: 'card-c' },
      { slot: 1, cardId: 'card-a' },
    ], ownedCards).pins).toEqual([
      { slot: 1, cardId: 'card-a' },
      { slot: 3, cardId: 'card-c' },
    ]);
  });

  it('supports adding, replacing, removing, and reordering pins', () => {
    let pins = assignPin([], 1, 'card-a', ownedCards);
    pins = assignPin(pins, 2, 'card-b', ownedCards);
    pins = assignPin(pins, 1, 'card-c', ownedCards);
    expect(pins).toEqual([
      { slot: 1, cardId: 'card-c' },
      { slot: 2, cardId: 'card-b' },
    ]);

    pins = movePin(pins, 1, 2, ownedCards);
    expect(pins).toEqual([
      { slot: 1, cardId: 'card-b' },
      { slot: 2, cardId: 'card-c' },
    ]);

    expect(removePin(pins, 1, ownedCards)).toEqual([
      { slot: 2, cardId: 'card-c' },
    ]);
  });
});
