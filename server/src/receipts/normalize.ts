export type ReceiptLineCandidate = {
  originalText: string;
  suggestedName: string;
  quantity?: number | null;
  kind: 'food' | 'non_food';
  confidence: 'certain' | 'uncertain';
};

export type ReceiptCatalog = {
  restaurants: Array<{
    id: string;
    name: string;
    aliases: string[];
  }>;
  menuItems: Array<{
    id: string;
    restaurantId: string;
    canonicalName: string;
    aliases: string[];
  }>;
};

export type NormalizedReceiptItem = {
  menuItemId: string;
  canonicalName: string;
  originalText: string;
  quantity: number;
};

export type UnresolvedReceiptItem = {
  originalText: string;
  suggestedName: string;
  quantity: number;
  reason: 'unknown_restaurant' | 'uncertain_match' | 'unknown_menu_item';
};

export type NormalizedReceiptItems = {
  restaurantId: string | null;
  items: NormalizedReceiptItem[];
  unresolvedItems: UnresolvedReceiptItem[];
};

function normalizeLabel(value: string): string {
  return value.normalize('NFKD')
    .replace(/\p{Diacritic}/gu, '')
    .toLocaleLowerCase()
    .replace(/[^\p{Letter}\p{Number}]+/gu, ' ')
    .trim();
}

export function normalizeItems(
  restaurantId: string | null,
  items: ReceiptLineCandidate[],
  catalog: ReceiptCatalog,
): NormalizedReceiptItems {
  const restaurant = catalog.restaurants.find((candidate) => candidate.id === restaurantId);
  const result: NormalizedReceiptItems = {
    restaurantId: restaurant?.id ?? null,
    items: [],
    unresolvedItems: [],
  };
  const mergedItems = new Map<string, NormalizedReceiptItem>();

  for (const item of items) {
    if (item.kind !== 'food') continue;

    const quantity = item.quantity ?? 1;
    if (!restaurant) {
      result.unresolvedItems.push({ ...item, quantity, reason: 'unknown_restaurant' });
      continue;
    }
    if (item.confidence !== 'certain') {
      result.unresolvedItems.push({ ...item, quantity, reason: 'uncertain_match' });
      continue;
    }

    const label = normalizeLabel(item.suggestedName);
    const menuItem = catalog.menuItems.find((candidate) =>
      candidate.restaurantId === restaurant.id
      && [candidate.canonicalName, ...candidate.aliases].some((name) => normalizeLabel(name) === label),
    );
    if (!menuItem) {
      result.unresolvedItems.push({ ...item, quantity, reason: 'unknown_menu_item' });
      continue;
    }

    const existing = mergedItems.get(menuItem.id);
    if (existing) {
      existing.quantity += quantity;
    } else {
      mergedItems.set(menuItem.id, {
        menuItemId: menuItem.id,
        canonicalName: menuItem.canonicalName,
        originalText: item.originalText,
        quantity,
      });
    }
  }

  result.items = [...mergedItems.values()];
  return result;
}
