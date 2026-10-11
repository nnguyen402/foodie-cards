import { seededRandom } from '../frameLayout';

// Deterministic particle specs for the reveal. The reference throws particles
// from a canvas with Math.random; here every spec is computed up front from a
// seed so renders are repeatable and each particle can run as a UI-thread keyframe.

export type ParticleShape = 'dot' | 'spark' | 'ember' | 'leaf';

export type Particle = {
  /** Unique within its burst or stream, prefixed by shape. */
  key: string;
  /** Where the particle ends up, in px from where it starts. */
  dx: number;
  dy: number;
  size: number;
  color: string;
  delayMs: number;
  durationMs: number;
  shape: ParticleShape;
  /** Resting rotation. Sparks point along their travel; leaves also tumble by spinDeg. */
  rotateDeg: number;
};

export type StreamParticle = Particle & {
  /** Start position inside the stream area. */
  x: number;
  y: number;
  wobble: number;
  spinDeg: number;
  /** How many times the particle repeats so the stream ends on its own. */
  iterations: number;
};

export type StreamKind = 'ember' | 'leaf';

// Pixels travelled per unit of the reference's launch speed.
const BURST_REACH = 20;
const BURST_FALL = 0.3;

export function maxBurstDistance(speed: number): number {
  return speed * 1.3 * BURST_REACH * (1 + BURST_FALL);
}

export function burstParticles(count: number, colors: readonly string[], speed: number, seed: number): Particle[] {
  const next = seededRandom(seed);
  return Array.from({ length: count }, (_, index) => {
    const angle = next() * Math.PI * 2;
    const distance = speed * (0.3 + next()) * BURST_REACH;
    const spark = next() < 0.35;
    return {
      key: `${spark ? 'spark' : 'dot'}-${index}`,
      dx: Math.cos(angle) * distance,
      // Gravity pulls the whole burst down a little by the time it fades.
      dy: Math.sin(angle) * distance + distance * BURST_FALL,
      size: (2 + next() * 3.5) * 2,
      color: colors[index % colors.length],
      delayMs: 0,
      durationMs: 900 + next() * 700,
      shape: spark ? 'spark' : 'dot',
      rotateDeg: (angle * 180) / Math.PI,
    };
  });
}

type StreamArea = { width: number; height: number };

export function streamParticles(kind: StreamKind, count: number, colors: readonly string[], seed: number, area: StreamArea, streamMs: number): StreamParticle[] {
  const next = seededRandom(seed);
  return Array.from({ length: count }, (_, index) => {
    const ember = kind === 'ember';
    const durationMs = ember ? 2000 + next() * 1000 : 3200 + next() * 1200;
    // Spread the pool over one cycle so the stream looks continuous from the start.
    const delayMs = next() * durationMs;
    const travel = ember ? 220 + next() * 380 : 420 + next() * 380;
    return {
      key: `${kind}-${index}`,
      x: ember ? area.width * (0.25 + next() * 0.5) : next() * area.width,
      y: ember ? area.height + 10 : -10,
      dx: (next() - 0.5) * (ember ? 60 : 90),
      dy: (ember ? -1 : 1) * Math.min(travel, area.height),
      size: ember ? (1.5 + next() * 2.5) * 2 : 4 + next() * 4,
      color: colors[index % colors.length],
      delayMs,
      durationMs,
      shape: kind,
      rotateDeg: next() * 360,
      wobble: ember ? 8 + next() * 10 : 14 + next() * 18,
      spinDeg: ember ? 0 : (next() < 0.5 ? -1 : 1) * (360 + next() * 540),
      iterations: Math.max(1, Math.ceil((streamMs - delayMs) / durationMs)),
    };
  });
}

const SHAKE_STEP_MS = 45;
const RATTLE_STEP_MS = 70;

// Camera shake as a list of positions held for stepMs each: random jolts that decay to rest.
export function shakeOffsets(amplitude: number, durationMs: number, seed = 1): { stepMs: number; points: { x: number; y: number }[] } {
  const next = seededRandom(seed);
  const steps = Math.max(1, Math.round(durationMs / SHAKE_STEP_MS));
  const points = Array.from({ length: steps }, (_, index) => {
    const reach = amplitude * (1 - index / steps);
    return { x: (next() - 0.5) * 2 * reach, y: (next() - 0.5) * 2 * reach };
  });
  return { stepMs: SHAKE_STEP_MS, points: [...points, { x: 0, y: 0 }] };
}

// The charged card trembling: alternating sides, growing until it lets go.
export function rattleOffsets(amplitude: number, durationMs: number): { stepMs: number; offsets: number[] } {
  const steps = Math.max(1, Math.round(durationMs / RATTLE_STEP_MS));
  const offsets = Array.from({ length: steps + 1 }, (_, index) => (index % 2 ? 1 : -1) * amplitude * (index / steps));
  return { stepMs: RATTLE_STEP_MS, offsets: [...offsets, 0] };
}
