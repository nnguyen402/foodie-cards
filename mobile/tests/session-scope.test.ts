import { describe, expect, it } from 'vitest';
import { createSessionScope } from '../src/lib/session-scope';

describe('session-scoped requests', () => {
  it('rejects a profile response that finishes after the account changes', () => {
    const scope = createSessionScope();
    const requestForA = scope.transitionTo('user-a');

    const requestForB = scope.transitionTo('user-b');

    expect(scope.isCurrent(requestForA)).toBe(false);
    expect(scope.isCurrent(requestForB)).toBe(true);
  });

  it('rejects a response from an earlier login even when the same user logs in again', () => {
    const scope = createSessionScope();
    const firstLogin = scope.transitionTo('user-a');
    scope.transitionTo(null);
    const secondLogin = scope.transitionTo('user-a');

    expect(scope.isCurrent(firstLogin)).toBe(false);
    expect(scope.isCurrent(secondLogin)).toBe(true);
  });
});
