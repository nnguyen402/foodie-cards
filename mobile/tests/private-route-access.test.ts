import { describe, expect, it } from 'vitest';
import { privateRouteAction } from '../src/features/auth/privateRouteAccess';

describe('privateRouteAction', () => {
  it('waits for session and profile hydration before deciding whether to redirect', () => {
    expect(privateRouteAction('loading')).toBe('wait');
  });

  it('sends a hydrated signed-out session to sign-in', () => {
    expect(privateRouteAction('signed-out')).toBe('sign-in');
  });

  it('keeps a signed-in user on the requested private route', () => {
    expect(privateRouteAction('signed-in')).toBe('render');
  });

  it('allows demo reveals only when the caller marks them and the build is development', () => {
    expect(privateRouteAction('signed-out', { allowDevelopmentDemo: true, isDevelopment: true })).toBe('render');
    expect(privateRouteAction('signed-out', { allowDevelopmentDemo: true, isDevelopment: false })).toBe('sign-in');
    expect(privateRouteAction('signed-out', { allowDevelopmentDemo: false, isDevelopment: true })).toBe('sign-in');
  });

  it('returns to the index route for auth configuration or profile failures', () => {
    expect(privateRouteAction('misconfigured')).toBe('index');
    expect(privateRouteAction('profile-error')).toBe('index');
  });
});
