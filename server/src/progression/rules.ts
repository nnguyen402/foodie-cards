import type { RestaurantStage } from '@foodie-cards/shared';

export type ReceiptXPInput = {
  previousVisits: number;
  isFirstVisit: boolean;
  isNewVisitDate: boolean;
  distinctItems: number;
  newItems: number;
  additionalUnits: number;
};

export type ReceiptXPBreakdown = {
  visitXP: number;
  purchaseBaseXP: number;
  multiplier: number;
  purchaseXP: number;
  totalXP: number;
};

export function calculateReceiptXP(input: ReceiptXPInput): ReceiptXPBreakdown {
  const { previousVisits, isFirstVisit, isNewVisitDate, distinctItems, newItems, additionalUnits } = input;
  const visitXP = isFirstVisit ? 100 : isNewVisitDate ? 50 : 0;
  const purchaseBaseXP = 10 * distinctItems + 30 * newItems + Math.min(10, 2 * additionalUnits);
  const multiplier = previousVisits >= 10 ? 1.3 : previousVisits >= 6 ? 1.2 : previousVisits >= 3 ? 1.1 : 1;
  const purchaseXP = Math.floor(purchaseBaseXP * multiplier);
  return { visitXP, purchaseBaseXP, multiplier, purchaseXP, totalXP: visitXP + purchaseXP };
}

export function getCardStage(cardXP: number, visitCount: number): RestaurantStage {
  if (cardXP >= 750 && visitCount >= 6) return 'house_favorite';
  if (cardXP >= 300 && visitCount >= 3) return 'regular';
  return 'discovered';
}
