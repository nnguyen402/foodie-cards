import { describe, expect, it } from 'vitest';
import { REDUCED_FADE_MS, revealScript } from '../src/features/cards/reveal/script';

const stages = ['discovered', 'regular', 'house_favorite'] as const;
const [common, rare, ultra] = stages.map((stage) => revealScript(stage));

describe('reveal script', () => {
  it('spins for flip + 1000 + i * 180 ms on every stage', () => {
    expect([common, rare, ultra].map((script) => script.spin.durationMs)).toEqual([1600, 2360, 2620]);
    expect(common.spin.turnDeg).toBe(540);
  });

  it('fires the reveal effects at 26% of the spin', () => {
    expect([common, rare, ultra].map((script) => script.revealOffsetMs)).toEqual([416, 614, 681]);
    for (const script of [common, rare, ultra]) {
      const spin = script.events.find((event) => event.kind === 'spin');
      const firstFlashOrBurst = script.events.find((event) => event.kind === 'burst' && event.atMs >= script.buildUpMs);
      expect(spin?.atMs).toBe(script.buildUpMs);
      expect(firstFlashOrBurst?.atMs).toBe(script.buildUpMs + script.revealOffsetMs);
    }
  });

  it('has no build-up for common and a longer one for each higher stage', () => {
    expect(common.buildUpMs).toBe(0);
    expect(rare.buildUpMs).toBe(650);
    expect(ultra.buildUpMs).toBeGreaterThan(rare.buildUpMs);
  });

  it('escalates duration and particle count with the stage', () => {
    expect(common.totalMs).toBeLessThan(rare.totalMs);
    expect(rare.totalMs).toBeLessThan(ultra.totalMs);
    expect(common.reveal.burst.count).toBeLessThan(rare.reveal.burst.count);
    expect(rare.reveal.burst.count).toBeLessThan(ultra.reveal.burst.count);
  });

  it('records the reference counts next to the capped ones', () => {
    expect([common, rare, ultra].map((script) => script.reveal.burst.referenceCount)).toEqual([18, 70, 200]);
    for (const script of [common, rare, ultra]) {
      expect(script.reveal.burst.count).toBeLessThan(script.reveal.burst.referenceCount);
    }
    expect(ultra.buildUp.finale?.burst.referenceCount).toBe(140);
  });

  it('gives only ultra rare a heartbeat of three pulses', () => {
    expect(common.buildUp.heartbeat).toBeNull();
    expect(rare.buildUp.heartbeat).toBeNull();
    const pulses = ultra.buildUp.heartbeat?.pulses ?? [];
    expect(pulses).toHaveLength(3);
    expect(pulses.map((pulse) => pulse.peakScale)).toEqual([1.06, 1.09, 1.12]);
    expect(pulses.map((pulse) => pulse.gapMs)).toEqual([380, 270, 160]);
    expect(ultra.events.filter((event) => event.kind === 'pulse')).toHaveLength(3);
  });

  it('only streams embers for rare and gold leaf for ultra rare', () => {
    expect(common.reveal.stream).toBeNull();
    expect(rare.reveal.stream?.kind).toBe('ember');
    expect(rare.reveal.stream?.durationMs).toBe(3200);
    expect(ultra.reveal.stream?.kind).toBe('leaf');
    expect(ultra.reveal.stream?.durationMs).toBe(5200);
  });

  it('orders events by time and ends after the title', () => {
    for (const script of [common, rare, ultra]) {
      const times = script.events.map((event) => event.atMs);
      expect(times).toEqual([...times].sort((a, b) => a - b));
      const end = script.events.find((event) => event.kind === 'end');
      expect(end?.atMs).toBe(script.totalMs);
      expect(script.totalMs).toBe(script.buildUpMs + script.spin.durationMs + script.spin.settleMs + script.title.durationMs);
    }
  });

  it('times the title per letter', () => {
    expect(common.title).toMatchObject({ letterMs: 220, staggerMs: 20, color: '#f6ede2', letters: 6 });
    expect(rare.title).toMatchObject({ letterMs: 360, staggerMs: 35, color: '#ffcf6b', letters: 4 });
    expect(ultra.title).toMatchObject({ letterMs: 360, staggerMs: 55, color: '#f5c542', letters: 9 });
    expect(ultra.title.nameAtMs).toBe(8 * 55 + 300);
  });

  it('exports the reduced motion fade', () => {
    expect(REDUCED_FADE_MS).toBe(200);
  });
});
