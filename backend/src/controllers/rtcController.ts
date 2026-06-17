import { Request, Response } from 'express';

/**
 * WebRTC ICE servers for watch-party voice, served to clients at
 * `GET /api/rtc/ice` so TURN can be configured server-side WITHOUT rebuilding
 * the web/mobile apps.
 *
 * Always returns public STUN (works on simple/cone NAT). If a TURN relay is
 * configured via env (TURN_URLS + TURN_USERNAME + TURN_PASSWORD) it's appended —
 * TURN is what makes voice connect across mobile data / strict NAT. Run the
 * bundled coturn (`docker compose --profile voice up -d --build`) and point
 * TURN_URLS at this droplet. The old hardcoded openrelay.metered.ca relay is
 * dead, which is why voice stopped connecting.
 */
export const getIceServers = (_req: Request, res: Response) => {
  const iceServers: Array<{ urls: string | string[]; username?: string; credential?: string }> = [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ];

  const turnUrls = (process.env.TURN_URLS || process.env.TURN_URL || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  const username = process.env.TURN_USERNAME;
  const credential = process.env.TURN_PASSWORD;

  if (turnUrls.length && username && credential) {
    iceServers.push({ urls: turnUrls, username, credential });
  }

  // Cache briefly; creds here are long-lived, not per-session.
  res.setHeader('Cache-Control', 'public, max-age=300');
  res.json({ success: true, data: { iceServers } });
};
