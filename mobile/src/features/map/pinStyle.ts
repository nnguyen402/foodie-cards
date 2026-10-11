import type { RestaurantStage } from '@foodie-cards/shared';

// How a pin is lit. The token's colours come from its cuisine; the stage adds the glow and
// the crown. A locked pin keeps its cuisine colours, only dimmed, with a lock badge.
export type PinLook = { glow: string | null; opacity: number; locked: boolean; sparkle: boolean };

const LOOKS: Record<RestaurantStage, PinLook> = {
  discovered: { glow: '#c9d1dc', opacity: 1, locked: false, sparkle: false },
  regular: { glow: '#f2b632', opacity: 1, locked: false, sparkle: false },
  house_favorite: { glow: '#a45cff', opacity: 1, locked: false, sparkle: true },
};
const LOCKED: PinLook = { glow: null, opacity: 0.55, locked: true, sparkle: false };

export function pinLook(stage: RestaurantStage | null): PinLook {
  return stage ? LOOKS[stage] : LOCKED;
}
