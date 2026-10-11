import {
  apiErrorSchema,
  equipTitleRequestSchema,
  equipTitleResponseSchema,
  profilePinsRequestSchema,
  profilePinsResponseSchema,
  type EquipTitleRequest,
  type EquipTitleResponse,
  type ProfilePinsRequest,
  type ProfilePinsResponse,
} from '@foodie-cards/shared';

function profileActionUrl(apiBaseUrl: string, path: string): string {
  let url: URL;
  try {
    url = new URL(apiBaseUrl);
  } catch {
    throw new Error('Profile saving is unavailable because the API URL is not configured.');
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    throw new Error('Profile saving requires an HTTP or HTTPS API URL.');
  }
  const basePath = url.pathname.replace(/\/+$/, '');
  url.pathname = `${basePath}${path}`;
  url.search = '';
  url.hash = '';
  return url.toString();
}

async function authenticatedPut(input: {
  apiBaseUrl: string;
  accessToken: string;
  path: string;
  body: unknown;
  fetcher?: typeof fetch;
}): Promise<unknown> {
  if (!input.accessToken.trim()) throw new Error('Sign in again before saving your profile.');

  let response: Response;
  try {
    response = await (input.fetcher ?? fetch)(
      profileActionUrl(input.apiBaseUrl, input.path),
      {
        method: 'PUT',
        headers: {
          Accept: 'application/json',
          Authorization: `Bearer ${input.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(input.body),
      },
    );
  } catch {
    throw new Error('The profile service could not be reached. Check your connection and try again.');
  }

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    throw new Error(
      response.ok
        ? 'The profile service returned an invalid response.'
        : `Your profile could not be saved (${response.status}).`,
    );
  }

  if (!response.ok) {
    const apiError = apiErrorSchema.safeParse(payload);
    throw new Error(
      apiError.success
        ? apiError.data.message
        : `Your profile could not be saved (${response.status}).`,
    );
  }
  return payload;
}

export async function equipProfileTitle(input: {
  apiBaseUrl: string;
  accessToken: string;
  request: EquipTitleRequest;
  fetcher?: typeof fetch;
}): Promise<EquipTitleResponse> {
  const request = equipTitleRequestSchema.parse(input.request);
  const payload = await authenticatedPut({
    ...input,
    path: '/api/me/title',
    body: request,
  });
  const response = equipTitleResponseSchema.safeParse(payload);
  if (!response.success) throw new Error('The profile service returned an invalid title response.');
  return response.data;
}

export async function saveProfilePins(input: {
  apiBaseUrl: string;
  accessToken: string;
  request: ProfilePinsRequest;
  fetcher?: typeof fetch;
}): Promise<ProfilePinsResponse> {
  const request = profilePinsRequestSchema.parse(input.request);
  const payload = await authenticatedPut({
    ...input,
    path: '/api/me/pins',
    body: request,
  });
  const response = profilePinsResponseSchema.safeParse(payload);
  if (!response.success) throw new Error('The profile service returned an invalid pins response.');
  return response.data;
}
