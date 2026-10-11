import type { RestaurantStage } from '@foodie-cards/shared';
import { stageLabel } from '../stageStyles';

// Every timing, count and colour of the reveal, ported from packlab-reference.html
// (pull, reveal, bannerIn). The reference tier is i = 0 / 2 / 4 for Common / Rare /
// Ultra Rare. Counts marked referenceCount are what the web canvas draws; `count`
// is the cap used on a phone, where hundreds of animated Views would drop frames.

export const REDUCED_FADE_MS = 200;

export type Flash = { opacity: number; durationMs: number; color: string };
export type RingSpec = { color: string; scale: number; durationMs: number; widthPx: number };
export type Shake = { amplitude: number; durationMs: number };
export type BurstSpec = { count: number; referenceCount: number; colors: readonly string[]; speed: number; seed: number; lifeMs: number };
export type StreamSpec = { kind: 'ember' | 'leaf'; durationMs: number; count: number; referenceCount: number; colors: readonly string[]; seed: number; lifeMs: number };
export type Fade = { to: number; durationMs: number };
export type RaysFade = Fade & { periodMs: number };
export type Pulse = { peakScale: number; beatMs: number; gapMs: number; ring: RingSpec; flash: Flash; shake: Shake };
export type TimedRing = RingSpec & { atMs: number };
export type RevealEffects = {
  flashes: Flash[];
  shake: Shake | null;
  rings: TimedRing[];
  burst: BurstSpec;
  shine: { durationMs: number; iterations: number } | null;
  dim: Fade | null;
  rays: RaysFade | null;
  stream: StreamSpec | null;
};
export type Finale = { flash: Flash; shake: Shake; rings: { atMs: number; ring: RingSpec }[]; burst: BurstSpec; rays: RaysFade };

export type RevealEvent = { atMs: number; /** Unique within a script; used as the React key of whatever the event mounts. */ key: string } & (
  | { kind: 'dim'; fade: Fade }
  | { kind: 'rays'; fade: RaysFade }
  | { kind: 'charge' }
  | { kind: 'tear'; durationMs: number }
  | { kind: 'rise'; durationMs: number }
  | { kind: 'present'; durationMs: number; packAwayMs: number }
  | { kind: 'crack'; wave: number }
  | { kind: 'shatter' }
  | { kind: 'drop'; durationMs: number; turnDeg: number }
  | { kind: 'rattle'; shake: Shake }
  | { kind: 'pulse'; pulse: Pulse }
  | { kind: 'shake'; shake: Shake }
  | { kind: 'flash'; flash: Flash }
  | { kind: 'ring'; ring: RingSpec }
  | { kind: 'burst'; burst: BurstSpec }
  | { kind: 'stream'; stream: StreamSpec }
  | { kind: 'shine'; durationMs: number; iterations: number }
  | { kind: 'spin' }
  | { kind: 'landed' }
  | { kind: 'cleanup' }
  | { kind: 'end' }
);

type EventBody = RevealEvent extends infer Event ? (Event extends unknown ? Omit<Event, 'atMs' | 'key'> : never) : never;

export type RevealScript = ReturnType<typeof revealScript>;

type Tier = {
  referenceTier: 0 | 2 | 4;
  flipMs: number;
  /** Ray and ring colour. */
  glow: string;
  title: { letterMs: number; staggerMs: number; color: string; glow: string | null };
  cardGlow: string | null;
  /** Camera jolt as the title lands. */
  titleSlam: Shake | null;
};

const TIERS: Record<RestaurantStage, Tier> = {
  discovered: { referenceTier: 0, flipMs: 600, glow: '#ffffff', title: { letterMs: 220, staggerMs: 20, color: '#f6ede2', glow: null }, cardGlow: null, titleSlam: null },
  regular: { referenceTier: 2, flipMs: 1000, glow: '#ffb347', title: { letterMs: 360, staggerMs: 35, color: '#ffcf6b', glow: '#ffb347' }, cardGlow: '0 0 34px rgba(255,170,60,.55)', titleSlam: { amplitude: 5, durationMs: 240 } },
  house_favorite: {
    referenceTier: 4,
    flipMs: 900,
    glow: '#f5c542',
    title: { letterMs: 360, staggerMs: 55, color: '#f5c542', glow: '#f5c542' },
    cardGlow: '0 0 60px rgba(245,197,66,.75), 0 0 120px rgba(245,197,66,.35)',
    titleSlam: { amplitude: 9, durationMs: 280 },
  },
};

const REVEAL_AT = 0.26;
const SPIN_TURN_DEG = 540;
const SPIN_PEAK_AT = 0.55;
const SPIN_PEAK_SCALE = 1.22;
const SPIN_REST_SCALE = 1.1;
const LIFT_MS = 150;
const SETTLE_MS = 320;
const NAME_AFTER_LAST_LETTER_MS = 300;
const NAME_FADE_MS = 300;
// The pack: drops in, tears open, the card rises out and comes forward. On Ultra Rare it
// shatters instead and the card falls in from above, turning twice face down.
export const PACK_DROP_IN_MS = 520;
const TEAR_MS = 420;
const RISE_MS = 600;
const PRESENT_MS = 560;
const PACK_AWAY_MS = 520;
const DROP_MS = 1700;
const DROP_TURN_DEG = 720;
const AFTER_DROP_MS = 400;
const GOLD = '#f5c542';

const ring = (color: string, scale: number, durationMs: number, widthPx: number): RingSpec => ({ color, scale, durationMs, widthPx });
const flash = (opacity: number, durationMs: number, color: string): Flash => ({ opacity, durationMs, color });
const round2 = (value: number) => Math.round(value * 100) / 100;

function buildUp(stage: RestaurantStage, tier: Tier) {
  if (stage === 'discovered') {
    return { dim: null, rays: null, rattle: null, heartbeat: null, finale: null, waitMs: 0, holdMs: 0 };
  }
  if (stage === 'regular') {
    return { dim: { to: 0.6, durationMs: 700 }, rays: { to: 0.3, durationMs: 900, periodMs: 18000 }, rattle: null, heartbeat: null, finale: null, waitMs: 350, holdMs: 300 };
  }
  const pulses: Pulse[] = [0, 1, 2].map((k) => ({
    peakScale: round2(1.06 + k * 0.03),
    beatMs: 420,
    gapMs: 380 - k * 110,
    ring: ring(tier.glow, 3 + k * 1.5, 700, 2),
    flash: flash(round2(0.12 + k * 0.06), 300, tier.glow),
    shake: { amplitude: 3 + k * 3, durationMs: 260 },
  }));
  return {
    dim: { to: 0.94, durationMs: 700 },
    rays: { to: 0.12, durationMs: 900, periodMs: 18000 },
    rattle: { amplitude: 7, durationMs: 900 },
    heartbeat: { pulses, afterMs: 250 },
    finale: {
      flash: flash(1, 1100, '#ffffff'),
      shake: { amplitude: 18, durationMs: 800 },
      rings: [{ atMs: 0, ring: ring('#fff6d6', 8, 1100, 5) }, { atMs: 120, ring: ring(tier.glow, 10, 1300, 3) }],
      burst: { count: 80, referenceCount: 140, colors: [GOLD, '#ffe08a', '#fff6d6', '#ffffff'], speed: 12, seed: 140, lifeMs: 1600 },
      rays: { to: 0.85, durationMs: 600, periodMs: 7000 },
    },
    waitMs: 350,
    holdMs: AFTER_DROP_MS,
  };
}

function reveal(stage: RestaurantStage, tier: Tier): RevealEffects {
  if (stage === 'discovered') {
    return {
      flashes: [flash(0.25, 350, '#ffffff')], shake: { amplitude: 5, durationMs: 300 },
      rings: [{ atMs: 0, ...ring('#ffffff', 3, 600, 2) }, { atMs: 120, ...ring('#f2b632', 4.5, 800, 2) }], shine: null, dim: null, rays: null, stream: null,
      burst: { count: 16, referenceCount: 18, colors: ['#f2b632', '#d8402b', '#ffffff'], speed: 5, seed: 18, lifeMs: 1600 },
    };
  }
  if (stage === 'regular') {
    return {
      flashes: [flash(0.5, 500, '#ffb347')],
      shake: { amplitude: 12, durationMs: 500 },
      rings: [{ atMs: 0, ...ring(tier.glow, 6, 900, 4) }, { atMs: 150, ...ring('#ff7a2b', 8, 1100, 2) }, { atMs: 300, ...ring('#ffd27a', 10, 1300, 2) }],
      shine: { durationMs: 1200, iterations: 2 },
      dim: { to: 0.4, durationMs: 900 },
      rays: { to: 0.6, durationMs: 400, periodMs: 18000 },
      stream: { kind: 'ember', durationMs: 3200, count: 24, referenceCount: Math.floor(3200 / 70) * 3, colors: ['#ffb347', '#ff7a2b', '#ffd27a'], seed: 31, lifeMs: 3200 + 3000 },
      burst: { count: 48, referenceCount: 70, colors: ['#ffb347', '#ff7a2b', '#ffd27a', '#ffffff'], speed: 9, seed: 70, lifeMs: 1600 },
    };
  }
  return {
    flashes: [flash(0.9, 900, '#fff6d6')],
    shake: { amplitude: 20, durationMs: 800 },
    rings: [0, 1, 2, 3].map((k) => ({ atMs: k * 160, ...ring(k ? tier.glow : '#ffffff', 8 + k * 2, 1200, Math.max(1, 4 - k)) })),
    shine: { durationMs: 1200, iterations: 2 },
    dim: { to: 0.55, durationMs: 1500 },
    rays: null,
    stream: { kind: 'leaf', durationMs: 5200, count: 36, referenceCount: Math.floor(5200 / 60) * 3, colors: [GOLD, '#ffe08a', '#fff6d6'], seed: 52, lifeMs: 5200 + 4400 },
    burst: { count: 96, referenceCount: 200, colors: [GOLD, '#ffe08a', '#fff6d6', '#ffffff', '#d99a1e'], speed: 13, seed: 200, lifeMs: 1600 },
  };
}

export function revealScript(stage: RestaurantStage) {
  const tier = TIERS[stage];
  const up = buildUp(stage, tier);
  const spinMs = tier.flipMs + 1000 + tier.referenceTier * 180;
  const revealOffsetMs = Math.round(spinMs * REVEAL_AT);
  const effects = reveal(stage, tier);

  // Heartbeat and finale lengths follow from the pulses, so they are summed rather than typed in.
  const heartbeatStart = up.waitMs + (up.rattle?.durationMs ?? 0);
  const pulseStarts: number[] = [];
  let cursor = heartbeatStart;
  for (const pulse of up.heartbeat?.pulses ?? []) {
    pulseStarts.push(cursor);
    cursor += pulse.beatMs + pulse.gapMs;
  }
  const finaleAt = cursor + (up.heartbeat?.afterMs ?? 0);
  const tearAt = up.waitMs;
  const buildUpMs = up.finale ? finaleAt + DROP_MS + up.holdMs : tearAt + TEAR_MS + RISE_MS + PRESENT_MS + up.holdMs;
  const spinStartDeg = up.finale ? DROP_TURN_DEG : 0;

  const letters = [...stageLabel(stage)].filter((char) => char !== ' ').length;
  const nameAtMs = (letters - 1) * tier.title.staggerMs + NAME_AFTER_LAST_LETTER_MS;
  const lastLetterEndMs = (letters - 1) * tier.title.staggerMs + tier.title.letterMs;
  const title = { ...tier.title, letters, nameAtMs, nameFadeMs: NAME_FADE_MS, durationMs: Math.max(nameAtMs + NAME_FADE_MS, lastLetterEndMs) };

  const spinEnd = buildUpMs + spinMs;
  const landedAt = spinEnd + SETTLE_MS;
  const totalMs = landedAt + title.durationMs;

  const events: RevealEvent[] = [];
  const add = (atMs: number, event: EventBody) => events.push({ atMs, key: `${event.kind}-${events.length}`, ...event } as RevealEvent);

  if (up.dim) add(0, { kind: 'charge' });
  if (up.dim) add(0, { kind: 'dim', fade: up.dim });
  if (up.rays) add(0, { kind: 'rays', fade: up.rays });
  if (up.rattle) add(up.waitMs, { kind: 'rattle', shake: up.rattle });
  if (!up.finale) {
    add(tearAt, { kind: 'tear', durationMs: TEAR_MS });
    add(tearAt + TEAR_MS, { kind: 'rise', durationMs: RISE_MS });
    add(tearAt + TEAR_MS + RISE_MS, { kind: 'present', durationMs: PRESENT_MS, packAwayMs: PACK_AWAY_MS });
  }
  up.heartbeat?.pulses.forEach((pulse, k) => {
    add(pulseStarts[k], { kind: 'crack', wave: k });
    add(pulseStarts[k], { kind: 'pulse', pulse });
    add(pulseStarts[k], { kind: 'ring', ring: pulse.ring });
    add(pulseStarts[k], { kind: 'flash', flash: pulse.flash });
    add(pulseStarts[k], { kind: 'shake', shake: pulse.shake });
  });
  if (up.finale) {
    add(finaleAt, { kind: 'shatter' });
    add(finaleAt, { kind: 'drop', durationMs: DROP_MS, turnDeg: DROP_TURN_DEG });
    add(finaleAt, { kind: 'flash', flash: up.finale.flash });
    add(finaleAt, { kind: 'shake', shake: up.finale.shake });
    for (const { atMs, ring: spec } of up.finale.rings) add(finaleAt + atMs, { kind: 'ring', ring: spec });
    add(finaleAt, { kind: 'burst', burst: up.finale.burst });
    add(finaleAt, { kind: 'rays', fade: up.finale.rays });
  }

  add(buildUpMs, { kind: 'spin' });
  const at = buildUpMs + revealOffsetMs;
  for (const spec of effects.flashes) add(at, { kind: 'flash', flash: spec });
  if (effects.shake) add(at, { kind: 'shake', shake: effects.shake });
  for (const spec of effects.rings) {
    const { atMs, ...rest } = spec;
    add(at + atMs, { kind: 'ring', ring: rest });
  }
  add(at, { kind: 'burst', burst: effects.burst });
  if (effects.shine) add(at, { kind: 'shine', ...effects.shine });
  if (effects.rays) add(at, { kind: 'rays', fade: effects.rays });
  if (effects.dim) add(at, { kind: 'dim', fade: effects.dim });
  if (effects.stream) add(at, { kind: 'stream', stream: effects.stream });
  add(landedAt, { kind: 'landed' });
  if (tier.titleSlam) add(landedAt, { kind: 'shake', shake: tier.titleSlam });
  add(totalMs, { kind: 'end' });

  const effectsEndMs = Math.max(totalMs, ...events.map((event) => {
    if (event.kind === 'burst') return event.atMs + event.burst.lifeMs;
    if (event.kind === 'stream') return event.atMs + event.stream.lifeMs;
    if (event.kind === 'ring') return event.atMs + event.ring.durationMs;
    if (event.kind === 'flash') return event.atMs + event.flash.durationMs;
    if (event.kind === 'shine') return event.atMs + event.durationMs * event.iterations;
    return 0;
  }));
  add(effectsEndMs, { kind: 'cleanup' });
  events.sort((a, b) => a.atMs - b.atMs);

  return {
    stage,
    referenceTier: tier.referenceTier,
    label: stageLabel(stage),
    glow: tier.glow,
    cardGlow: tier.cardGlow,
    spin: {
      durationMs: spinMs,
      turnDeg: SPIN_TURN_DEG,
      startDeg: spinStartDeg,
      endDeg: spinStartDeg + SPIN_TURN_DEG,
      easing: [0.45, 0, 0.15, 1] as const,
      peakAt: SPIN_PEAK_AT,
      peakScale: SPIN_PEAK_SCALE,
      restScale: SPIN_REST_SCALE,
      liftMs: LIFT_MS,
      settleMs: SETTLE_MS,
    },
    buildUpMs,
    buildUp: { dim: up.dim, rays: up.rays, rattle: up.rattle, heartbeat: up.heartbeat, finale: up.finale, waitMs: up.waitMs },
    revealOffsetMs,
    reveal: effects,
    title,
    events,
    effectsEndMs,
    totalMs,
  };
}
