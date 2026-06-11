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
  media: PartyMedia;
  host: Omit<PartyMember, 'isHost' | 'joinedAt' | 'mutedUntil'>;
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
  };
  room.members.set(opts.host.socketId, {
    ...opts.host,
    isHost: true,
    joinedAt: Date.now(),
    mutedUntil: 0,
  });
  rooms.set(room.code, room);
  return room;
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

export function serializeRoom(room: PartyRoom) {
  return {
    code: room.code,
    name: room.name,
    isPublic: room.isPublic,
    hasPassword: !!room.passwordHash,
    allowGuestControl: room.allowGuestControl,
    hostSocketId: room.hostSocketId,
    createdAt: room.createdAt,
    media: room.media,
    playback: {
      isPlaying: room.playback.isPlaying,
      positionSec: currentPosition(room),
      updatedAt: room.playback.updatedAt,
    },
    members: Array.from(room.members.values()).map((m) => ({
      socketId: m.socketId,
      name: m.name,
      avatar: m.avatar,
      isHost: m.isHost,
      joinedAt: m.joinedAt,
      muted: m.mutedUntil > Date.now(),
    })),
    chat: room.chat.slice(-MAX_CHAT_HISTORY),
  };
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
