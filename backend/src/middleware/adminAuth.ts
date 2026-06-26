import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';

// Gate for owner-only endpoints (e.g. listing all users). Requires an
// ADMIN_TOKEN env var to be set on the server; the request must present the
// same value via the `x-admin-token` header or `?token=` query param.
function extractAdminToken(req: Request): string | undefined {
  const header = req.headers['x-admin-token'];
  if (typeof header === 'string' && header) return header;
  const queryToken = req.query.token;
  if (typeof queryToken === 'string' && queryToken) return queryToken;
  return undefined;
}

// Length-safe constant-time compare to avoid leaking the token via timing.
function tokensMatch(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ba.length !== bb.length) return false;
  return crypto.timingSafeEqual(ba, bb);
}

export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  const expected = process.env.ADMIN_TOKEN;
  if (!expected) {
    res
      .status(503)
      .json({ success: false, message: 'Admin API disabled (set ADMIN_TOKEN)' });
    return;
  }
  const provided = extractAdminToken(req);
  if (!provided || !tokensMatch(provided, expected)) {
    res.status(401).json({ success: false, message: 'Invalid admin token' });
    return;
  }
  next();
}
