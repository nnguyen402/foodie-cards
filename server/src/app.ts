import express, { type Express, type RequestHandler } from 'express';
import { apiErrorSchema, type ApiError, type ApiErrorCode } from '@foodie-cards/shared';
import type { ServerDependencies } from './auth.js';
import { createReceiptRouter } from './receipts/routes.js';
import type { ReceiptDependencies } from './receipts/store.js';

export type { ServerDependencies } from './auth.js';

function sendError(res: express.Response, status: number, code: ApiErrorCode, message: string, retryable = false) {
  const body: ApiError = { code, message, retryable };
  return res.status(status).json(apiErrorSchema.parse(body));
}

export function createApp(
  dependencies: ServerDependencies | undefined = undefined,
  receiptDependencies: ReceiptDependencies | undefined = undefined,
): Express {
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '32kb' }));

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

  app.use('/api/receipts', createReceiptRouter(requireVerifiedUser, receiptDependencies));

  return app;
}
