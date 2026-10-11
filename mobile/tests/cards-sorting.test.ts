import { describe, expect, it } from 'vitest';
import { sortCards, type SortableCard } from '../src/features/cards/sorting';

const card = (id: string, overrides: Partial<SortableCard> = {}): SortableCard => ({
  id, rating: null, cardXP: 0, lastVisitDate: null, restaurant: { name: id }, ...overrides,
});
const ids = (cards: SortableCard[]) => cards.map((item) => item.id);

describe('collection sorting', () => {
  it('orders by highest personal rating', () => {
    const cards = [card('a', { rating: 3 }), card('b', { rating: 4.5 }), card('c', { rating: 4 })];
    expect(ids(sortCards(cards, 'rating'))).toEqual(['b', 'c', 'a']);
  });

  it('treats zero stars as rated and places unrated cards last', () => {
    const cards = [card('unrated'), card('zero', { rating: 0 }), card('two', { rating: 2 })];
    expect(ids(sortCards(cards, 'rating'))).toEqual(['two', 'zero', 'unrated']);
  });

  it('breaks rating ties by card XP', () => {
    const cards = [card('low', { rating: 4, cardXP: 100 }), card('high', { rating: 4, cardXP: 300 })];
    expect(ids(sortCards(cards, 'rating'))).toEqual(['high', 'low']);
  });

  it('orders by highest card XP', () => {
    const cards = [card('a', { cardXP: 140 }), card('b', { cardXP: 760 }), card('c', { cardXP: 330 })];
    expect(ids(sortCards(cards, 'xp'))).toEqual(['b', 'c', 'a']);
  });

  it('orders by most recent visit with never-visited cards last', () => {
    const cards = [
      card('never'),
      card('older', { lastVisitDate: '2026-09-28' }),
      card('newer', { lastVisitDate: '2026-10-04' }),
    ];
    expect(ids(sortCards(cards, 'recent'))).toEqual(['newer', 'older', 'never']);
  });

  it('falls back to restaurant name so equal cards keep a stable order', () => {
    const cards = [card('Varsity'), card('Antico')];
    expect(ids(sortCards(cards, 'xp'))).toEqual(['Antico', 'Varsity']);
  });

  it('does not reorder the array it was given', () => {
    const cards = [card('a', { cardXP: 1 }), card('b', { cardXP: 2 })];
    sortCards(cards, 'xp');
    expect(ids(cards)).toEqual(['a', 'b']);
  });
});
