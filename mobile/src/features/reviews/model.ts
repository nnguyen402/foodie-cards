import {
  ratingSchema,
  reviewRequestSchema,
  type ReviewRequest,
} from '@foodie-cards/shared';

export type ReviewDraft = ReviewRequest;

export const ratingValues = [
  0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5,
] as const;

export function createReviewDraft(
  rating: ReviewRequest['rating'] = null,
  text = '',
): ReviewDraft {
  return reviewRequestSchema.parse({ rating, text });
}

export function updateDraftRating(
  draft: ReviewDraft,
  rating: ReviewRequest['rating'],
): ReviewDraft {
  return { ...draft, rating: ratingSchema.parse(rating) };
}

export function clearDraftRating(draft: ReviewDraft): ReviewDraft {
  return updateDraftRating(draft, null);
}

export function reviewPayload(draft: ReviewDraft): ReviewRequest {
  return reviewRequestSchema.parse(draft);
}

export function reviewValidationMessage(draft: ReviewDraft): string | null {
  const parsed = reviewRequestSchema.safeParse(draft);
  if (parsed.success) return null;
  if (draft.text.length > 500) return 'Keep your review to 500 characters or fewer.';
  if (draft.text.length > 0 && draft.text.trim().length === 0) {
    return 'Write a review or leave the review field empty.';
  }
  return 'Choose a rating from 0 to 5 in half-star steps.';
}
