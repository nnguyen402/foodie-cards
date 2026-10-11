import { describe, expect, it } from 'vitest';
import { burstParticles, maxBurstDistance, rattleOffsets, shakeOffsets, streamParticles } from '../src/features/cards/reveal/particles';

const COLORS = ['#ffb347', '#ff7a2b', '#ffd27a'];
const AREA = { width: 390, height: 844 };

describe('burst particles', () => {
  it('is deterministic for a seed and varies across seeds', () => {
    expect(burstParticles(30, COLORS, 9, 7)).toEqual(burstParticles(30, COLORS, 9, 7));
    expect(burstParticles(30, COLORS, 9, 7)).not.toEqual(burstParticles(30, COLORS, 9, 8));
  });

  it('returns the requested count with colours cycled', () => {
    const particles = burstParticles(10, COLORS, 9, 3);
    expect(particles).toHaveLength(10);
    expect(particles.map((particle) => particle.color)).toEqual(Array.from({ length: 10 }, (_, index) => COLORS[index % 3]));
    expect(burstParticles(0, COLORS, 9, 3)).toEqual([]);
  });

  it('stays within the reach for its speed', () => {
    for (const particle of burstParticles(200, COLORS, 13, 5)) {
      expect(Math.hypot(particle.dx, particle.dy)).toBeLessThanOrEqual(maxBurstDistance(13));
      expect(particle.size).toBeGreaterThan(0);
      expect(particle.durationMs).toBeGreaterThan(0);
      expect(['dot', 'spark']).toContain(particle.shape);
    }
  });
});

describe('stream particles', () => {
  it('is deterministic and returns the pool size', () => {
    const first = streamParticles('ember', 24, COLORS, 11, AREA, 3200);
    expect(first).toHaveLength(24);
    expect(first).toEqual(streamParticles('ember', 24, COLORS, 11, AREA, 3200));
  });

  it('keeps embers inside the screen and rising from the bottom', () => {
    for (const ember of streamParticles('ember', 24, COLORS, 11, AREA, 3200)) {
      expect(ember.shape).toBe('ember');
      expect(ember.x).toBeGreaterThanOrEqual(0);
      expect(ember.x).toBeLessThanOrEqual(AREA.width);
      expect(ember.y).toBeGreaterThan(AREA.height);
      expect(ember.dy).toBeLessThan(0);
      expect(Math.abs(ember.dy)).toBeLessThanOrEqual(AREA.height + 10);
      expect(ember.delayMs).toBeGreaterThanOrEqual(0);
      expect(ember.delayMs).toBeLessThan(ember.durationMs);
      expect(ember.iterations).toBeGreaterThanOrEqual(1);
    }
  });

  it('drops leaves from above the top edge', () => {
    for (const leaf of streamParticles('leaf', 24, COLORS, 4, AREA, 5200)) {
      expect(leaf.shape).toBe('leaf');
      expect(leaf.y).toBeLessThan(0);
      expect(leaf.dy).toBeGreaterThan(0);
      expect(leaf.dy).toBeLessThanOrEqual(AREA.height + 20);
    }
  });

  it('stops spawning once the stream window is over', () => {
    for (const ember of streamParticles('ember', 24, COLORS, 11, AREA, 3200)) {
      expect(ember.delayMs + (ember.iterations - 1) * ember.durationMs).toBeLessThan(3200);
    }
  });
});

describe('shake offsets', () => {
  it('is deterministic, decays and ends at rest', () => {
    const shake = shakeOffsets(18, 800, 2);
    expect(shake).toEqual(shakeOffsets(18, 800, 2));
    expect(shake.points.at(-1)).toEqual({ x: 0, y: 0 });
    for (const point of shake.points) {
      expect(Math.abs(point.x)).toBeLessThanOrEqual(18);
      expect(Math.abs(point.y)).toBeLessThanOrEqual(18);
    }
    expect(shake.points.length * shake.stepMs).toBeGreaterThanOrEqual(800);
  });

  it('rattles side to side with a growing amplitude', () => {
    const { offsets } = rattleOffsets(7, 900);
    expect(offsets.at(-1)).toBe(0);
    expect(Math.abs(offsets[offsets.length - 2])).toBeGreaterThan(Math.abs(offsets[1]));
    expect(Math.max(...offsets.map(Math.abs))).toBeLessThanOrEqual(7);
  });
});
