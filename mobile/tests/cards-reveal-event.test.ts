import { describe, expect, it } from 'vitest';
import { DEMO_EVENT_PREFIX, demoRevealStage, firstUnhandled, isDemoEventId, isEventId, markRevealHandled, parseRevealPayload } from '../src/features/cards/reveal/revealEvent';

describe('parseRevealPayload', () => {
  it('accepts cardId and stage with an optional previous stage', () => {
    expect(parseRevealPayload({ cardId: 'c1', stage: 'regular', previousStage: 'discovered' })).toEqual({ cardId: 'c1', stage: 'regular', previousStage: 'discovered' });
    expect(parseRevealPayload({ cardId: 'c1', stage: 'discovered' })).toEqual({ cardId: 'c1', stage: 'discovered', previousStage: null });
    expect(parseRevealPayload({ cardId: 'c1', stage: 'discovered', previousStage: null })?.previousStage).toBeNull();
  });

  it('rejects non-objects, missing card ids and unknown stages', () => {
    for (const bad of [null, undefined, 'x', 4, [], {}, { stage: 'regular' }, { cardId: '', stage: 'regular' }, { cardId: 3, stage: 'regular' }, { cardId: 'c1', stage: 'legendary' }, { cardId: 'c1' }]) {
      expect(parseRevealPayload(bad)).toBeNull();
    }
  });

  it('treats an unknown previous stage as invalid rather than guessing', () => {
    expect(parseRevealPayload({ cardId: 'c1', stage: 'regular', previousStage: 'legendary' })).toBeNull();
  });
});

describe('demo reveal ids', () => {
  it('recognises the demo prefix', () => {
    expect(DEMO_EVENT_PREFIX).toBe('demo-');
    expect(isDemoEventId('demo-regular')).toBe(true);
    expect(isDemoEventId('0b9a10b0-0000-4000-8000-000000000000')).toBe(false);
  });

  it('maps demo ids to stages and rejects anything else', () => {
    expect(demoRevealStage('demo-discovered')).toBe('discovered');
    expect(demoRevealStage('demo-regular')).toBe('regular');
    expect(demoRevealStage('demo-house_favorite')).toBe('house_favorite');
    expect(demoRevealStage('demo-legendary')).toBeNull();
    expect(demoRevealStage('regular')).toBeNull();
  });
});

describe('reveals handled this session', () => {
  it('skips a finished reveal and offers the next one', () => {
    expect(firstUnhandled(['a', 'b'])).toBe('a');
    markRevealHandled('a');
    expect(firstUnhandled(['a', 'b'])).toBe('b');
    markRevealHandled('b');
    expect(firstUnhandled(['a', 'b'])).toBeNull();
  });

  it('offers nothing when there are no pending reveals', () => {
    expect(firstUnhandled([])).toBeNull();
  });
});

describe('isEventId', () => {
  it('accepts a uuid and rejects anything else', () => {
    expect(isEventId('3f2b8c1e-9a4d-4e6f-8b2a-1c3d5e7f9a0b')).toBe(true);
    expect(isEventId('abc')).toBe(false);
    expect(isEventId('')).toBe(false);
  });
});
