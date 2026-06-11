import { Request, Response } from 'express';
import { getRoom, publicRooms, summarizeRoom } from '../services/partyService';
import { sendPartyInvite } from '../services/notificationService';
import { AuthedRequest } from '../middleware/auth';

// GET /api/party/rooms — public room browser
export const listPublicRooms = (_req: Request, res: Response) => {
  res.json({ success: true, data: publicRooms() });
};

// GET /api/party/rooms/:code — meta for the join screen
export const getRoomMeta = (req: Request, res: Response) => {
  const room = getRoom(String(req.params.code));
  if (!room) {
    res.status(404).json({ success: false, message: 'Room not found' });
    return;
  }
  res.json({ success: true, data: summarizeRoom(room) });
};

// POST /api/party/invite { to, roomCode } — notifies a PureVerse user
export const inviteToParty = (req: AuthedRequest, res: Response) => {
  const { to, roomCode } = req.body || {};
  if (typeof to !== 'string' || !to.trim() || typeof roomCode !== 'string') {
    res.status(400).json({ success: false, message: 'Missing fields' });
    return;
  }
  const room = getRoom(roomCode);
  if (!room) {
    res.status(404).json({ success: false, message: 'Room not found' });
    return;
  }
  const sent = sendPartyInvite(req.user!, to.trim(), room.code, room.name, room.media.title);
  if (!sent) {
    res.status(404).json({ success: false, message: 'No PureVerse user found with that name or email' });
    return;
  }
  res.json({ success: true });
};
