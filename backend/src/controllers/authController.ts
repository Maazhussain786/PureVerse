import { Response } from 'express';
import { signInWithGoogle, signInAsGuest } from '../services/authService';
import { destroySession } from '../services/userStore';
import { toPublicUser } from '../models/user';
import { AuthedRequest } from '../middleware/auth';

function sessionPayload(result: { user: any; session: any; isNew: boolean }) {
  return {
    token: result.session.token,
    user: toPublicUser(result.user),
    isNew: result.isNew,
  };
}

// POST /api/auth/google  { credential, importState? }
export const googleSignIn = async (req: AuthedRequest, res: Response) => {
  try {
    const { credential, importState } = req.body || {};
    if (!credential || typeof credential !== 'string') {
      res.status(400).json({ success: false, message: 'Missing credential' });
      return;
    }
    const result = await signInWithGoogle(credential, importState);
    res.json({ success: true, data: sessionPayload(result) });
  } catch (error: any) {
    const reason = error?.message || 'Google sign-in failed';
    console.error('[Auth] Google sign-in failed:', reason);
    res.status(401).json({ success: false, message: reason });
  }
};

// POST /api/auth/guest  { name?, importState? }
export const guestSignIn = (req: AuthedRequest, res: Response) => {
  try {
    const { name, importState } = req.body || {};
    const result = signInAsGuest(name, importState);
    res.json({ success: true, data: sessionPayload(result) });
  } catch (error: any) {
    console.error('[Auth] Guest sign-in failed:', error?.message || error);
    res.status(500).json({ success: false, message: 'Guest sign-in failed' });
  }
};

// GET /api/auth/session  (requireAuth)
export const getSessionUser = (req: AuthedRequest, res: Response) => {
  res.json({ success: true, data: { user: toPublicUser(req.user!) } });
};

// POST /api/auth/logout  (requireAuth — token comes from the header)
export const logout = (req: AuthedRequest, res: Response) => {
  const header = req.headers.authorization;
  if (header?.startsWith('Bearer ')) destroySession(header.slice(7));
  res.json({ success: true });
};
