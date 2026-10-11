import layout from '../../assets/cards/layout.json';

// Canvas the team's frame generator draws on; layout.json positions are in these units.
export const FRAME = { width: 750, height: 1050 } as const;

export type WindowRect = { x: number; y: number; w: number; h: number; r: number };
export type FrameRects = {
  scale: number;
  width: number;
  height: number;
  radius: number;
  name: WindowRect;
  art: WindowRect;
  stats: WindowRect;
  badge: { x: number; y: number; r: number };
};

export function frameRects(width: number): FrameRects {
  const scale = width / FRAME.width;
  const rect = (box: WindowRect): WindowRect => ({ x: box.x * scale, y: box.y * scale, w: box.w * scale, h: box.h * scale, r: box.r * scale });
  return {
    scale,
    width,
    height: FRAME.height * scale,
    radius: layout.radius * scale,
    name: rect(layout.name),
    art: rect(layout.art),
    stats: rect(layout.stats),
    badge: { x: layout.badge.x * scale, y: layout.badge.y * scale, r: layout.badge.r * scale },
  };
}

// Same generator as the frame drawings, so seeded decorations land where the originals do.
export function seededRandom(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state * 16807) % 2147483647;
    return state / 2147483647;
  };
}
