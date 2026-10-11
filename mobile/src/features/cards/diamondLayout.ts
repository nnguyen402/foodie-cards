// Where the card detail's diamonds sit. Random-looking but always the same: a seeded generator
// scatters one diamond inside each cell of a grid (so they spread out without bunching), and
// sizes run from 1/8 of the full size to the full size in steps of 1/8.

export const DIAMOND_COLUMNS = 5;
export const DIAMOND_ROWS = 8;
export const SIZE_STEPS = 8;
const SEED = 20261011;

export type Diamond = { key: number; left: number; top: number; size: number; durationMs: number; delayMs: number };

// mulberry32: a tiny seeded generator, so every render and every device gets the same layout.
function seeded(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** The full size of a diamond on a screen this wide. */
export const fullDiamondSize = (width: number) => (width / (DIAMOND_COLUMNS - 0.5)) * 0.6;

export function diamondLayout(width: number, height: number): Diamond[] {
  const random = seeded(SEED);
  const full = fullDiamondSize(width);
  const cellWidth = width / DIAMOND_COLUMNS;
  const cellHeight = height / DIAMOND_ROWS;
  return Array.from({ length: DIAMOND_COLUMNS * DIAMOND_ROWS }, (_, index) => {
    const row = Math.floor(index / DIAMOND_COLUMNS);
    const column = index % DIAMOND_COLUMNS;
    const size = (full * (1 + Math.floor(random() * SIZE_STEPS))) / SIZE_STEPS;
    return {
      key: index,
      left: column * cellWidth + random() * cellWidth - size / 2,
      top: row * cellHeight + random() * cellHeight - size / 2,
      size,
      durationMs: 6000 + Math.floor(random() * 5) * 700,
      delayMs: Math.floor(random() * 6000),
    };
  });
}
