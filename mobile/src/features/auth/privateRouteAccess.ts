export type PrivateRouteAuthStatus = 'loading' | 'signed-out' | 'signed-in' | 'profile-error' | 'misconfigured';
export type PrivateRouteAction = 'wait' | 'sign-in' | 'render' | 'index';

export function privateRouteAction(
  status: PrivateRouteAuthStatus,
  options: { allowDevelopmentDemo?: boolean; isDevelopment?: boolean } = {},
): PrivateRouteAction {
  if (options.allowDevelopmentDemo && options.isDevelopment) return 'render';

  switch (status) {
    case 'loading': return 'wait';
    case 'signed-out': return 'sign-in';
    case 'signed-in': return 'render';
    case 'profile-error':
    case 'misconfigured': return 'index';
  }
}
