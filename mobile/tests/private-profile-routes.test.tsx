import { afterEach, describe, expect, it, vi } from 'vitest';
import { isValidElement, type ReactElement } from 'react';

const authState = vi.hoisted(() => ({ status: 'profile-error' as string }));
const redirectMock = vi.hoisted(() => vi.fn(() => null));

vi.mock('react-native', () => ({
  ActivityIndicator: () => null,
  Pressable: () => null,
  ScrollView: () => null,
  View: () => null,
  StyleSheet: { create: <T,>(styles: T) => styles },
}));
vi.mock('expo-router', () => ({ Redirect: redirectMock, useRouter: () => ({}) }));
vi.mock('@/providers/auth-provider', () => ({ useAuth: () => ({ status: authState.status }) }));
vi.mock('@/components/ui/app-text', () => ({ AppText: () => null }));
vi.mock('@/components/ui/button', () => ({ Button: () => null }));
vi.mock('@/components/ui/form-field', () => ({ FormField: () => null }));
vi.mock('@/components/ui/message-panel', () => ({ MessagePanel: () => null }));
vi.mock('@/lib/supabase', () => ({ supabase: null }));
vi.mock('@/theme/tokens', () => ({ colors: {}, radius: {}, spacing: {} }));

import { EditProfileScreen } from '../src/features/profile/edit-profile-screen';
import { CustomizeProfileScreen } from '../src/features/profile/customize-profile-screen';
import { PrivateRouteGuard } from '../src/features/auth/PrivateRouteGuard';

function resolvePrivatePage(screen: () => ReactElement): ReactElement {
  const page = screen();
  if (page.type !== PrivateRouteGuard) return page;
  return PrivateRouteGuard(page.props as Parameters<typeof PrivateRouteGuard>[0]) as ReactElement;
}

describe('private profile route failures', () => {
  afterEach(() => vi.unstubAllGlobals());

  it.each([
    ['profile editing', EditProfileScreen],
    ['profile customization', CustomizeProfileScreen],
  ])('returns %s to the app error page when profile loading fails', (_name, screen) => {
    authState.status = 'profile-error';
    vi.stubGlobal('__DEV__', false);

    const result = resolvePrivatePage(screen);

    expect(isValidElement(result)).toBe(true);
    expect(result.type).toBe(redirectMock);
    expect(result.props).toMatchObject({ href: '/' });
  });
});
