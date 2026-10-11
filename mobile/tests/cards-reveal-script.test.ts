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
    // Tear 420 + rise 600 + come forward 560; rare adds a 350 tease and a 300 hold.
    expect(common.buildUpMs).toBe(1580);
    expect(rare.buildUpMs).toBe(2230);
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

  it('gives every event a unique key prefixed by its kind', () => {
    for (const script of [common, rare, ultra]) {
      const keys = script.events.map((event) => event.key);
      expect(new Set(keys).size).toBe(keys.length);
      for (const event of script.events) expect(event.key.startsWith(`${event.kind}-`)).toBe(true);
    }
  });

  it('tears the pack open for common and rare, then lets the card rise and come forward', () => {
    for (const script of [common, rare]) {
      const kinds = script.events.map((event) => event.kind);
      expect(kinds.indexOf('tear')).toBeGreaterThanOrEqual(0);
      expect(kinds.indexOf('tear')).toBeLessThan(kinds.indexOf('rise'));
      expect(kinds.indexOf('rise')).toBeLessThan(kinds.indexOf('present'));
      expect(kinds.indexOf('present')).toBeLessThan(kinds.indexOf('spin'));
      expect(kinds).not.toContain('shatter');
      expect(script.spin.startDeg).toBe(0);
    }
  });

  it('cracks the ultra rare pack once per heartbeat, then shatters it and drops the card in', () => {
    const cracks = ultra.events.filter((event) => event.kind === 'crack');
    const pulses = ultra.events.filter((event) => event.kind === 'pulse');
    expect(cracks.map((event) => (event.kind === 'crack' ? event.wave : -1))).toEqual([0, 1, 2]);
    expect(cracks.map((event) => event.atMs)).toEqual(pulses.map((event) => event.atMs));
    const kinds = ultra.events.map((event) => event.kind);
    expect(kinds).not.toContain('tear');
    const shatter = ultra.events.find((event) => event.kind === 'shatter');
    const drop = ultra.events.find((event) => event.kind === 'drop');
    expect(shatter?.atMs).toBe(drop?.atMs);
    expect(drop && drop.kind === 'drop' ? drop.durationMs : 0).toBe(1700);
    expect(ultra.buildUpMs).toBe((drop?.atMs ?? 0) + 1700 + 400);
    expect(ultra.spin.startDeg).toBe(720);
    expect(ultra.spin.endDeg).toBe(1260);
  });

  it('shakes the camera on the hit for every stage, harder each time', () => {
    const hits = [common, rare, ultra].map((script) => script.reveal.shake?.amplitude ?? 0);
    expect(hits[0]).toBeGreaterThan(0);
    expect(hits[0]).toBeLessThan(hits[1]);
    expect(hits[1]).toBeLessThan(hits[2]);
    expect(common.reveal.rings.length).toBeLessThan(rare.reveal.rings.length);
    expect(rare.reveal.rings.length).toBeLessThan(ultra.reveal.rings.length);
  });
});
