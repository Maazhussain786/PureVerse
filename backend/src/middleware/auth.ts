import { Request, Response, NextFunction } from 'express';
import { getSession, getUser } from '../services/userStore';
import { UserRecord } from '../models/user';

// Express request augmented with the authenticated user
export interface AuthedRequest extends Request {
  user?: UserRecord;
}

function extractToken(req: Request): string | undefined {
  const header = req.headers.authorization;
  if (header?.startsWith('Bearer ')) return header.slice(7);
  const queryToken = req.query.token;
  if (typeof queryToken === 'string' && queryToken) return queryToken;
  return undefined;
}

export function resolveUserFromToken(token?: string): UserRecord | undefined {
  if (!token) return undefined;
  const session = getSession(token);
  if (!session) return undefined;
  return getUser(session.userId);
}

export function requireAuth(req: AuthedRequest, res: Response, next: NextFunction) {
  const user = resolveUserFromToken(extractToken(req));
  if (!user) {
    res.status(401).json({ success: false, message: 'Not signed in' });
    return;
  }
  req.user = user;
  next();
}

export function optionalAuth(req: AuthedRequest, _res: Response, next: NextFunction) {
  req.user = resolveUserFromToken(extractToken(req));
  next();
}
