import { Server, Socket } from 'socket.io';
import {
  PartyRoom,
  addChatMessage,
  anyoneStalled,
  bufferingStatus,
  createRoom,
  currentPosition,
  deleteRoom,
  everyoneReady,
  getRoom,
  hashPassword,
  memberBanKey,
  newMember,
  serializeRoom,
  sweepEmptyRooms,
  voiceMemberCount,
  VOICE_CAP,
} from '../services/partyService';
import { resolveUserFromToken } from '../middleware/auth';

// ─── Watch Party socket coordinator ───────────────────────
// Protocol (client → server, all party-scoped):
//   party:create  {token?, name, password?, isPublic, allowGuestControl, media, profile}  → ack(room)
//   party:join    {token?, code, password?, profile}                                      → ack(room)
//   party:leave
//   party:chat     {text}
//   party:playback {action: 'play'|'pause'|'seek'|'resync', positionSec?}
//   party:media    {season?, episode?, sourceIdx?, category?}  (host only)
//   party:settings {name?, isPublic?, allowGuestControl?, autoWait?, password?|null} (host only)
//   party:mod      {action: 'mute'|'unmute'|'kick'|'timeout', targetSocketId, durationSec?} (host only)
//   party:position {positionSec}                               (host heartbeat)
//   party:voice    {inVoice?, micOn?, deafened?}               → ack({success, cap?})
//   party:rtc-signal {to, data}                                (WebRTC mesh relay)
//   party:buffering  {buffering, positionSec}                  (per-member sync report)
//
// Server → clients:
//   party:state (full snapshot) · party:members · party:chat · party:playback
//   party:media · party:settings · party:kicked · party:closed
//   party:voice-state · party:rtc-signal · party:hold · party:resume
//   party:buffering-status
//
// Voice transport: WebRTC mesh. Each voice member peers with every other voice
// member; the server only relays opaque SDP/ICE via party:rtc-signal. Glare rule
// (clients): the peer with the lexicographically smaller socketId is the offerer.

interface SocketCtx {
  roomCode?: string;
  name: string;
  avatar: string;
  userId?: string;
  lastChatAt: number;
}

const contexts = new Map<string, SocketCtx>();

function sanitizeProfile(profile: any, token?: string) {
  const authedUser = resolveUserFromToken(token);
  const name = (authedUser?.name || profile?.name || 'Guest').toString().trim().slice(0, 40) || 'Guest';
  const avatar = (authedUser?.avatar || profile?.avatar || '').toString().slice(0, 600);
  return { name, avatar, userId: authedUser?.id };
}

function sanitizeMedia(media: any) {
  if (!media || typeof media.id !== 'string' || typeof media.type !== 'string') return null;
  const category = media.category === 'sub' || media.category === 'dub' ? media.category : undefined;
  return {
    type: media.type.slice(0, 10),
    id: media.id.slice(0, 40),
    title: (media.title || 'Untitled').toString().slice(0, 200),
    posterUrl: typeof media.posterUrl === 'string' ? media.posterUrl.slice(0, 600) : undefined,
    bannerUrl: typeof media.bannerUrl === 'string' ? media.bannerUrl.slice(0, 600) : undefined,
    season: media.season != null ? Number(media.season) : undefined,
    episode: media.episode != null ? Number(media.episode) : undefined,
    sourceIdx: Number(media.sourceIdx) || 0,
    category,
  };
}

export default function setupSockets(io: Server) {
  // Room garbage collection
  setInterval(() => sweepEmptyRooms(), 60 * 1000).unref();

  const broadcastState = (room: PartyRoom) => {
    io.to(room.code).emit('party:state', serializeRoom(room));
  };

  const broadcastMembers = (room: PartyRoom) => {
    io.to(room.code).emit('party:members', serializeRoom(room).members);
  };

  const broadcastVoiceState = (room: PartyRoom) => {
    io.to(room.code).emit(
      'party:voice-state',
      Array.from(room.members.values()).map((m) => ({
        socketId: m.socketId,
        inVoice: m.inVoice,
        micOn: m.micOn,
        deafened: m.deafened,
      }))
    );
  };

  const systemMessage = (room: PartyRoom, text: string) => {
    const msg = addChatMessage(room, { kind: 'system', authorName: 'PureVerse', text });
    io.to(room.code).emit('party:chat', msg);
  };

  // ─── Buffer-aware auto-wait coordinator ───────────────────
  // Called whenever a member's buffering / position changes. Pauses the whole
  // party while anyone is stalled (when autoWait is on) and auto-resumes once
  // everyone has caught up. When autoWait is off it only reports who's behind.
  const reconcileHold = (room: PartyRoom, blamedName?: string) => {
    if (!room.autoWait) {
      io.to(room.code).emit('party:buffering-status', {
        holding: false,
        autoWait: false,
        members: bufferingStatus(room),
      });
      return;
    }

    if (!room.holding) {
      // Only meaningful to hold while the party intends to be playing.
      if (room.playback.isPlaying && anyoneStalled(room)) {
        room.holding = true;
        // Freeze the virtual clock at the current live position.
        room.playback = {
          isPlaying: false,
          positionSec: currentPosition(room),
          updatedAt: Date.now(),
        };
        io.to(room.code).emit('party:hold', {
          byName: blamedName,
          positionSec: room.playback.positionSec,
        });
      }
    } else if (everyoneReady(room)) {
      room.holding = false;
      room.playback = {
        isPlaying: true,
        positionSec: room.playback.positionSec,
        updatedAt: Date.now(),
      };
      io.to(room.code).emit('party:resume', { positionSec: room.playback.positionSec });
    }

    io.to(room.code).emit('party:buffering-status', {
      holding: room.holding,
      autoWait: true,
      members: bufferingStatus(room),
    });
  };

  io.on('connection', (socket: Socket) => {
    contexts.set(socket.id, { name: 'Guest', avatar: '', lastChatAt: 0 });

    const ctx = () => contexts.get(socket.id)!;

    const currentRoom = (): PartyRoom | undefined => {
      const code = ctx().roomCode;
      return code ? getRoom(code) : undefined;
    };

    const isHost = (room: PartyRoom) => room.hostSocketId === socket.id;

    const leaveRoom = (silent = false) => {
      const room = currentRoom();
      const c = ctx();
      c.roomCode = undefined;
      if (!room) return;

      const member = room.members.get(socket.id);
      room.members.delete(socket.id);
      socket.leave(room.code);

      if (!member) return;

      if (room.members.size === 0) {
        // Keep the room alive briefly (sweep deletes it later) so a host
        // refresh doesn't kill the party.
        room.emptySince = Date.now();
        return;
      }

      // Host left → promote the longest-standing member
      if (member.isHost) {
        const next = Array.from(room.members.values()).sort((a, b) => a.joinedAt - b.joinedAt)[0];
        next.isHost = true;
        room.hostSocketId = next.socketId;
        if (!silent) systemMessage(room, `${member.name} left — ${next.name} is now the host`);
      } else if (!silent) {
        systemMessage(room, `${member.name} left the party`);
      }
      broadcastMembers(room);
      broadcastVoiceState(room);
      io.to(room.code).emit('party:settings', { hostSocketId: room.hostSocketId, allowGuestControl: room.allowGuestControl, isPublic: room.isPublic, name: room.name });
      // The departing member may have been the one we were waiting for.
      reconcileHold(room);
    };

    // ─── Create ───────────────────────────────────────────
    socket.on('party:create', (payload: any, ack?: (res: any) => void) => {
      try {
        leaveRoom(true);
        const media = sanitizeMedia(payload?.media);
        if (!media) {
          ack?.({ success: false, message: 'Invalid media' });
          return;
        }
        const profile = sanitizeProfile(payload?.profile, payload?.token);
        const room = createRoom({
          name: (payload?.name || `${profile.name}'s party`).toString(),
          password: typeof payload?.password === 'string' && payload.password ? payload.password.slice(0, 60) : undefined,
          isPublic: !!payload?.isPublic,
          allowGuestControl: !!payload?.allowGuestControl,
          autoWait: payload?.autoWait !== false, // default on
          media,
          host: { socketId: socket.id, ...profile },
        });
        const c = ctx();
        c.roomCode = room.code;
        c.name = profile.name;
        c.avatar = profile.avatar;
        c.userId = profile.userId;
        socket.join(room.code);
        systemMessage(room, `${profile.name} started the party`);
        ack?.({ success: true, room: serializeRoom(room), selfId: socket.id });
      } catch (err: any) {
        console.error('[Party] create failed:', err?.message);
        ack?.({ success: false, message: 'Could not create room' });
      }
    });

    // ─── Join ─────────────────────────────────────────────
    socket.on('party:join', (payload: any, ack?: (res: any) => void) => {
      try {
        const room = getRoom(payload?.code);
        if (!room) {
          ack?.({ success: false, message: 'Room not found' });
          return;
        }
        if (room.passwordHash) {
          const pw = typeof payload?.password === 'string' ? payload.password : '';
          if (hashPassword(pw) !== room.passwordHash) {
            ack?.({ success: false, message: 'Wrong password', needsPassword: true });
            return;
          }
        }
        const profile = sanitizeProfile(payload?.profile, payload?.token);
        const banKey = profile.userId || `name:${profile.name.toLowerCase()}`;
        if (room.bannedKeys.has(banKey)) {
          ack?.({ success: false, message: 'You were removed from this room' });
          return;
        }
        if (room.members.size >= 50) {
          ack?.({ success: false, message: 'Room is full' });
          return;
        }

        leaveRoom(true);
        room.emptySince = null;
        const isFirst = room.members.size === 0;
        room.members.set(
          socket.id,
          newMember({
            socketId: socket.id,
            userId: profile.userId,
            name: profile.name,
            avatar: profile.avatar,
            isHost: isFirst, // joining an empty (grace-period) room makes you host
          })
        );
        if (isFirst) room.hostSocketId = socket.id;

        const c = ctx();
        c.roomCode = room.code;
        c.name = profile.name;
        c.avatar = profile.avatar;
        c.userId = profile.userId;
        socket.join(room.code);

        systemMessage(room, `${profile.name} joined the party`);
        broadcastMembers(room);
        ack?.({ success: true, room: serializeRoom(room), selfId: socket.id });
      } catch (err: any) {
        console.error('[Party] join failed:', err?.message);
        ack?.({ success: false, message: 'Could not join room' });
      }
    });

    // ─── Leave ────────────────────────────────────────────
    socket.on('party:leave', () => leaveRoom());

    // ─── Chat ─────────────────────────────────────────────
    socket.on('party:chat', (payload: any) => {
      const room = currentRoom();
      if (!room) return;
      const member = room.members.get(socket.id);
      if (!member) return;
      if (member.mutedUntil > Date.now()) {
        socket.emit('party:chat', {
          id: `local-${Date.now()}`,
          kind: 'system',
          authorName: 'PureVerse',
          text: member.mutedUntil > Date.now() + 365 * 86400000
            ? 'You are muted in this room.'
            : `You are timed out for ${Math.ceil((member.mutedUntil - Date.now()) / 1000)}s.`,
          createdAt: Date.now(),
        });
        return;
      }
      const c = ctx();
      const now = Date.now();
      if (now - c.lastChatAt < 500) return; // rate limit
      c.lastChatAt = now;

      const text = (payload?.text || '').toString().trim().slice(0, 500);
      if (!text) return;

      const msg = addChatMessage(room, {
        kind: 'chat',
        authorSocketId: socket.id,
        authorName: member.name,
        authorAvatar: member.avatar,
        authorIsHost: member.isHost,
        text,
      });
      io.to(room.code).emit('party:chat', msg);
    });

    // ─── Playback (play / pause / seek / resync) ──────────
    socket.on('party:playback', (payload: any) => {
      const room = currentRoom();
      if (!room) return;
      const member = room.members.get(socket.id);
      if (!member) return;
      const allowed = isHost(room) || room.allowGuestControl;
      if (!allowed) return;

      const action = payload?.action;
      const now = Date.now();

      // An explicit transport action (incl. the host's "Skip wait") overrides an
      // in-progress auto-wait hold.
      room.holding = false;

      if (action === 'play') {
        room.playback = { isPlaying: true, positionSec: currentPosition(room), updatedAt: now };
      } else if (action === 'pause') {
        room.playback = { isPlaying: false, positionSec: currentPosition(room), updatedAt: now };
      } else if (action === 'seek') {
        const pos = Math.max(0, Number(payload?.positionSec) || 0);
        room.playback = { isPlaying: room.playback.isPlaying, positionSec: pos, updatedAt: now };
      } else if (action === 'resync') {
        // host re-broadcast for stragglers — state unchanged
      } else {
        return;
      }

      io.to(room.code).emit('party:playback', {
        action,
        isPlaying: room.playback.isPlaying,
        positionSec: currentPosition(room),
        byName: member.name,
        bySocketId: socket.id,
        at: now,
      });
    });

    // Host heartbeat with real player position (when the embed reports it).
    // Ignored while holding so a stray heartbeat can't unfreeze the clock the
    // auto-wait coordinator pinned at the hold point.
    socket.on('party:position', (payload: any) => {
      const room = currentRoom();
      if (!room || !isHost(room) || room.holding) return;
      const pos = Number(payload?.positionSec);
      if (!isFinite(pos) || pos < 0) return;
      room.playback.positionSec = pos;
      room.playback.updatedAt = Date.now();
      if (payload?.isPlaying != null) room.playback.isPlaying = !!payload.isPlaying;
    });

    // ─── Media (episode / server switch) — host only ──────
    socket.on('party:media', (payload: any) => {
      const room = currentRoom();
      if (!room || !isHost(room)) return;
      const member = room.members.get(socket.id);

      let changed = false;
      if (payload?.season != null && isFinite(Number(payload.season))) {
        room.media.season = Number(payload.season);
        changed = true;
      }
      if (payload?.episode != null && isFinite(Number(payload.episode))) {
        room.media.episode = Number(payload.episode);
        changed = true;
      }
      if (payload?.sourceIdx != null && isFinite(Number(payload.sourceIdx))) {
        room.media.sourceIdx = Math.max(0, Number(payload.sourceIdx));
        changed = true;
      }
      if (payload?.category === 'sub' || payload?.category === 'dub') {
        room.media.category = payload.category;
        changed = true;
      }
      if (!changed) return;

      room.playback = { isPlaying: false, positionSec: 0, updatedAt: Date.now() };
      // Fresh source → clear stale buffering/hold so it doesn't re-trigger a wait.
      room.holding = false;
      for (const m of room.members.values()) {
        m.buffering = false;
        m.reportedPos = 0;
        m.posAt = 0;
      }
      io.to(room.code).emit('party:media', { media: room.media, byName: member?.name });
      if (payload?.episode != null) {
        systemMessage(
          room,
          `${member?.name} switched to ${room.media.season != null ? `S${room.media.season} ` : ''}E${room.media.episode}`
        );
      } else if (payload?.sourceIdx != null) {
        systemMessage(room, `${member?.name} switched server`);
      }
    });

    // ─── Settings — host only ─────────────────────────────
    socket.on('party:settings', (payload: any) => {
      const room = currentRoom();
      if (!room || !isHost(room)) return;

      if (typeof payload?.name === 'string' && payload.name.trim()) {
        room.name = payload.name.trim().slice(0, 60);
      }
      if (payload?.isPublic != null) room.isPublic = !!payload.isPublic;
      if (payload?.allowGuestControl != null) {
        room.allowGuestControl = !!payload.allowGuestControl;
        systemMessage(
          room,
          room.allowGuestControl
            ? 'Host enabled playback controls for everyone'
            : 'Host restricted playback controls to host only'
        );
      }
      if (payload?.autoWait != null) {
        room.autoWait = !!payload.autoWait;
        systemMessage(
          room,
          room.autoWait
            ? 'Host enabled auto-wait — the party pauses for anyone who buffers'
            : 'Host disabled auto-wait'
        );
        // If turning autoWait off while held, release the party.
        if (!room.autoWait && room.holding) {
          room.holding = false;
          room.playback = { isPlaying: true, positionSec: currentPosition(room), updatedAt: Date.now() };
          io.to(room.code).emit('party:resume', { positionSec: room.playback.positionSec });
        }
      }
      if (payload?.password !== undefined) {
        room.passwordHash =
          typeof payload.password === 'string' && payload.password
            ? hashPassword(payload.password.slice(0, 60))
            : undefined;
      }

      io.to(room.code).emit('party:settings', {
        name: room.name,
        isPublic: room.isPublic,
        allowGuestControl: room.allowGuestControl,
        autoWait: room.autoWait,
        hasPassword: !!room.passwordHash,
        hostSocketId: room.hostSocketId,
      });
    });

    // ─── Moderation — host only ───────────────────────────
    socket.on('party:mod', (payload: any) => {
      const room = currentRoom();
      if (!room || !isHost(room)) return;
      const target = room.members.get(payload?.targetSocketId);
      if (!target || target.socketId === socket.id) return;

      const action = payload?.action;
      if (action === 'mute') {
        target.mutedUntil = Date.now() + 1000 * 60 * 60 * 24 * 365 * 10; // permanent
        systemMessage(room, `${target.name} was muted by the host`);
      } else if (action === 'timeout') {
        const dur = Math.min(3600, Math.max(10, Number(payload?.durationSec) || 300));
        target.mutedUntil = Date.now() + dur * 1000;
        systemMessage(room, `${target.name} was timed out for ${dur >= 60 ? `${Math.round(dur / 60)}m` : `${dur}s`}`);
      } else if (action === 'unmute') {
        target.mutedUntil = 0;
        systemMessage(room, `${target.name} was unmuted`);
      } else if (action === 'kick') {
        room.bannedKeys.add(memberBanKey(target));
        room.members.delete(target.socketId);
        io.to(target.socketId).emit('party:kicked', { roomCode: room.code });
        io.sockets.sockets.get(target.socketId)?.leave(room.code);
        const targetCtx = contexts.get(target.socketId);
        if (targetCtx) targetCtx.roomCode = undefined;
        systemMessage(room, `${target.name} was removed from the party`);
      } else {
        return;
      }
      broadcastMembers(room);
    });

    // ─── Voice presence (mic / deafen / join-leave channel) ──
    socket.on('party:voice', (payload: any, ack?: (res: any) => void) => {
      const room = currentRoom();
      if (!room) return;
      const member = room.members.get(socket.id);
      if (!member) return;

      // Joining the voice mesh is capped — beyond VOICE_CAP, refuse.
      if (payload?.inVoice === true && !member.inVoice && voiceMemberCount(room) >= VOICE_CAP) {
        ack?.({ success: false, message: `Voice is full (${VOICE_CAP} max)` });
        return;
      }

      if (payload?.inVoice != null) {
        member.inVoice = !!payload.inVoice;
        if (!member.inVoice) {
          member.micOn = false;
          member.deafened = false;
        }
      }
      if (payload?.micOn != null) member.micOn = member.inVoice && !!payload.micOn;
      if (payload?.deafened != null) member.deafened = member.inVoice && !!payload.deafened;

      ack?.({ success: true });
      broadcastVoiceState(room);
    });

    // ─── WebRTC mesh signaling relay (opaque SDP / ICE) ──────
    socket.on('party:rtc-signal', (payload: any) => {
      const room = currentRoom();
      if (!room) return;
      const to = payload?.to;
      if (typeof to !== 'string' || !room.members.has(to)) return; // same-room only
      io.to(to).emit('party:rtc-signal', { from: socket.id, data: payload?.data });
    });

    // ─── Per-member buffering / position report ──────────────
    socket.on('party:buffering', (payload: any) => {
      const room = currentRoom();
      if (!room) return;
      const member = room.members.get(socket.id);
      if (!member) return;
      const pos = Number(payload?.positionSec);
      member.buffering = !!payload?.buffering;
      if (isFinite(pos) && pos >= 0) {
        member.reportedPos = pos;
        member.posAt = Date.now();
      }
      reconcileHold(room, member.buffering ? member.name : undefined);
    });

    // ─── Full-state sync request ──────────────────────────
    socket.on('party:sync', () => {
      const room = currentRoom();
      if (!room) return;
      socket.emit('party:state', serializeRoom(room));
    });

    // ─── Disconnect ───────────────────────────────────────
    socket.on('disconnect', () => {
      leaveRoom();
      contexts.delete(socket.id);
    });
  });
}
