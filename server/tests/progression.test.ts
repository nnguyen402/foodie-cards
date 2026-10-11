import { describe, expect, it } from 'vitest';
import { calculateReceiptXP, getCardStage } from '../src/progression/rules.ts';

describe('calculateReceiptXP', () => {
  it('awards a first visit with one new item 140 XP', () => {
    expect(calculateReceiptXP({
      previousVisits: 0, isFirstVisit: true, isNewVisitDate: true,
      distinctItems: 1, newItems: 1, additionalUnits: 0,
    })).toEqual({ visitXP: 100, purchaseBaseXP: 40, multiplier: 1, purchaseXP: 40, totalXP: 140 });
  });

  it('multiplies purchase XP for a fourth distinct visit and floors the result', () => {
    expect(calculateReceiptXP({
      previousVisits: 3, isFirstVisit: false, isNewVisitDate: true,
      distinctItems: 2, newItems: 1, additionalUnits: 0,
    })).toEqual({ visitXP: 50, purchaseBaseXP: 50, multiplier: 1.1, purchaseXP: 55, totalXP: 105 });
  });

  it('caps additional-unit XP at 10 before applying the multiplier', () => {
    expect(calculateReceiptXP({
      previousVisits: 0, isFirstVisit: true, isNewVisitDate: true,
      distinctItems: 1, newItems: 0, additionalUnits: 8,
    })).toEqual({ visitXP: 100, purchaseBaseXP: 20, multiplier: 1, purchaseXP: 20, totalXP: 120 });
  });

  it('does not award a visit bonus for another receipt on the same date', () => {
    expect(calculateReceiptXP({
      previousVisits: 1, isFirstVisit: false, isNewVisitDate: false,
      distinctItems: 1, newItems: 0, additionalUnits: 0,
    })).toEqual({ visitXP: 0, purchaseBaseXP: 10, multiplier: 1, purchaseXP: 10, totalXP: 10 });
  });

  it.each([
    [0, 1], [2, 1], [3, 1.1], [5, 1.1], [6, 1.2], [9, 1.2], [10, 1.3], [100, 1.3],
  ])('uses the visit multiplier for %i previous visits', (previousVisits, multiplier) => {
    expect(calculateReceiptXP({
      previousVisits, isFirstVisit: previousVisits === 0, isNewVisitDate: true,
      distinctItems: 1, newItems: 0, additionalUnits: 0,
    }).multiplier).toBe(multiplier);
  });
});

describe('getCardStage', () => {
  it('keeps 300 XP at two visits Discovered', () => {
    expect(getCardStage(300, 2)).toBe('discovered');
  });

  it('promotes 300 XP and three visits to Regular', () => {
    expect(getCardStage(300, 3)).toBe('regular');
  });

  it('promotes 750 XP and six visits to House Favorite', () => {
    expect(getCardStage(750, 6)).toBe('house_favorite');
  });

  it('requires both XP and visit thresholds for every stage', () => {
    expect(getCardStage(299, 10)).toBe('discovered');
    expect(getCardStage(750, 5)).toBe('regular');
    expect(getCardStage(749, 6)).toBe('regular');
  });
});
