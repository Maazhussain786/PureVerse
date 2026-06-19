import crypto from 'crypto';

// ─── Watch Party room registry ────────────────────────────
// Rooms are in-memory (they are inherently ephemeral). The socket layer
// (sockets/roomCoordinator.ts) mutates rooms through these helpers and the
// REST layer (controllers/partyController.ts) reads public summaries.

export interface PartyMember {
  socketId: string;
  userId?: string;
  name: string;
  avatar: string;
  isHost: boolean;
  joinedAt: number;
  mutedUntil: number; // 0 = not muted; Infinity-ish for permanent
  // ── Voice (WebRTC mesh) ──
  inVoice: boolean; // joined the voice channel (peer of the mesh)
  micOn: boolean; // publishing audio (false = muted but still in voice)
  deafened: boolean; // not listening to anyone (purely a client-side hint)
  // ── Playback sync / buffering ──
  buffering: boolean; // player is stalled / re-buffering
  reportedPos: number; // last player position this member reported
  posAt: number; // Date.now() of the last position report
}

export interface PartyChatMessage {
  id: string;
  kind: 'chat' | 'system';
  authorSocketId?: string;
  authorName: string;
  authorAvatar?: string;
  authorIsHost?: boolean;
  text: string;
  createdAt: number;
}

export interface PartyMedia {
  type: string;
  id: string;
  title: string;
  posterUrl?: string;
  bannerUrl?: string;
  season?: number;
  episode?: number;
  sourceIdx: number;
  category?: 'sub' | 'dub'; // anime audio variant — keep everyone on the same track
}

export interface PartyPlayback {
  isPlaying: boolean;
  positionSec: number; // position at `updatedAt`
  updatedAt: number;
}

export interface PartyRoom {
  code: string;
  name: string;
  passwordHash?: string;
  isPublic: boolean;
  allowGuestControl: boolean;
  hostSocketId: string;
  createdAt: number;
  media: PartyMedia;
  playback: PartyPlayback;
  members: Map<string, PartyMember>;
  chat: PartyChatMessage[];
  bannedKeys: Set<string>; // userId or lowercase name of kicked users
  emptySince: number | null;
  autoWait: boolean; // auto-pause the party while a member buffers / lags (host toggle)
  holding: boolean; // transient: party is currently held waiting for stragglers
  holdSince: number | null; // Date.now() the current hold began (for the max-hold safety valve)
}

const rooms = new Map<string, PartyRoom>();

const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; // no 0/O/1/I/L
const MAX_CHAT_HISTORY = 200;
const EMPTY_ROOM_TTL_MS = 5 * 60 * 1000;

export function hashPassword(pw: string): string {
  return crypto.createHash('sha256').update(pw).digest('hex');
}

function generateCode(): string {
  for (let attempt = 0; attempt < 50; attempt++) {
    let code = '';
    const bytes = crypto.randomBytes(6);
    for (let i = 0; i < 6; i++) code += CODE_ALPHABET[bytes[i] % CODE_ALPHABET.length];
    if (!rooms.has(code)) return code;
  }
  throw new Error('Could not allocate room code');
}

export function createRoom(opts: {
  name: string;
  password?: string;
  isPublic: boolean;
  allowGuestControl: boolean;
  autoWait?: boolean;
  media: PartyMedia;
  host: { socketId: string; userId?: string; name: string; avatar: string };
}): PartyRoom {
  const room: PartyRoom = {
    code: generateCode(),
    name: opts.name.trim().slice(0, 60) || 'Watch Party',
    passwordHash: opts.password ? hashPassword(opts.password) : undefined,
    isPublic: opts.isPublic,
    allowGuestControl: opts.allowGuestControl,
    hostSocketId: opts.host.socketId,
    createdAt: Date.now(),
    media: { ...opts.media, sourceIdx: opts.media.sourceIdx || 0 },
    playback: { isPlaying: false, positionSec: 0, updatedAt: Date.now() },
    members: new Map(),
    chat: [],
    bannedKeys: new Set(),
    emptySince: null,
    autoWait: opts.autoWait !== false, // default on
    holding: false,
    holdSince: null,
  };
  room.members.set(opts.host.socketId, newMember({ ...opts.host, isHost: true }));
  rooms.set(room.code, room);
  return room;
}

/// Build a member with all voice/buffer defaults zeroed. Used by create + join
/// so the shape stays in one place.
export function newMember(opts: {
  socketId: string;
  userId?: string;
  name: string;
  avatar: string;
  isHost: boolean;
}): PartyMember {
  return {
    socketId: opts.socketId,
    userId: opts.userId,
    name: opts.name,
    avatar: opts.avatar,
    isHost: opts.isHost,
    joinedAt: Date.now(),
    mutedUntil: 0,
    inVoice: false,
    micOn: false,
    deafened: false,
    buffering: false,
    reportedPos: 0,
    posAt: 0,
  };
}

export function getRoom(code: string): PartyRoom | undefined {
  return rooms.get((code || '').toUpperCase());
}

export function deleteRoom(code: string) {
  rooms.delete(code);
}

export function publicRooms() {
  return Array.from(rooms.values())
    .filter((r) => r.isPublic && r.members.size > 0)
    .sort((a, b) => b.members.size - a.members.size)
    .slice(0, 50)
    .map((r) => summarizeRoom(r));
}

export function summarizeRoom(room: PartyRoom) {
  return {
    code: room.code,
    name: room.name,
    hasPassword: !!room.passwordHash,
    isPublic: room.isPublic,
    memberCount: room.members.size,
    media: {
      type: room.media.type,
      id: room.media.id,
      title: room.media.title,
      posterUrl: room.media.posterUrl,
      season: room.media.season,
      episode: room.media.episode,
    },
    createdAt: room.createdAt,
  };
}

// Live position derived from the virtual clock
export function currentPosition(room: PartyRoom): number {
  const p = room.playback;
  if (!p.isPlaying) return p.positionSec;
  return p.positionSec + (Date.now() - p.updatedAt) / 1000;
}

export function serializeMember(m: PartyMember) {
  return {
    socketId: m.socketId,
    name: m.name,
    avatar: m.avatar,
    isHost: m.isHost,
    joinedAt: m.joinedAt,
    muted: m.mutedUntil > Date.now(),
    inVoice: m.inVoice,
    micOn: m.micOn,
    deafened: m.deafened,
    buffering: m.buffering,
  };
}

export function serializeRoom(room: PartyRoom) {
  return {
    code: room.code,
    name: room.name,
    isPublic: room.isPublic,
    hasPassword: !!room.passwordHash,
    allowGuestControl: room.allowGuestControl,
    autoWait: room.autoWait,
    holding: room.holding,
    hostSocketId: room.hostSocketId,
    createdAt: room.createdAt,
    media: room.media,
    playback: {
      isPlaying: room.playback.isPlaying,
      positionSec: currentPosition(room),
      updatedAt: room.playback.updatedAt,
    },
    members: Array.from(room.members.values()).map(serializeMember),
    chat: room.chat.slice(-MAX_CHAT_HISTORY),
  };
}

// ─── Voice + buffer-aware sync helpers ────────────────────
export const VOICE_CAP = 10; // max peers in the WebRTC mesh (SFU is the scale path)
export const LAG_HOLD_SEC = 3.5; // a member this far behind the clock triggers a hold
export const READY_TOL_SEC = 2.0; // everyone within this of target → safe to resume
// Safety valve: never freeze the party longer than this waiting for one slow
// member. After it, the party auto-resumes and the straggler catches up on its
// own (or taps "Sync to live"). This is what stops the endless "waiting for X".
export const MAX_HOLD_MS = 12_000;

/// Snapshot of every live room (for the periodic max-hold sweep).
export function allRooms(): PartyRoom[] {
  return Array.from(rooms.values());
}

export function voiceMemberCount(room: PartyRoom): number {
  let n = 0;
  for (const m of room.members.values()) if (m.inVoice) n++;
  return n;
}

/// How far behind the live party clock a member is (seconds; <=0 = on/ahead).
export function secondsBehind(room: PartyRoom, m: PartyMember): number {
  if (!m.posAt) return 0;
  // Extrapolate the member's last report to "now" if the party is playing.
  const elapsed = room.playback.isPlaying ? (Date.now() - m.posAt) / 1000 : 0;
  const memberNow = m.reportedPos + elapsed;
  return currentPosition(room) - memberNow;
}

/// True when at least one member is stalled or lagging past the hold threshold.
export function anyoneStalled(room: PartyRoom): boolean {
  for (const m of room.members.values()) {
    if (m.buffering) return true;
    if (secondsBehind(room, m) > LAG_HOLD_SEC) return true;
  }
  return false;
}

/// True only when every member is unbuffered and within READY_TOL of the clock.
export function everyoneReady(room: PartyRoom): boolean {
  for (const m of room.members.values()) {
    if (m.buffering) return false;
    if (Math.abs(secondsBehind(room, m)) > READY_TOL_SEC) return false;
  }
  return true;
}

/// Per-member buffering summary for the host UI (used when autoWait is off).
export function bufferingStatus(room: PartyRoom) {
  return Array.from(room.members.values())
    .map((m) => ({
      socketId: m.socketId,
      name: m.name,
      buffering: m.buffering,
      secondsBehind: Math.max(0, Math.round(secondsBehind(room, m) * 10) / 10),
    }))
    .filter((s) => s.buffering || s.secondsBehind > LAG_HOLD_SEC);
}

export function addChatMessage(
  room: PartyRoom,
  msg: Omit<PartyChatMessage, 'id' | 'createdAt'>
): PartyChatMessage {
  const message: PartyChatMessage = {
    ...msg,
    id: crypto.randomBytes(8).toString('hex'),
    createdAt: Date.now(),
  };
  room.chat.push(message);
  if (room.chat.length > MAX_CHAT_HISTORY) {
    room.chat = room.chat.slice(-MAX_CHAT_HISTORY);
  }
  return message;
}

export function memberBanKey(member: PartyMember): string {
  return member.userId || `name:${member.name.toLowerCase()}`;
}

// Periodic cleanup of rooms that have been empty for a while (covers the
// "everyone refreshed at once" case — the room survives a brief empty gap).
export function sweepEmptyRooms(onDelete?: (room: PartyRoom) => void) {
  const now = Date.now();
  for (const room of rooms.values()) {
    if (room.members.size === 0) {
      if (room.emptySince === null) room.emptySince = now;
      else if (now - room.emptySince > EMPTY_ROOM_TTL_MS) {
        rooms.delete(room.code);
        onDelete?.(room);
      }
    } else {
      room.emptySince = null;
    }
  }
}
