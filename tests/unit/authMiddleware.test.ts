/**
 * Tests for auth middleware stubs (src/middleware/auth.ts).
 * These confirm the correct 401/403 rejection shapes are enforced
 * and that the auth bypass mode works in development.
 */

import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import type { Request, Response, NextFunction } from 'express';

function mockReqRes(headers: Record<string, string> = {}): {
  req: Partial<Request>;
  res: { status: ReturnType<typeof vi.fn>; json: ReturnType<typeof vi.fn> };
  next: ReturnType<typeof vi.fn>;
} {
  const json = vi.fn();
  const status = vi.fn().mockReturnValue({ json });
  const req: Partial<Request> = { headers: headers as any };
  const res = { status, json } as any;
  const next = vi.fn();
  return { req, res, next };
}

describe('requireAuth', () => {
  beforeEach(() => {
    vi.stubEnv('NODE_ENV', 'development');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it('returns 401 when Authorization header is missing', async () => {
    const { requireAuth } = await import('../../src/middleware/auth.js');
    const { req, res, next } = mockReqRes();
    requireAuth(req as Request, res as unknown as Response, next as NextFunction);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 401 when Authorization header is not Bearer', async () => {
    const { requireAuth } = await import('../../src/middleware/auth.js');
    const { req, res, next } = mockReqRes({ authorization: 'Basic abc' });
    requireAuth(req as Request, res as unknown as Response, next as NextFunction);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 401 when Bearer token is empty', async () => {
    const { requireAuth } = await import('../../src/middleware/auth.js');
    const { req, res, next } = mockReqRes({ authorization: 'Bearer ' });
    requireAuth(req as Request, res as unknown as Response, next as NextFunction);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('attaches principal and calls next with a valid bearer token', async () => {
    const { requireAuth } = await import('../../src/middleware/auth.js');
    const { req, res, next } = mockReqRes({ authorization: 'Bearer user-token-123' });
    requireAuth(req as Request, res as unknown as Response, next as NextFunction);
    expect(next).toHaveBeenCalled();
    expect((req as any).auth).toEqual({ userId: 'user-token-123', roles: ['user'] });
  });

  it('bypasses auth and attaches dev principal when AUTH_BYPASS=true', async () => {
    vi.stubEnv('AUTH_BYPASS', 'true');
    vi.stubEnv('NODE_ENV', 'development');
    vi.resetModules();
    const { requireAuth } = await import('../../src/middleware/auth.js');
    const { req, res, next } = mockReqRes();
    requireAuth(req as Request, res as unknown as Response, next as NextFunction);
    expect(next).toHaveBeenCalled();
    expect((req as any).auth).toEqual({ userId: 'dev-bypass-user', roles: ['user'] });
  });

  it('fails closed at startup when AUTH_BYPASS=true in production', async () => {
    vi.stubEnv('AUTH_BYPASS', 'true');
    vi.stubEnv('NODE_ENV', 'production');
    vi.resetModules();

    await expect(import('../../src/middleware/auth.js')).rejects.toThrow('AUTH_BYPASS=true is only allowed');
  });

  it('fails closed at startup when production would use placeholder bearer-token identity', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('INTERNAL_API_SECRET', 'real-internal-secret');
    vi.resetModules();

    await expect(import('../../src/middleware/auth.js')).rejects.toThrow('requires real JWT/JWKS verification');
  });
});

describe('requireInternalAuth', () => {
  beforeEach(() => {
    vi.stubEnv('NODE_ENV', 'development');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it('returns 401 when Authorization header is missing', async () => {
    vi.stubEnv('INTERNAL_API_SECRET', 'secret123');
    vi.resetModules();
    const { requireInternalAuth } = await import('../../src/middleware/auth.js');
    const { req, res, next } = mockReqRes();
    requireInternalAuth(req as Request, res as unknown as Response, next as NextFunction);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 403 when token does not match INTERNAL_API_SECRET', async () => {
    vi.stubEnv('INTERNAL_API_SECRET', 'secret123');
    vi.resetModules();
    const { requireInternalAuth } = await import('../../src/middleware/auth.js');
    const { req, res, next } = mockReqRes({ authorization: 'Bearer wrongtoken' });
    requireInternalAuth(req as Request, res as unknown as Response, next as NextFunction);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  it('calls next when token matches INTERNAL_API_SECRET', async () => {
    vi.stubEnv('INTERNAL_API_SECRET', 'secret123');
    vi.resetModules();
    const { requireInternalAuth } = await import('../../src/middleware/auth.js');
    const { req, res, next } = mockReqRes({ authorization: 'Bearer secret123' });
    requireInternalAuth(req as Request, res as unknown as Response, next as NextFunction);
    expect(next).toHaveBeenCalled();
    expect((req as any).auth).toEqual({ userId: 'internal-service', roles: ['internal'] });
  });

  it('bypasses auth when AUTH_BYPASS=true', async () => {
    vi.stubEnv('AUTH_BYPASS', 'true');
    vi.stubEnv('NODE_ENV', 'development');
    vi.resetModules();
    const { requireInternalAuth } = await import('../../src/middleware/auth.js');
    const { req, res, next } = mockReqRes();
    requireInternalAuth(req as Request, res as unknown as Response, next as NextFunction);
    expect(next).toHaveBeenCalled();
    expect((req as any).auth).toEqual({ userId: 'internal-bypass', roles: ['internal'] });
  });

  it('fails closed at startup when staging uses the placeholder INTERNAL_API_SECRET', async () => {
    vi.stubEnv('APP_ENV', 'staging');
    vi.stubEnv('INTERNAL_API_SECRET', 'changeme-internal-secret');
    vi.resetModules();

    await expect(import('../../src/middleware/auth.js')).rejects.toThrow('non-placeholder INTERNAL_API_SECRET');
  });
});
