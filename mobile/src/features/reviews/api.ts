import {
  apiErrorSchema,
  reviewRequestSchema,
  reviewResponseSchema,
  type ReviewRequest,
  type ReviewResponse,
} from '@foodie-cards/shared';

export function reviewEndpoint(apiBaseUrl: string, restaurantId: string): string {
  let url: URL;
  try {
    url = new URL(apiBaseUrl);
  } catch {
    throw new Error('Review saving is unavailable because the API URL is not configured.');
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    throw new Error('Review saving requires an HTTP or HTTPS API URL.');
  }
  if (!restaurantId) throw new Error('A restaurant is required to save a review.');
  const basePath = url.pathname.replace(/\/+$/, '');
  url.pathname = `${basePath}/api/reviews/${encodeURIComponent(restaurantId)}`;
  url.search = '';
  url.hash = '';
  return url.toString();
}

export async function submitReview(input: {
  apiBaseUrl: string;
  accessToken: string;
  restaurantId: string;
  review: ReviewRequest;
  fetcher?: typeof fetch;
}): Promise<ReviewResponse> {
  const request = reviewRequestSchema.parse(input.review);
  if (!input.accessToken.trim()) throw new Error('Sign in again before saving your review.');

  let response: Response;
  try {
    response = await (input.fetcher ?? fetch)(
      reviewEndpoint(input.apiBaseUrl, input.restaurantId),
      {
        method: 'PATCH',
        headers: {
          Accept: 'application/json',
          Authorization: `Bearer ${input.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(request),
      },
    );
  } catch {
    throw new Error('The review service could not be reached. Check your connection and try again.');
  }

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    throw new Error(
      response.ok
        ? 'The review service returned an invalid response.'
        : `The review could not be saved (${response.status}).`,
    );
  }

  if (!response.ok) {
    const apiError = apiErrorSchema.safeParse(payload);
    throw new Error(
      apiError.success
        ? apiError.data.message
        : `The review could not be saved (${response.status}).`,
    );
  }

  const parsed = reviewResponseSchema.safeParse(payload);
  if (!parsed.success) throw new Error('The review service returned an invalid response.');
  return parsed.data;
}
