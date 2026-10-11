import { z } from 'zod';

const calendarDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected YYYY-MM-DD').refine((value) => {
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}, 'Expected a real calendar date');

export const restaurantStageSchema = z.enum(['discovered', 'regular', 'house_favorite']);
export type RestaurantStage = z.infer<typeof restaurantStageSchema>;

export const restaurantThemeSchema = z.object({
  primaryColor: z.string().regex(/^#[\da-fA-F]{6}$/),
  accentColor: z.string().regex(/^#[\da-fA-F]{6}$/),
  fontKey: z.enum(['rounded', 'bold', 'elegant', 'friendly']),
  patternKey: z.enum(['none', 'dots', 'lines', 'paper']),
});
export type RestaurantTheme = z.infer<typeof restaurantThemeSchema>;

const defaultThemes: Record<string, RestaurantTheme> = {
  cafe: { primaryColor: '#F2E4CC', accentColor: '#8A563A', fontKey: 'friendly', patternKey: 'paper' },
  bakery: { primaryColor: '#F7E5D2', accentColor: '#AE5D45', fontKey: 'rounded', patternKey: 'dots' },
  japanese: { primaryColor: '#E9E4DB', accentColor: '#37545A', fontKey: 'elegant', patternKey: 'lines' },
  restaurant: { primaryColor: '#E9E9E9', accentColor: '#555555', fontKey: 'bold', patternKey: 'none' },
  neutral: { primaryColor: '#ECEBE7', accentColor: '#66645F', fontKey: 'friendly', patternKey: 'none' },
};

export function resolveRestaurantTheme(category: string, overrides: Partial<RestaurantTheme> = {}): RestaurantTheme {
  const base = defaultThemes[category.trim().toLowerCase()] ?? defaultThemes.neutral;
  const candidates = { ...base, ...overrides };
  const parsed = restaurantThemeSchema.safeParse(candidates);
  if (!parsed.success) return { ...base };
  return parsed.data;
}

export const receiptItemDraftSchema = z.object({
  originalText: z.string().trim().min(1),
  suggestedName: z.string().trim().min(1),
  quantity: z.number().int().positive(),
});
export const receiptItemConfirmedSchema = z.object({
  originalText: z.string().trim().min(1),
  confirmedName: z.string().trim().min(1),
  quantity: z.number().int().positive(),
});

export const receiptDraftSchema = z.object({
  draftId: z.string().min(1),
  restaurantName: z.string().nullable().optional(),
  restaurantId: z.string().min(1).nullable(),
  receiptDate: calendarDate.nullable(),
  receiptNumber: z.string().nullable(),
  totalMinor: z.number().int().nonnegative().nullable(),
  currency: z.string().regex(/^[A-Z]{3}$/).nullable(),
  items: z.array(receiptItemDraftSchema),
  warnings: z.array(z.string()),
});
export type ReceiptDraft = z.infer<typeof receiptDraftSchema>;

export const receiptRestaurantSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  locationLabel: z.string(),
});
export type ReceiptRestaurant = z.infer<typeof receiptRestaurantSchema>;
export const receiptRestaurantsResponseSchema = z.object({ restaurants: z.array(receiptRestaurantSchema) });

export const confirmedReceiptSchema = z.object({
  draftId: z.string().min(1),
  submissionId: z.string().min(1),
  restaurantId: z.string().min(1),
  receiptDate: calendarDate,
  receiptNumber: z.string().nullable(),
  totalMinor: z.number().int().nonnegative(),
  currency: z.string().regex(/^[A-Z]{3}$/),
  items: z.array(receiptItemConfirmedSchema).min(1),
});
export type ConfirmedReceipt = z.infer<typeof confirmedReceiptSchema>;

export const progressionResultSchema = z.object({
  receiptId: z.string().min(1),
  cardId: z.string().min(1),
  xpBreakdown: z.object({
    visitXP: z.number().int().nonnegative(),
    purchaseBaseXP: z.number().int().nonnegative(),
    multiplier: z.number().positive(),
    purchaseXP: z.number().int().nonnegative(),
    totalXP: z.number().int().nonnegative(),
  }),
  cardXP: z.number().int().nonnegative(),
  visitCount: z.number().int().nonnegative(),
  stage: restaurantStageSchema,
  accountXP: z.number().int().nonnegative(),
  accountLevel: z.number().int().positive(),
  newBadges: z.array(z.string()),
  newTitles: z.array(z.string()),
  revealEventId: z.string().min(1).nullable(),
});
export type ProgressionResult = z.infer<typeof progressionResultSchema>;

export const apiErrorCodeSchema = z.enum([
  'UNAUTHORIZED', 'INVALID_RECEIPT', 'UNSUPPORTED_RESTAURANT', 'DUPLICATE_RECEIPT',
  'AI_UNAVAILABLE', 'UPLOAD_FAILED', 'INVALID_REQUEST', 'NOT_FOUND', 'FORBIDDEN',
  'CONFIGURATION_ERROR', 'INTERNAL_ERROR',
  'AUTH_UNAVAILABLE',
]);
export type ApiErrorCode = z.infer<typeof apiErrorCodeSchema>;
export const apiErrorSchema = z.object({
  code: apiErrorCodeSchema,
  message: z.string().min(1),
  retryable: z.boolean(),
});
export type ApiError = z.infer<typeof apiErrorSchema>;

export const avatarKeySchema = z.enum(['fork', 'plate', 'bowl', 'noodles', 'taco', 'donut']);
export const profileSchema = z.object({
  userId: z.string().min(1),
  displayName: z.string().trim().min(1).max(40),
  avatarKey: avatarKeySchema,
  accountXP: z.number().int().nonnegative(),
  accountLevel: z.number().int().positive(),
  equippedTitleKey: z.string().min(1).nullable(),
});
export type Profile = z.infer<typeof profileSchema>;
export type ProfileResponse = Profile;

export const profileEditRequestSchema = z.object({
  displayName: z.string().trim().min(1).max(40),
  avatarKey: avatarKeySchema,
}).strict();
export type ProfileEditRequest = z.infer<typeof profileEditRequestSchema>;
export const profileEditResponseSchema = z.object({ profile: profileSchema });
export type ProfileEditResponse = z.infer<typeof profileEditResponseSchema>;

export const profilePinSchema = z.object({ cardId: z.string().min(1), slot: z.number().int().min(1).max(3) });
export const profilePinsRequestSchema = z.object({
  pins: z.array(profilePinSchema).max(3)
    .refine((pins) => new Set(pins.map((pin) => pin.cardId)).size === pins.length, 'A card can be pinned once')
    .refine((pins) => new Set(pins.map((pin) => pin.slot)).size === pins.length, 'Each pin slot can be used once'),
}).strict();
export type ProfilePinsRequest = z.infer<typeof profilePinsRequestSchema>;
export const profilePinsResponseSchema = z.object({ pins: z.array(profilePinSchema).max(3) });
export type ProfilePinsResponse = z.infer<typeof profilePinsResponseSchema>;

export const equipTitleRequestSchema = z.object({ titleKey: z.string().min(1).nullable() }).strict();
export type EquipTitleRequest = z.infer<typeof equipTitleRequestSchema>;
export const equipTitleResponseSchema = z.object({ equippedTitleKey: z.string().min(1).nullable() });
export type EquipTitleResponse = z.infer<typeof equipTitleResponseSchema>;

export const ratingSchema = z.number().min(0).max(5).refine((value) => Number.isInteger(value * 2), 'Rating must use half-star increments').nullable();
export const reviewRequestSchema = z.object({
  rating: ratingSchema,
  text: z.string().max(500).refine((value) => value.length === 0 || value.trim().length > 0, 'Review text cannot be whitespace only'),
}).strict();
export type ReviewRequest = z.infer<typeof reviewRequestSchema>;
export const reviewResponseSchema = z.object({
  review: z.object({ restaurantId: z.string().min(1), rating: ratingSchema, text: z.string().max(500), updatedAt: z.string().datetime() }),
  accountXP: z.number().int().nonnegative(),
  accountLevel: z.number().int().positive(),
  newBadges: z.array(z.string()),
  newTitles: z.array(z.string()),
});
export type ReviewResponse = z.infer<typeof reviewResponseSchema>;

export const revealAcknowledgementResponseSchema = z.object({ eventId: z.string().min(1), viewedAt: z.string().datetime() });
export type RevealAcknowledgementResponse = z.infer<typeof revealAcknowledgementResponseSchema>;

// Descriptive aliases make endpoint contracts easy to find at call sites.
export const profileResponseSchema = profileSchema;
export const ProfileResponseSchema = profileSchema;
export const revealAcknowledgementRequestSchema = z.object({ eventId: z.string().min(1) });
export const RevealAcknowledgementRequestSchema = revealAcknowledgementRequestSchema;
export const RevealAcknowledgementRequest = revealAcknowledgementRequestSchema;
export type RevealAcknowledgementRequest = z.infer<typeof revealAcknowledgementRequestSchema>;
