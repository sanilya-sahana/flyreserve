/**
 * Tests for auth middleware stubs (src/middleware/auth.ts).
 * These confirm the correct 401/403 rejection shapes are enforced
 * and that the auth bypass mode works in development.
 */

import { describe, it, expect, afterEach, vi } from 'vitest';
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
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it('returns 401 when Authorization header is missing', async () => {
    vi.unstubAllEnvs();
    const { requireAuth } = await import('../../src/middleware/auth.js');
    const { req, res, next } = mockReqRes();
    requireAuth(req as Request, res as unknown as Response, next as NextFunction);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 401 when Authorization header is not Bearer', async () => {
    vi.unstubAllEnvs();
    const { requireAuth } = await import('../../src/middleware/auth.js');
    const { req, res, next } = mockReqRes({ authorization: 'Basic abc' });
    requireAuth(req as Request, res as unknown as Response, next as NextFunction);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 401 when Bearer token is empty', async () => {
    vi.unstubAllEnvs();
    const { requireAuth } = await import('../../src/middleware/auth.js');
    const { req, res, next } = mockReqRes({ authorization: 'Bearer ' });
    requireAuth(req as Request, res as unknown as Response, next as NextFunction);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('attaches principal and calls next with a valid bearer token', async () => {
    vi.unstubAllEnvs();
    const { requireAuth } = await import('../../src/middleware/auth.js');
    const { req, res, next } = mockReqRes({ authorization: 'Bearer user-token-123' });
    requireAuth(req as Request, res as unknown as Response, next as NextFunction);
    expect(next).toHaveBeenCalled();
    expect((req as any).auth).toEqual({ userId: 'user-token-123', roles: ['user'] });
  });

  it('bypasses auth and attaches dev principal when AUTH_BYPASS=true', async () => {
    vi.stubEnv('AUTH_BYPASS', 'true');
    vi.resetModules();
    const { requireAuth } = await import('../../src/middleware/auth.js');
    const { req, res, next } = mockReqRes();
    requireAuth(req as Request, res as unknown as Response, next as NextFunction);
    expect(next).toHaveBeenCalled();
    expect((req as any).auth).toEqual({ userId: 'dev-bypass-user', roles: ['user'] });
  });
});

describe('requireInternalAuth', () => {
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
    vi.resetModules();
    const { requireInternalAuth } = await import('../../src/middleware/auth.js');
    const { req, res, next } = mockReqRes();
    requireInternalAuth(req as Request, res as unknown as Response, next as NextFunction);
    expect(next).toHaveBeenCalled();
    expect((req as any).auth).toEqual({ userId: 'internal-bypass', roles: ['internal'] });
  });
});
