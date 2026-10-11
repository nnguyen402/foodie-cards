import { restaurantStageSchema, type RestaurantStage } from '@foodie-cards/shared';

export type RevealPayload = { cardId: string; stage: RestaurantStage; previousStage: RestaurantStage | null };

const PREVIOUS_STAGE: Record<RestaurantStage, RestaurantStage | null> = {
  discovered: null,
  regular: 'discovered',
  house_favorite: 'regular',
};

function previousStageFromAwards(value: unknown): RestaurantStage | null {
  if (!Array.isArray(value) || value.length === 0) return null;
  const first = value[0];
  if (typeof first !== 'object' || first === null || Array.isArray(first)) return null;
  const stage = restaurantStageSchema.safeParse((first as Record<string, unknown>).stage);
  return stage.success ? PREVIOUS_STAGE[stage.data] : null;
}

// Older card_stage events may omit stageAwards; the current server includes them.
export function parseRevealPayload(payload: unknown): RevealPayload | null {
  if (typeof payload !== 'object' || payload === null || Array.isArray(payload)) return null;
  const { cardId, stage, previousStage, stageAwards } = payload as Record<string, unknown>;
  if (typeof cardId !== 'string' || cardId === '') return null;
  const parsedStage = restaurantStageSchema.safeParse(stage);
  if (!parsedStage.success) return null;
  if (previousStage === undefined) {
    return { cardId, stage: parsedStage.data, previousStage: previousStageFromAwards(stageAwards) };
  }
  if (previousStage === null) return { cardId, stage: parsedStage.data, previousStage: null };
  const parsedPrevious = restaurantStageSchema.safeParse(previousStage);
  if (!parsedPrevious.success) return null;
  return { cardId, stage: parsedStage.data, previousStage: parsedPrevious.data };
}

// Reveals acknowledged by the server or found unusable in this app session.
// Failed acknowledgements stay eligible for recovery.
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
