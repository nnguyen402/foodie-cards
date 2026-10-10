import type {
  ApiError,
  Profile,
  ProgressionResult,
  ReceiptDraft,
  ReviewResponse,
} from './contracts.js';

/** Synthetic UI fixtures only. Never submit these values to an award endpoint. */
export const DEMO_FIXTURE_LABEL = 'DEMO ONLY — synthetic data; no persisted XP is awarded';

export const demoFixtures = {
  emptyAccount: {
    label: DEMO_FIXTURE_LABEL,
    profile: {
      userId: 'demo-user-empty', displayName: 'Foodie', avatarKey: 'fork',
      accountXP: 0, accountLevel: 1, equippedTitleKey: null,
    } satisfies Profile,
    cards: [],
    pins: [],
    badges: [],
  },

  receiptDraft: {
    label: DEMO_FIXTURE_LABEL,
    draft: {
      draftId: 'demo-draft-receipt', restaurantId: 'demo-restaurant-cafe',
      receiptDate: '2026-10-04', receiptNumber: null, totalMinor: 1425, currency: 'USD',
      items: [{ originalText: 'LG LATTE', suggestedName: 'Latte', quantity: 1 }], warnings: [],
    } satisfies ReceiptDraft,
  },

  firstUnlock: {
    label: DEMO_FIXTURE_LABEL,
    result: {
      receiptId: 'demo-receipt-first', cardId: 'demo-card-first',
      xpBreakdown: { visitXP: 100, purchaseBaseXP: 40, multiplier: 1, purchaseXP: 40, totalXP: 140 },
      cardXP: 140, visitCount: 1, stage: 'discovered', accountXP: 150, accountLevel: 1,
      newBadges: ['first_bite'], newTitles: [], revealEventId: 'demo-reveal-first',
    } satisfies ProgressionResult,
  },

  ordinaryReceipt: {
    label: DEMO_FIXTURE_LABEL,
    result: {
      receiptId: 'demo-receipt-ordinary', cardId: 'demo-card-first',
      xpBreakdown: { visitXP: 50, purchaseBaseXP: 20, multiplier: 1, purchaseXP: 20, totalXP: 70 },
      cardXP: 210, visitCount: 2, stage: 'discovered', accountXP: 150, accountLevel: 1,
      newBadges: [], newTitles: [], revealEventId: null,
    } satisfies ProgressionResult,
  },

  evolution: {
    label: DEMO_FIXTURE_LABEL,
    result: {
      receiptId: 'demo-receipt-evolution', cardId: 'demo-card-first',
      xpBreakdown: { visitXP: 50, purchaseBaseXP: 100, multiplier: 1.1, purchaseXP: 110, totalXP: 160 },
      cardXP: 330, visitCount: 3, stage: 'regular', accountXP: 350, accountLevel: 2,
      newBadges: ['cafe_crawler'], newTitles: ['cafe_crawler'], revealEventId: 'demo-reveal-evolution',
    } satisfies ProgressionResult,
  },

  duplicateError: {
    label: DEMO_FIXTURE_LABEL,
    error: {
      code: 'DUPLICATE_RECEIPT',
      message: 'This receipt appears to have already been submitted.',
      retryable: false,
    } satisfies ApiError,
  },

  reviewedPinnedCard: {
    label: DEMO_FIXTURE_LABEL,
    profile: {
      userId: 'demo-user-reviewed', displayName: 'Demo Foodie', avatarKey: 'plate',
      accountXP: 350, accountLevel: 2, equippedTitleKey: null,
    } satisfies Profile,
    review: {
      review: { restaurantId: 'demo-restaurant-cafe', rating: 4.5, text: 'A warm neighborhood favorite.', updatedAt: '2026-10-04T17:30:00.000Z' },
      accountXP: 400, accountLevel: 3, newBadges: ['first_impressions'], newTitles: [],
    } satisfies ReviewResponse,
    pins: [{ cardId: 'demo-card-first', slot: 1 as const }],
  },
} as const;
