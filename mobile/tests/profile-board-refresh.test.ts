import { describe, expect, it } from 'vitest';
import { boardRequestKey, createBoardRequestGate } from '../src/features/profile/board-requests';

const userA = boardRequestKey('user-a', null);
const userB = boardRequestKey('user-b', null);

describe('profile board refresh requests', () => {
  it('reuses an in-flight request when the tab regains focus', () => {
    const gate = createBoardRequestGate();
    const first = gate.begin(userA, false);
    expect(first).not.toBeNull();
    expect(gate.begin(userA, false)).toBeNull();
  });

  it('loads again on a later focus after the previous request finishes', () => {
    const gate = createBoardRequestGate();
    const first = gate.begin(userA, false)!;
    gate.finish(first);
    const second = gate.begin(userA, false);
    expect(second).not.toBeNull();
    expect(gate.isCurrent(second!)).toBe(true);
  });

  it('lets an explicit refresh supersede an in-flight focus request', () => {
    const gate = createBoardRequestGate();
    const focus = gate.begin(userA, false)!;
    const forced = gate.begin(userA, true)!;
    expect(gate.isCurrent(focus)).toBe(false);
    expect(gate.isCurrent(forced)).toBe(true);
  });

  it('rejects a slower response from the previous account after switching users', () => {
    const gate = createBoardRequestGate();
    const oldUser = gate.begin(userA, false)!;
    const newUser = gate.begin(userB, false)!;
    expect(gate.isCurrent(oldUser)).toBe(false);
    expect(gate.isCurrent(newUser)).toBe(true);
    gate.finish(oldUser);
    expect(gate.begin(userB, false)).toBeNull();
  });

  it('invalidates in-flight results after sign-out', () => {
    const gate = createBoardRequestGate();
    const request = gate.begin(userA, false)!;
    gate.cancel();
    expect(gate.isCurrent(request)).toBe(false);
    expect(gate.begin(userA, false)).not.toBeNull();
  });

  it('treats an equipped-title change as a new request', () => {
    const gate = createBoardRequestGate();
    gate.begin(boardRequestKey('user-a', null), false);
    expect(gate.begin(boardRequestKey('user-a', 'loyal_regular'), false)).not.toBeNull();
  });
});
