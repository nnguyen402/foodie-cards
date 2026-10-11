import { describe, expect, it } from 'vitest';
import { CRACK_WAVES, crackSegments, packSize, shardSpecs, shredSpecs } from '../src/features/cards/reveal/packGeometry';

const unique = (keys: string[]) => new Set(keys).size === keys.length;

describe('pack geometry', () => {
  it('is slightly wider than the card and keeps the pack proportions', () => {
    const pack = packSize(250);
    expect(pack.width).toBeCloseTo(260);
    expect(pack.height / pack.width).toBeCloseTo(3.9 / 2.5);
  });

  it('spreads the cracks over three waves, all inside the pack', () => {
    const segments = crackSegments(260, 405.6);
    expect(CRACK_WAVES).toBe(3);
    expect([...new Set(segments.map((segment) => segment.wave))]).toEqual([0, 1, 2]);
    expect(unique(segments.map((segment) => segment.key))).toBe(true);
    for (const segment of segments) {
      expect(segment.length).toBeGreaterThan(0);
      expect(segment.cx).toBeGreaterThanOrEqual(0);
      expect(segment.cx).toBeLessThanOrEqual(260);
      expect(segment.cy).toBeGreaterThanOrEqual(0);
      expect(segment.cy).toBeLessThanOrEqual(405.6);
    }
  });

  it('scales the cracks with the pack', () => {
    const small = crackSegments(100, 156);
    const large = crackSegments(200, 312);
    expect(large[0].length).toBeCloseTo(small[0].length * 2);
    expect(large[0].angleDeg).toBeCloseTo(small[0].angleDeg);
  });

  it('throws fourteen shreds upwards with unique keys', () => {
    const shreds = shredSpecs(260);
    expect(shreds).toHaveLength(14);
    expect(unique(shreds.map((shred) => shred.key))).toBe(true);
    expect(shreds.every((shred) => shred.dy < 0)).toBe(true);
    expect(shreds).toEqual(shredSpecs(260));
  });

  it('cuts the pack into sixteen shards that tile it and fly outwards', () => {
    const shards = shardSpecs(260, 400);
    expect(shards).toHaveLength(16);
    expect(unique(shards.map((shard) => shard.key))).toBe(true);
    expect(shards.reduce((area, shard) => area + shard.width * shard.height, 0)).toBeCloseTo(260 * 400);
    for (const shard of shards) {
      const fromCentreX = shard.x + shard.width / 2 - 130;
      expect(Math.sign(shard.dx)).toBe(Math.sign(fromCentreX));
      expect(Math.hypot(shard.dx, shard.dy)).toBeGreaterThanOrEqual(260);
    }
  });
});
