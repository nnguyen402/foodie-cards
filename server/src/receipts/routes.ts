import express, { Router, type RequestHandler } from 'express';
import multer from 'multer';
import { apiErrorSchema, receiptDraftSchema, receiptRestaurantsResponseSchema, type ApiErrorCode } from '@foodie-cards/shared';
import { ReceiptDependencyError, type ReceiptDependencies } from './store.js';

const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const supportedMimeTypes = new Set(['image/jpeg', 'image/png', 'image/webp']);

class InvalidReceiptUploadError extends Error {}

function sendError(res: express.Response, status: number, code: ApiErrorCode, message: string, retryable = false) {
  return res.status(status).json(apiErrorSchema.parse({ code, message, retryable }));
}

function matchesImageSignature(bytes: Buffer, mimeType: string): boolean {
  if (mimeType === 'image/jpeg') return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (mimeType === 'image/png') return bytes.length >= 8 && bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  if (mimeType === 'image/webp') return bytes.length >= 12
    && bytes.toString('ascii', 0, 4) === 'RIFF'
    && bytes.toString('ascii', 8, 12) === 'WEBP';
  return false;
}

function receiptUploadError(error: unknown, res: express.Response): void {
  if (error instanceof multer.MulterError && error.code === 'LIMIT_FILE_SIZE') {
    sendError(res, 413, 'INVALID_RECEIPT', 'Receipt images must be no larger than 10 MiB.');
    return;
  }
  sendError(res, 400, 'INVALID_RECEIPT', 'Upload one JPEG, PNG, or WebP receipt image without extra fields.');
}

export function createReceiptRouter(
  authenticate: RequestHandler,
  dependencies: ReceiptDependencies | undefined,
): Router {
  const router = Router();
  router.use(authenticate);

  const requireDependencies: RequestHandler = (_req, res, next) => {
    if (!dependencies) {
      sendError(res, 503, 'CONFIGURATION_ERROR', 'Receipt service is not configured.');
      return;
    }
    next();
  };

  const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: MAX_IMAGE_BYTES, files: 1, fields: 0, parts: 1 },
    fileFilter: (_req, file, callback) => {
      if (!supportedMimeTypes.has(file.mimetype)) {
        callback(new InvalidReceiptUploadError('Unsupported image MIME type.'));
        return;
      }
      callback(null, true);
    },
  });
  const parseImage: RequestHandler = (req, res, next) => {
    upload.single('image')(req, res, (error: unknown) => {
      if (error) {
        receiptUploadError(error, res);
        return;
      }
      next();
    });
  };

  router.get('/restaurants', requireDependencies, async (_req, res) => {
    try {
      const restaurants = await dependencies!.listRestaurants();
      const response = receiptRestaurantsResponseSchema.parse({
        restaurants: restaurants.map(({ id, name, locationLabel }) => ({ id, name, locationLabel })),
      });
      res.status(200).json(response);
    } catch {
      sendError(res, 503, 'INTERNAL_ERROR', 'Restaurant catalog is temporarily unavailable.', true);
    }
  });

  router.get('/drafts/:draftId', requireDependencies, async (req, res) => {
    try {
      const draftId = req.params.draftId;
      if (typeof draftId !== 'string') {
        sendError(res, 404, 'NOT_FOUND', 'Receipt draft not found.');
        return;
      }
      const draft = await dependencies!.loadDraft(res.locals.authenticatedUserId as string, draftId);
      if (!draft) {
        sendError(res, 404, 'NOT_FOUND', 'Receipt draft not found.');
        return;
      }
      res.status(200).json(receiptDraftSchema.parse(draft));
    } catch (error) {
      if (error instanceof ReceiptDependencyError) {
        sendError(res, 503, error.code, 'Receipt draft is temporarily unavailable.', error.retryable);
        return;
      }
      sendError(res, 503, 'INTERNAL_ERROR', 'Receipt draft is temporarily unavailable.', true);
    }
  });

  router.post('/extract', requireDependencies, parseImage, async (req, res) => {
    const file = req.file;
    if (!file || file.size === 0 || !matchesImageSignature(file.buffer, file.mimetype)) {
      sendError(res, 400, 'INVALID_RECEIPT', 'Upload one valid JPEG, PNG, or WebP receipt image.');
      return;
    }

    const image = { bytes: file.buffer, mimeType: file.mimetype };
    try {
      const catalog = await dependencies!.listRestaurants();
      const extracted = receiptDraftSchema.parse(await dependencies!.extractImage(image, catalog));
      const saved = receiptDraftSchema.parse(await dependencies!.saveDraft(
        res.locals.authenticatedUserId as string,
        image,
        extracted,
      ));
      res.status(200).json(saved);
    } catch (error) {
      if (error instanceof ReceiptDependencyError) {
        sendError(res, 503, error.code, 'Receipt processing is temporarily unavailable.', error.retryable);
        return;
      }
      if (error instanceof InvalidReceiptUploadError) {
        sendError(res, 400, 'INVALID_RECEIPT', 'Receipt details could not be validated.');
        return;
      }
      sendError(res, 503, 'AI_UNAVAILABLE', 'Receipt processing is temporarily unavailable.', true);
    }
  });

  return router;
}
