import { describe, expect, it } from 'vitest';
import { FRAME, frameRects, seededRandom } from '../src/features/cards/frameLayout';

describe('card frame layout', () => {
  it('uses the 750 by 1050 canvas the frames were drawn on', () => {
    expect(FRAME).toEqual({ width: 750, height: 1050 });
  });

  it('returns the drawn window positions at full size', () => {
    const rects = frameRects(750);
    expect(rects.height).toBe(1050);
    expect(rects.radius).toBe(40);
    expect(rects.name).toEqual({ x: 40, y: 40, w: 670, h: 118, r: 22 });
    expect(rects.art).toEqual({ x: 40, y: 172, w: 670, h: 560, r: 22 });
    expect(rects.stats).toEqual({ x: 40, y: 746, w: 670, h: 236, r: 22 });
    expect(rects.badge).toEqual({ x: 688, y: 1010, r: 26 });
  });

  it('scales every window with the card width', () => {
    const rects = frameRects(375);
    expect(rects.scale).toBe(0.5);
    expect(rects.height).toBe(525);
    expect(rects.radius).toBe(20);
    expect(rects.art).toEqual({ x: 20, y: 86, w: 335, h: 280, r: 11 });
    expect(rects.badge).toEqual({ x: 344, y: 505, r: 13 });
  });
});

describe('frame decoration randomness', () => {
  it('matches the generator the frames were drawn with', () => {
    const next = seededRandom(7);
    expect(next()).toBeCloseTo(117649 / 2147483647, 12);
    expect(next()).toBeCloseTo(1977326743 / 2147483647, 12);
  });

  it('places decorations identically on every render', () => {
    const a = seededRandom(23);
    const b = seededRandom(23);
    expect([a(), a(), a()]).toEqual([b(), b(), b()]);
  });
});
