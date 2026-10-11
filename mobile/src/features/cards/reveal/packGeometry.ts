import { seededRandom } from '../frameLayout';

// Geometry of the foil pack, ported from packlab-reference.html: its size next to
// the card, the crack lines that spread over three heartbeats, the paper shreds
// of a tear and the shards of a shatter. All deterministic.

export const PACK_WIDTH_RATIO = 1.04;
export const PACK_ASPECT = 3.9 / 2.5;
export const PACK_TOP_SHARE = 0.13;

export function packSize(cardWidth: number): { width: number; height: number } {
  const width = cardWidth * PACK_WIDTH_RATIO;
  return { width, height: width * PACK_ASPECT };
}

// Polylines in the reference's 100 x 156 viewBox, all starting at the pack's centre.
const CRACK_VIEW = { width: 100, height: 156 };
const CRACKS: number[][][] = [
  [[50, 78, 42, 64, 46, 52, 36, 38, 40, 22], [50, 78, 60, 90, 56, 104, 66, 118]],
  [[50, 78, 64, 70, 74, 74, 86, 62, 96, 66], [50, 78, 38, 88, 26, 84, 14, 96, 4, 92], [50, 78, 52, 94, 44, 112, 48, 130, 40, 150]],
  [[50, 78, 58, 58, 70, 48, 68, 30, 80, 14], [50, 78, 34, 72, 22, 60, 10, 64], [50, 78, 66, 96, 80, 104, 90, 124], [50, 78, 46, 60, 30, 50, 26, 30, 12, 20]],
];
export const CRACK_WAVES = CRACKS.length;

export type CrackSegment = { key: string; wave: number; cx: number; cy: number; length: number; angleDeg: number };

/** Each polyline as straight segments, positioned by their midpoint in px. */
export function crackSegments(width: number, height: number): CrackSegment[] {
  const sx = width / CRACK_VIEW.width;
  const sy = height / CRACK_VIEW.height;
  return CRACKS.flatMap((lines, wave) => lines.flatMap((points, line) => {
    const segments: CrackSegment[] = [];
    for (let i = 0; i + 3 < points.length; i += 2) {
      const [x1, y1, x2, y2] = [points[i] * sx, points[i + 1] * sy, points[i + 2] * sx, points[i + 3] * sy];
      segments.push({
        key: `crack-${wave}-${line}-${i / 2}`,
        wave,
        cx: (x1 + x2) / 2,
        cy: (y1 + y2) / 2,
        length: Math.hypot(x2 - x1, y2 - y1),
        angleDeg: (Math.atan2(y2 - y1, x2 - x1) * 180) / Math.PI,
      });
    }
    return segments;
  }));
}

export type Shred = { key: string; x: number; dx: number; dy: number; rotateDeg: number; durationMs: number };

/** Paper bits thrown up from the torn top edge. */
export function shredSpecs(packWidth: number, count = 14, seed = 14): Shred[] {
  const next = seededRandom(seed);
  return Array.from({ length: count }, (_, index) => ({
    key: `shred-${index}`,
    x: packWidth / 2 + (next() - 0.5) * packWidth * 0.8,
    dx: (next() - 0.3) * 180,
    dy: -60 - next() * 140,
    rotateDeg: (next() - 0.5) * 600,
    durationMs: 900 + next() * 500,
  }));
}

export type Shard = { key: string; x: number; y: number; width: number; height: number; row: number; dx: number; dy: number; rotateDeg: number; durationMs: number };

/** The pack cut into a grid of pieces, each flying away from the centre. */
export function shardSpecs(width: number, height: number, columns = 4, rows = 4, seed = 16): Shard[] {
  const next = seededRandom(seed);
  const cell = { width: width / columns, height: height / rows };
  return Array.from({ length: columns * rows }, (_, index) => {
    const column = index % columns;
    const row = Math.floor(index / columns);
    const mx = (column + 0.5) * cell.width - width / 2 + (next() - 0.5) * 8;
    const my = (row + 0.5) * cell.height - height / 2 + (next() - 0.5) * 8;
    const reach = Math.hypot(mx, my) || 1;
    const distance = 260 + next() * 260;
    return {
      key: `shard-${index}`,
      x: column * cell.width,
      y: row * cell.height,
      width: cell.width,
      height: cell.height,
      row,
      dx: (mx / reach) * distance,
      dy: (my / reach) * distance,
      rotateDeg: (next() - 0.5) * 540,
      durationMs: 1100 + next() * 400,
    };
  });
}
