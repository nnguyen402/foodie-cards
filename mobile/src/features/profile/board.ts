import { restaurantStageSchema, type RestaurantStage } from '@foodie-cards/shared';

export type CatalogEntry = { key: string; name: string; description: string };

export type OwnedCardRow = {
  id: string;
  stage: string;
  restaurantName: string | null;
  locationLabel: string | null;
};

export type ProfilePinSlot = {
  slot: 1 | 2 | 3;
  cardId: string | null;
  restaurantName: string | null;
  locationLabel: string | null;
  stageLabel: string | null;
  unavailable: boolean;
};

export type ProfileAward = { key: string; name: string; description: string };

export type ProfileBoard = {
  pins: ProfilePinSlot[];
  ownedCards: OwnedCardRow[];
  badges: ProfileAward[];
  titles: ProfileAward[];
  equippedTitleName: string | null;
};

const stageLabels: Record<RestaurantStage, string> = {
  discovered: 'Discovered',
  regular: 'Regular',
  house_favorite: 'House Favorite',
};

export function stageLabel(stage: string): string | null {
  const parsed = restaurantStageSchema.safeParse(stage);
  return parsed.success ? stageLabels[parsed.data] : null;
}

function catalogName(key: string, catalog: readonly CatalogEntry[]): ProfileAward {
  const match = catalog.find((entry) => entry.key === key);
  return { key, name: match?.name ?? key, description: match?.description ?? '' };
}

export function buildProfileBoard(input: {
  pins: readonly { slot: number; cardId: string }[];
  cards: readonly OwnedCardRow[];
  badgeKeys: readonly string[];
  titleKeys: readonly string[];
  badges: readonly CatalogEntry[];
  titles: readonly CatalogEntry[];
  equippedTitleKey: string | null;
}): ProfileBoard {
  const cards = new Map(input.cards.map((card) => [card.id, card]));
  const pins: ProfilePinSlot[] = [1, 2, 3].map((slot) => {
    const pin = input.pins.find((candidate) => candidate.slot === slot);
    if (!pin) {
      return { slot: slot as 1 | 2 | 3, cardId: null, restaurantName: null, locationLabel: null, stageLabel: null, unavailable: false };
    }
    const card = cards.get(pin.cardId);
    if (!card) {
      return { slot: slot as 1 | 2 | 3, cardId: pin.cardId, restaurantName: null, locationLabel: null, stageLabel: null, unavailable: true };
    }
    return {
      slot: slot as 1 | 2 | 3,
      cardId: card.id,
      restaurantName: card.restaurantName,
      locationLabel: card.locationLabel,
      stageLabel: stageLabel(card.stage),
      unavailable: false,
    };
  });

  return {
    pins,
    ownedCards: [...input.cards].sort((a, b) =>
      (a.restaurantName ?? '').localeCompare(b.restaurantName ?? ''),
    ),
    badges: input.badgeKeys.map((key) => catalogName(key, input.badges)),
    titles: input.titleKeys.map((key) => catalogName(key, input.titles)),
    equippedTitleName: input.equippedTitleKey ? catalogName(input.equippedTitleKey, input.titles).name : null,
  };
}
