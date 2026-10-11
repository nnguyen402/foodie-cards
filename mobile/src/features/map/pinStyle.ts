import type { RestaurantStage } from '@foodie-cards/shared';

// How a pin is coloured: locked pins are grey and dim, collected pins light up in their stage colour.
export type PinLook = { ring: string; glow: string | null; fill: string; ink: string; opacity: number; locked: boolean; sparkle: boolean };

const LOOKS: Record<RestaurantStage, PinLook> = {
  discovered: { ring: '#c9d1dc', glow: '#c9d1dc', fill: '#1f2630', ink: '#eef2f7', opacity: 1, locked: false, sparkle: false },
  regular: { ring: '#f2b632', glow: '#f2b632', fill: '#2a1d08', ink: '#ffe08a', opacity: 1, locked: false, sparkle: false },
  house_favorite: { ring: '#f5c542', glow: '#a45cff', fill: '#24133f', ink: '#ffe08a', opacity: 1, locked: false, sparkle: true },
};
const LOCKED: PinLook = { ring: '#6f6c69', glow: null, fill: '#3a3836', ink: '#8d8a87', opacity: 0.72, locked: true, sparkle: false };

export function pinLook(stage: RestaurantStage | null): PinLook {
  return stage ? LOOKS[stage] : LOCKED;
}
