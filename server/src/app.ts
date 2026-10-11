import express, { type Express, type RequestHandler } from 'express';
import {
  apiErrorSchema,
  progressionResultSchema,
  profileEditRequestSchema,
  profileEditResponseSchema,
  profilePinsRequestSchema,
  profilePinsResponseSchema,
  equipTitleRequestSchema,
  equipTitleResponseSchema,
  revealAcknowledgementResponseSchema,
  reviewRequestSchema,
  reviewResponseSchema,
  type ApiError,
  type ApiErrorCode,
} from '@foodie-cards/shared';
import type { ServerDependencies } from './auth.js';
import { canonicalizeReceiptItems, ReceiptItemResolutionError, safeConfirmedReceiptSchema, uuidSchema } from './receipts/submit.js';
import { createReceiptRouter } from './receipts/routes.js';
import type { ReceiptDependencies } from './receipts/store.js';

export type { ServerDependencies } from './auth.js';

function sendError(res: express.Response, status: number, code: ApiErrorCode, message: string, retryable = false) {
  const body: ApiError = { code, message, retryable };
  return res.status(status).json(apiErrorSchema.parse(body));
}

function errorCodePrefix(error: unknown): string | null {
  if (!error || typeof error !== 'object' || !('message' in error) || typeof error.message !== 'string') return null;
  return /^([A-Z_]+)(?::|$)/.exec(error.message)?.[1] ?? null;
}

function sendServiceError(res: express.Response, error: unknown) {
  if (error && typeof error === 'object' && 'code' in error) {
    if (error.code === 'FORBIDDEN' || error.code === 'NOT_FOUND') {
      return sendError(res, 404, 'NOT_FOUND', 'The requested item was not found.');
    }
    if (error.code === 'INVALID_REQUEST') {
      return sendError(res, 400, 'INVALID_REQUEST', 'The request could not be accepted.');
    }
  }
  const code = errorCodePrefix(error);
  if (code === 'DUPLICATE_RECEIPT' || (error && typeof error === 'object' && 'code' in error && error.code === '23505')) {
    return sendError(res, 409, 'DUPLICATE_RECEIPT', 'This receipt appears to have already been submitted.');
  }
  if (code === 'INVALID_REQUEST') return sendError(res, 400, 'INVALID_REQUEST', 'The request could not be accepted.');
  if (code === 'INVALID_RECEIPT') return sendError(res, 400, 'INVALID_RECEIPT', 'The confirmed receipt could not be accepted.');
  if (code === 'FORBIDDEN') return sendError(res, 404, 'NOT_FOUND', 'The requested item was not found.');
  if (code === 'NOT_FOUND') return sendError(res, 404, 'NOT_FOUND', 'The requested item was not found.');
  return sendError(res, 503, 'INTERNAL_ERROR', 'The request could not be completed right now.', true);
}

function requireService<T extends keyof ServerDependencies>(dependencies: ServerDependencies, key: T): NonNullable<ServerDependencies[T]> | undefined {
  return dependencies[key] as NonNullable<ServerDependencies[T]> | undefined;
}

export function createApp(
  dependencies: ServerDependencies | undefined = undefined,
  receiptDependencies: ReceiptDependencies | undefined = undefined,
): Express {
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '512kb' }));

  app.get('/health', (_req, res) => res.status(200).json({ ok: true }));

  const requireVerifiedUser: RequestHandler = async (req, res, next) => {
    if (!dependencies) {
      sendError(res, 503, 'CONFIGURATION_ERROR', 'Authentication service is not configured.');
      return;
    }
    const authorization = req.header('authorization');
    const match = authorization?.match(/^Bearer\s+([^\s]+)$/i);
    if (!match) {
      sendError(res, 401, 'UNAUTHORIZED', 'A valid Bearer token is required.');
      return;
    }
    try {
      const user = await dependencies.verifyAccessToken(match[1]);
      if (!user) {
        sendError(res, 401, 'UNAUTHORIZED', 'The Bearer token is invalid or expired.');
        return;
      }
      res.locals.authenticatedUserId = user.userId;
      next();
    } catch {
      sendError(res, 503, 'AUTH_UNAVAILABLE', 'Authentication could not be verified right now.', true);
    }
  };

  app.get('/api/me', requireVerifiedUser, async (_req, res) => {
    if (!dependencies) {
      sendError(res, 503, 'CONFIGURATION_ERROR', 'Authentication service is not configured.');
      return;
    }
    try {
      const profile = await dependencies.loadProfile(res.locals.authenticatedUserId as string);
      if (!profile) {
        sendError(res, 404, 'NOT_FOUND', 'Profile not found.');
        return;
      }
      res.status(200).json(profile);
    } catch {
      sendError(res, 503, 'AUTH_UNAVAILABLE', 'Profile service is unavailable right now.', true);
    }
  });

  const profileActions = [
    { method: 'patch' as const, path: '/api/me', key: 'editProfile' as const, request: profileEditRequestSchema, response: profileEditResponseSchema },
    { method: 'put' as const, path: '/api/me/pins', key: 'setPins' as const, request: profilePinsRequestSchema, response: profilePinsResponseSchema },
    { method: 'put' as const, path: '/api/me/title', key: 'equipTitle' as const, request: equipTitleRequestSchema, response: equipTitleResponseSchema },
  ];
  for (const action of profileActions) {
    app[action.method](action.path, requireVerifiedUser, async (req, res) => {
      const service = dependencies?.[action.key];
      if (!service) return sendError(res, 503, 'CONFIGURATION_ERROR', 'Profile service is not configured.');
      const input = action.request.safeParse(req.body);
      if (!input.success) return sendError(res, 400, 'INVALID_REQUEST', 'The profile request is invalid.');
      try {
        const result = await service(res.locals.authenticatedUserId as string, input.data);
        const output = action.response.safeParse(result);
        if (!output.success) return sendError(res, 503, 'INTERNAL_ERROR', 'Profile service returned an invalid result.', true);
        return res.status(200).json(output.data);
      } catch (error) {
        return sendServiceError(res, error);
      }
    });
  }

  app.post('/api/receipts/submit', requireVerifiedUser, async (req, res) => {
    if (!dependencies) return sendError(res, 503, 'CONFIGURATION_ERROR', 'Receipt service is not configured.');
    const parsed = safeConfirmedReceiptSchema.safeParse(req.body);
    if (!parsed.success) return sendError(res, 400, 'INVALID_REQUEST', 'The confirmed receipt is invalid.');
    const input = parsed.data;
    const userId = res.locals.authenticatedUserId as string;
    const loadDraft = requireService(dependencies, 'loadReceiptDraft');
    const loadMenu = requireService(dependencies, 'loadRestaurantMenu');
    const accept = requireService(dependencies, 'acceptReceipt');
    if (!loadDraft || !loadMenu || !accept) return sendError(res, 503, 'CONFIGURATION_ERROR', 'Receipt service is not configured.');

    try {
      const draft = await loadDraft(userId, input.draftId);
      if (!draft) return sendError(res, 404, 'NOT_FOUND', 'Receipt draft not found.');
      const validImagePath = !!draft.imagePath && draft.imagePath.startsWith(`${userId}/`) &&
        !draft.imagePath.includes('\\') && !draft.imagePath.split('/').some((part) => !part || part === '.' || part === '..');
      const validImageHash = typeof draft.imageHash === 'string' && /^[a-f\d]{64}$/i.test(draft.imageHash);
      if (!validImagePath || !validImageHash) return sendError(res, 400, 'INVALID_RECEIPT', 'The receipt image could not be verified.');

      if (draft.status === 'accepted' && draft.submissionId === input.submissionId) {
        const replay = progressionResultSchema.safeParse(draft.acceptanceResult);
        if (replay.success && replay.data.receiptId === input.draftId) return res.status(200).json(replay.data);
      }
      if (draft.status !== 'draft' && draft.status !== 'confirmed') {
        return sendError(res, 409, 'DUPLICATE_RECEIPT', 'This receipt appears to have already been submitted.');
      }

      const menu = await loadMenu(input.restaurantId);
      if (!menu || menu.restaurantId !== input.restaurantId) return sendError(res, 422, 'UNSUPPORTED_RESTAURANT', 'Choose a supported restaurant for this receipt.');
      let items: ReturnType<typeof canonicalizeReceiptItems>;
      try {
        items = canonicalizeReceiptItems(input.items, menu.items);
      } catch (error) {
        if (error instanceof ReceiptItemResolutionError && error.reason === 'unresolved') {
          return sendError(res, 400, 'INVALID_RECEIPT', 'Choose a supported menu item for each receipt line.');
        }
        if (error instanceof ReceiptItemResolutionError && error.reason === 'ambiguous') {
          return sendError(res, 400, 'INVALID_RECEIPT', 'A menu item could not be matched safely.');
        }
        return sendError(res, 503, 'INTERNAL_ERROR', 'The menu could not be loaded right now.', true);
      }
      const confirmed = { ...input, items } as Parameters<NonNullable<ServerDependencies['acceptReceipt']>>[3];
      const result = await accept(userId, input.draftId, input.submissionId, confirmed);
      const validResult = progressionResultSchema.safeParse(result);
      if (!validResult.success || validResult.data.receiptId !== input.draftId) {
        return sendError(res, 503, 'INTERNAL_ERROR', 'Receipt acceptance returned an invalid result.', true);
      }
      return res.status(200).json(validResult.data);
    } catch (error) {
      return sendServiceError(res, error);
    }
  });

  app.patch('/api/reviews/:restaurantId', requireVerifiedUser, async (req, res) => {
    if (!dependencies) return sendError(res, 503, 'CONFIGURATION_ERROR', 'Review service is not configured.');
    const restaurantId = typeof req.params.restaurantId === 'string' ? req.params.restaurantId : '';
    if (!uuidSchema.safeParse(restaurantId).success) return sendError(res, 400, 'INVALID_REQUEST', 'The restaurant identifier is invalid.');
    const parsed = reviewRequestSchema.safeParse(req.body);
    if (!parsed.success) return sendError(res, 400, 'INVALID_REQUEST', 'The review is invalid.');
    const saveReview = requireService(dependencies, 'saveReview');
    if (!saveReview) return sendError(res, 503, 'CONFIGURATION_ERROR', 'Review service is not configured.');
    try {
      const result = await saveReview(res.locals.authenticatedUserId as string, restaurantId, parsed.data);
      const valid = reviewResponseSchema.safeParse(result);
      if (!valid.success) return sendError(res, 503, 'INTERNAL_ERROR', 'Review service returned an invalid result.', true);
      return res.status(200).json(valid.data);
    } catch (error) {
      return sendServiceError(res, error);
    }
  });

  app.post('/api/rewards/:eventId/viewed', requireVerifiedUser, async (req, res) => {
    if (!dependencies) return sendError(res, 503, 'CONFIGURATION_ERROR', 'Reward service is not configured.');
    const eventId = typeof req.params.eventId === 'string' ? req.params.eventId : '';
    if (!uuidSchema.safeParse(eventId).success) return sendError(res, 400, 'INVALID_REQUEST', 'The reward identifier is invalid.');
    const acknowledge = requireService(dependencies, 'acknowledgeReward');
    if (!acknowledge) return sendError(res, 503, 'CONFIGURATION_ERROR', 'Reward service is not configured.');
    try {
      const result = await acknowledge(res.locals.authenticatedUserId as string, eventId);
      if (!result) return sendError(res, 404, 'NOT_FOUND', 'Reward event not found.');
      if (result.eventId !== eventId) return sendError(res, 503, 'INTERNAL_ERROR', 'Reward service returned an invalid result.', true);
      const valid = revealAcknowledgementResponseSchema.safeParse(result);
      if (!valid.success) return sendError(res, 503, 'INTERNAL_ERROR', 'Reward service returned an invalid result.', true);
      return res.status(200).json(valid.data);
    } catch (error) {
      return sendServiceError(res, error);
    }
  });

  app.get('/api/rewards/pending', requireVerifiedUser, async (_req, res) => {
    if (!dependencies) return sendError(res, 503, 'CONFIGURATION_ERROR', 'Reward service is not configured.');
    const loadPending = requireService(dependencies, 'loadPendingRewards');
    if (!loadPending) return sendError(res, 503, 'CONFIGURATION_ERROR', 'Reward service is not configured.');
    try {
      const rewards = await loadPending(res.locals.authenticatedUserId as string);
      const safeRewards = rewards.slice(0, 50).flatMap((reward) => {
        const result = progressionResultSchema.safeParse(reward.result);
        if (!uuidSchema.safeParse(reward.eventId).success || !Number.isFinite(Date.parse(reward.createdAt)) ||
          !result.success || result.data.revealEventId !== reward.eventId) return [];
        return [{ eventId: reward.eventId, createdAt: reward.createdAt, result: result.data }];
      });
      return res.status(200).json({ rewards: safeRewards });
    } catch (error) {
      return sendServiceError(res, error);
    }
  });

  app.use('/api/receipts', createReceiptRouter(requireVerifiedUser, receiptDependencies));

  app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    const status = error && typeof error === 'object' && 'status' in error && typeof error.status === 'number' ? error.status : 500;
    if (status === 413) return sendError(res, 413, 'INVALID_REQUEST', 'The request body is too large.');
    if (status === 400) return sendError(res, 400, 'INVALID_REQUEST', 'The request body is invalid.');
    return sendError(res, 500, 'INTERNAL_ERROR', 'The request could not be completed.');
  });

  return app;
}
