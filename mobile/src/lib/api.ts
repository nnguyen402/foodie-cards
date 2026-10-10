export type HealthResponse = { ok: true };

export function healthUrl(apiBaseUrl: string): string {
  let url: URL;
  try {
    url = new URL(apiBaseUrl);
  } catch {
    throw new Error('EXPO_PUBLIC_API_URL must be a valid absolute URL');
  }

  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    throw new Error('EXPO_PUBLIC_API_URL must use HTTP or HTTPS');
  }

  const basePath = url.pathname.replace(/\/+$/, '');
  url.pathname = `${basePath}/health`;
  url.search = '';
  url.hash = '';
  return url.toString();
}

export async function checkBackendHealth(
  apiBaseUrl: string,
  fetcher: typeof fetch = fetch,
): Promise<HealthResponse> {
  const response = await fetcher(healthUrl(apiBaseUrl), {
    method: 'GET',
    headers: { Accept: 'application/json' },
  });

  if (!response.ok) throw new Error(`Backend health check failed (${response.status})`);

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    throw new Error('Backend health check returned invalid JSON');
  }

  if (!payload || typeof payload !== 'object' || !('ok' in payload) || payload.ok !== true) {
    throw new Error('Backend health check returned an unexpected response');
  }
  return { ok: true };
}
