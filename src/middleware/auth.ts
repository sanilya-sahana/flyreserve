/**
 * Authentication middleware stubs.
 *
 * These stubs provide the structural enforcement required by the security
 * review (SAH-34) while the full JWT/session implementation is blocked on:
 *   - SAH-16 (infrastructure prerequisites, auth provider credentials)
 *   - Cybersecurity to define the token contract and JWKS endpoint
 *
 * The stubs enforce the correct rejection shape (401/403) and provide a
 * typed identity surface (`req.auth`) that real auth middleware will replace.
 * Mounting them now prevents accidental PII exposure if the service is run
 * in a non-local environment before the full auth stack lands.
 *
 * DEPLOYMENT NOTE: In development, set AUTH_BYPASS=true in the environment to
 * skip auth checks. This variable MUST NOT be set in staging or production.
 * In all environments without AUTH_BYPASS, requests must carry an
 * `Authorization: Bearer <token>` header; a placeholder principal is attached.
 * Full signature verification will replace this once Cybersecurity publishes
 * the JWKS contract.
 */

import type { Request, Response, NextFunction } from 'express';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      /** Authenticated principal attached by auth middleware. */
      auth?: AuthPrincipal;
    }
  }
}

export interface AuthPrincipal {
  /** User / subject id from the token */
  userId: string;
  /** Roles granted to this principal */
  roles: string[];
}

const AUTH_BYPASS = process.env['AUTH_BYPASS'] === 'true';

/**
 * Requires a bearer token on the request.
 *
 * Until full JWT verification is wired (blocked on SAH-16 / Cybersecurity):
 *   - If AUTH_BYPASS=true: attaches a dev principal and passes through.
 *   - Otherwise: requires `Authorization: Bearer <anything>` header and
 *     attaches a principal whose userId is the token value itself.
 *
 * Real verification (JWKS, audience, expiry) must be added by Cybersecurity
 * before this service ships to staging or production.
 */
export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  if (AUTH_BYPASS) {
    req.auth = { userId: 'dev-bypass-user', roles: ['user'] };
    next();
    return;
  }

  const authHeader = req.headers['authorization'];
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({
      error: 'Unauthorized',
      detail: 'This endpoint requires authentication. Provide Authorization: Bearer <token>.',
    });
    return;
  }

  const token = authHeader.slice(7).trim();
  if (!token) {
    res.status(401).json({ error: 'Unauthorized', detail: 'Bearer token is empty.' });
    return;
  }

  // Stub: treat token as userId until JWKS verification is wired.
  // TODO(Cybersecurity): replace with real JWT verification + claims extraction.
  req.auth = { userId: token, roles: ['user'] };
  next();
}

/**
 * Requires an internal/webhook bearer token.
 *
 * Used on endpoints that must only be callable by server-side processes
 * (e.g. payment-provider webhooks), not by end users.
 *
 * The INTERNAL_API_SECRET environment variable must be set in all deployed
 * environments. In development, AUTH_BYPASS=true skips this check.
 */
export function requireInternalAuth(req: Request, res: Response, next: NextFunction): void {
  if (AUTH_BYPASS) {
    req.auth = { userId: 'internal-bypass', roles: ['internal'] };
    next();
    return;
  }

  const internalSecret = process.env['INTERNAL_API_SECRET'];
  const authHeader = req.headers['authorization'];

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Unauthorized', detail: 'Internal endpoint requires authorization.' });
    return;
  }

  const token = authHeader.slice(7).trim();

  if (!internalSecret || token !== internalSecret) {
    res.status(403).json({
      error: 'Forbidden',
      detail: 'This endpoint is reserved for internal service-to-service calls.',
    });
    return;
  }

  req.auth = { userId: 'internal-service', roles: ['internal'] };
  next();
}
