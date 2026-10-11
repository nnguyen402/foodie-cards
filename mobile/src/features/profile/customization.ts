import {
  equipTitleRequestSchema,
  profilePinsRequestSchema,
  type EquipTitleRequest,
  type ProfilePinsRequest,
} from '@foodie-cards/shared';

export type ProfilePin = ProfilePinsRequest['pins'][number];

export function titleRequest(
  titleKey: string | null,
  unlockedTitleKeys: readonly string[],
): EquipTitleRequest {
  const request = equipTitleRequestSchema.parse({ titleKey });
  if (request.titleKey !== null && !unlockedTitleKeys.includes(request.titleKey)) {
    throw new Error('Only an unlocked title can be equipped.');
  }
  return request;
}

export function pinRequest(
  pins: unknown,
  ownedCardIds: readonly string[],
): ProfilePinsRequest {
  const request = profilePinsRequestSchema.parse({ pins });
  const owned = new Set(ownedCardIds);
  if (request.pins.some((pin) => !owned.has(pin.cardId))) {
    throw new Error('Only owned restaurant cards can be pinned.');
  }
  return { pins: [...request.pins].sort((a, b) => a.slot - b.slot) };
}

export function assignPin(
  pins: readonly ProfilePin[],
  slot: ProfilePin['slot'],
  cardId: string,
  ownedCardIds: readonly string[],
): ProfilePin[] {
  if (pins.some((pin) => pin.cardId === cardId && pin.slot !== slot)) {
    throw new Error('A restaurant card can only be pinned once.');
  }
  return pinRequest(
    [...pins.filter((pin) => pin.slot !== slot), { slot, cardId }],
    ownedCardIds,
  ).pins;
}

export function removePin(
  pins: readonly ProfilePin[],
  slot: ProfilePin['slot'],
  ownedCardIds: readonly string[],
): ProfilePin[] {
  return pinRequest(pins.filter((pin) => pin.slot !== slot), ownedCardIds).pins;
}

export function movePin(
  pins: readonly ProfilePin[],
  fromSlot: ProfilePin['slot'],
  toSlot: ProfilePin['slot'],
  ownedCardIds: readonly string[],
): ProfilePin[] {
  if (fromSlot === toSlot) return pinRequest(pins, ownedCardIds).pins;
  const source = pins.find((pin) => pin.slot === fromSlot);
  if (!source) return pinRequest(pins, ownedCardIds).pins;
  const target = pins.find((pin) => pin.slot === toSlot);
  const unmoved = pins.filter((pin) => pin.slot !== fromSlot && pin.slot !== toSlot);
  return pinRequest([
    ...unmoved,
    { cardId: source.cardId, slot: toSlot },
    ...(target ? [{ cardId: target.cardId, slot: fromSlot }] : []),
  ], ownedCardIds).pins;
}
