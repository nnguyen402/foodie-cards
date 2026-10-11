import { restaurantStageSchema, type RestaurantStage } from '@foodie-cards/shared';

export type RevealPayload = { cardId: string; stage: RestaurantStage; previousStage: RestaurantStage | null };

// The server has not fixed the card_stage payload yet, so accept only what is clearly valid.
export function parseRevealPayload(payload: unknown): RevealPayload | null {
  if (typeof payload !== 'object' || payload === null || Array.isArray(payload)) return null;
  const { cardId, stage, previousStage } = payload as Record<string, unknown>;
  if (typeof cardId !== 'string' || cardId === '') return null;
  const parsedStage = restaurantStageSchema.safeParse(stage);
  if (!parsedStage.success) return null;
  if (previousStage === undefined || previousStage === null) return { cardId, stage: parsedStage.data, previousStage: null };
  const parsedPrevious = restaurantStageSchema.safeParse(previousStage);
  if (!parsedPrevious.success) return null;
  return { cardId, stage: parsedStage.data, previousStage: parsedPrevious.data };
}

// Reveals finished or found unusable in this app session. Kept in memory only, so the collection
// stops offering them even while the server cannot record viewed_at yet.
const handledEventIds = new Set<string>();

export function markRevealHandled(id: string): void {
  if (id !== '') handledEventIds.add(id);
}

export function firstUnhandled(ids: string[]): string | null {
  return ids.find((id) => !handledEventIds.has(id)) ?? null;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isEventId(id: string): boolean {
  return UUID.test(id);
}

export const DEMO_EVENT_PREFIX = 'demo-';

export function isDemoEventId(id: string): boolean {
  return id.startsWith(DEMO_EVENT_PREFIX);
}

export function demoRevealStage(id: string): RestaurantStage | null {
  if (!isDemoEventId(id)) return null;
  const parsed = restaurantStageSchema.safeParse(id.slice(DEMO_EVENT_PREFIX.length));
  return parsed.success ? parsed.data : null;
}
