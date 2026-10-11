// A rating is a number from 0.0 to 5.0 with one decimal (4.3). Typed text, slider positions and
// saved values all go through here, so they agree on what is allowed.

export const MIN_RATING = 0;
export const MAX_RATING = 5;

/** Into range, rounded to one decimal. */
export function clampRating(value: number): number {
  if (!Number.isFinite(value)) return MIN_RATING;
  return Math.round(Math.min(MAX_RATING, Math.max(MIN_RATING, value)) * 10) / 10;
}

/** What may stay in the field: digits and one dot, one digit before the dot and one after. */
export function sanitizeRatingText(text: string): string {
  const cleaned = text.replace(/[^0-9.]/g, '');
  const dot = cleaned.indexOf('.');
  if (dot === -1) return cleaned.slice(0, 1);
  const whole = cleaned.slice(0, dot).slice(0, 1);
  const fraction = cleaned.slice(dot + 1).replace(/\./g, '').slice(0, 1);
  return `${whole}.${fraction}`;
}

/** Empty is unrated (null); a lone "." is not a number yet (undefined); otherwise the clamped number. */
export function ratingFromText(text: string): number | null | undefined {
  const trimmed = text.trim();
  if (trimmed === '') return null;
  const parsed = Number(trimmed);
  if (!/\d/.test(trimmed) || Number.isNaN(parsed)) return undefined;
  return clampRating(parsed);
}

export function formatRating(value: number | null): string {
  return value === null ? '' : value.toFixed(1);
}

/** The value under a finger on a track `width` wide. */
export function ratingFromPosition(x: number, width: number): number {
  if (width <= 0) return MIN_RATING;
  return clampRating((x / width) * MAX_RATING);
}

export function positionFromRating(value: number | null): number {
  return value === null ? 0 : clampRating(value) / MAX_RATING;
}
