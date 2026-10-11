import type { RequestHandler } from 'express';

const allowedMethods = new Set(['GET', 'POST', 'PATCH', 'PUT']);
const allowedHeaders = new Set(['accept', 'authorization', 'content-type']);
const allowMethodsHeader = 'GET, POST, PATCH, PUT';
const allowHeadersHeader = 'Accept, Authorization, Content-Type';

export function parseCorsAllowedOrigins(value: string | undefined): ReadonlySet<string> {
  if (!value?.trim()) return new Set();

  const entries = value.split(',').map((entry) => entry.trim());
  if (entries.some((entry) => entry === '')) {
    throw new Error('CORS_ALLOWED_ORIGINS must contain only exact HTTP or HTTPS origins.');
  }

  const origins = new Set<string>();
  for (const entry of entries) {
    let parsed: URL;
    try {
      parsed = new URL(entry);
    } catch {
      throw new Error('CORS_ALLOWED_ORIGINS must contain only exact HTTP or HTTPS origins.');
    }
    if ((parsed.protocol !== 'http:' && parsed.protocol !== 'https:') || parsed.origin !== entry) {
      throw new Error('CORS_ALLOWED_ORIGINS must contain only exact HTTP or HTTPS origins.');
    }
    origins.add(entry);
  }
  return origins;
}

export function createCorsMiddleware(configuredOrigins: string | undefined): RequestHandler {
  const origins = parseCorsAllowedOrigins(configuredOrigins);

  return (req, res, next) => {
    res.vary('Origin');
    const origin = req.header('Origin');
    const originAllowed = origin !== undefined && origins.has(origin);

    if (req.method === 'OPTIONS') {
      const requestedMethod = req.header('Access-Control-Request-Method')?.toUpperCase();
      const requestedHeaders = (req.header('Access-Control-Request-Headers') ?? '')
        .split(',')
        .map((header) => header.trim().toLowerCase())
        .filter(Boolean);

      if (!originAllowed || !requestedMethod || !allowedMethods.has(requestedMethod) ||
        requestedHeaders.some((header) => !allowedHeaders.has(header))) {
        res.sendStatus(403);
        return;
      }

      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Access-Control-Allow-Methods', allowMethodsHeader);
      res.setHeader('Access-Control-Allow-Headers', allowHeadersHeader);
      res.status(204).end();
      return;
    }

    if (originAllowed) res.setHeader('Access-Control-Allow-Origin', origin);
    next();
  };
}
