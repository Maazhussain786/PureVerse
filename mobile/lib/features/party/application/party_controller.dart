import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:socket_io_client/socket_io_client.dart' as io;

import '../../../core/constants/avatars.dart';
import '../../auth/auth_controller.dart';
import '../../../shared/providers/api_providers.dart';
import '../data/party_models.dart';
import '../data/party_socket.dart';

enum PartyPhase { idle, connecting, gate, inRoom, kicked, notFound }

/// A transport command applied to the synced player. [epoch] strictly increases
/// so the player can ignore commands it has already applied.
@immutable
class SyncCommand {
  final int epoch;
  final String action; // play | pause | seek | resync | hold | resume
  final bool isPlaying;
  final double positionSec;
  final String? byName;
  const SyncCommand({
    required this.epoch,
    required this.action,
    required this.isPlaying,
    required this.positionSec,
    this.byName,
  });
}

/// One member the host should know is holding the party up.
@immutable
class BufferingPeer {
  final String socketId;
  final String name;
  final bool buffering;
  final double secondsBehind;
  const BufferingPeer(this.socketId, this.name, this.buffering, this.secondsBehind);
}

@immutable
class PartyState {
  final PartyPhase phase;
  final PartyRoom? room;
  final String selfId;
  final bool connected;
  final String? gateError;
  final Map<String, dynamic>? meta; // join-gate metadata (title/poster/count)
  final SyncCommand? command;
  final bool holding;
  final List<BufferingPeer> buffering;

  const PartyState({
    this.phase = PartyPhase.idle,
    this.room,
    this.selfId = '',
    this.connected = true,
    this.gateError,
    this.meta,
    this.command,
    this.holding = false,
    this.buffering = const [],
  });

  bool get isHost => room != null && room!.hostSocketId == selfId;
  bool get canControl => isHost || (room?.allowGuestControl ?? false);
  PartyMember? get self => room?.memberById(selfId);

  PartyState copyWith({
    PartyPhase? phase,
    PartyRoom? room,
    String? selfId,
    bool? connected,
    String? gateError,
    bool clearGateError = false,
    Map<String, dynamic>? meta,
    SyncCommand? command,
    bool? holding,
    List<BufferingPeer>? buffering,
  }) =>
      PartyState(
        phase: phase ?? this.phase,
        room: room ?? this.room,
        selfId: selfId ?? this.selfId,
        connected: connected ?? this.connected,
        gateError: clearGateError ? null : (gateError ?? this.gateError),
        meta: meta ?? this.meta,
        command: command ?? this.command,
        holding: holding ?? this.holding,
        buffering: buffering ?? this.buffering,
      );
}

class PartyController extends StateNotifier<PartyState> {
  PartyController(this.ref) : super(const PartyState()) {
    _socket = partySocket();
    _attach();
  }

  final Ref ref;
  late final io.Socket _socket;
  int _epoch = 0;
  Timer? _gateTimer;
  Map<String, dynamic>? _lastJoin; // for transparent rejoin on reconnect

  // ─── Socket wiring ──────────────────────────────────────
  void _attach() {
    _socket
      ..on('party:state', _onState)
      ..on('party:members', _onMembers)
      ..on('party:chat', _onChat)
      ..on('party:playback', _onPlayback)
      ..on('party:media', _onMedia)
      ..on('party:settings', _onSettings)
      ..on('party:voice-state', _onVoiceState)
      ..on('party:hold', _onHold)
      ..on('party:resume', _onResume)
      ..on('party:buffering-status', _onBufferingStatus)
      ..on('party:kicked', _onKicked)
      ..onConnect(_onConnect)
      ..onDisconnect(_onDisconnect);
  }

  void _detach() {
    _socket
      ..off('party:state', _onState)
      ..off('party:members', _onMembers)
      ..off('party:chat', _onChat)
      ..off('party:playback', _onPlayback)
      ..off('party:media', _onMedia)
      ..off('party:settings', _onSettings)
      ..off('party:voice-state', _onVoiceState)
      ..off('party:hold', _onHold)
      ..off('party:resume', _onResume)
      ..off('party:buffering-status', _onBufferingStatus)
      ..off('party:kicked', _onKicked)
      ..offAny();
  }

  Map<String, dynamic> _asMap(dynamic v) =>
      (v is Map) ? v.cast<String, dynamic>() : const {};

  void _onState(dynamic raw) {
    final room = PartyRoom.fromJson(_asMap(raw));
    if (room.code.isEmpty) return;
    _gateTimer?.cancel();
    state = state.copyWith(
      room: room,
      selfId: _socket.id ?? state.selfId,
      phase: PartyPhase.inRoom,
      holding: room.holding,
      clearGateError: true,
    );
  }

  void _onMembers(dynamic raw) {
    final room = state.room;
    if (room == null || raw is! List) return;
    final members = raw
        .whereType<Map>()
        .map((m) => PartyMember.fromJson(m.cast<String, dynamic>()))
        .toList();
    state = state.copyWith(room: room.copyWith(members: members));
  }

  void _onChat(dynamic raw) {
    final room = state.room;
    if (room == null) return;
    final msg = PartyChatMessage.fromJson(_asMap(raw));
    final chat = [...room.chat, msg];
    if (chat.length > 200) chat.removeRange(0, chat.length - 200);
    state = state.copyWith(room: room.copyWith(chat: chat));
  }

  void _onPlayback(dynamic raw) {
    final room = state.room;
    if (room == null) return;
    final p = _asMap(raw);
    final isPlaying = p['isPlaying'] == true;
    final pos = (p['positionSec'] is num) ? (p['positionSec'] as num).toDouble() : 0.0;
    final action = (p['action'] ?? 'seek').toString();
    state = state.copyWith(
      room: room.copyWith(
        playback: PartyPlayback(
          isPlaying: isPlaying,
          positionSec: pos,
          updatedAt: DateTime.now().millisecondsSinceEpoch,
        ),
        holding: false,
      ),
      holding: false,
      command: SyncCommand(
        epoch: ++_epoch,
        action: action,
        isPlaying: isPlaying,
        positionSec: pos,
        byName: p['byName']?.toString(),
      ),
    );
  }

  void _onMedia(dynamic raw) {
    final room = state.room;
    if (room == null) return;
    final p = _asMap(raw);
    final media = PartyMedia.fromJson(_asMap(p['media']));
    state = state.copyWith(
      room: room.copyWith(
        media: media,
        playback: const PartyPlayback(isPlaying: false, positionSec: 0),
      ),
    );
  }

  void _onSettings(dynamic raw) {
    final room = state.room;
    if (room == null) return;
    final p = _asMap(raw);
    state = state.copyWith(
      room: room.copyWith(
        name: p['name']?.toString(),
        isPublic: p['isPublic'] is bool ? p['isPublic'] as bool : null,
        allowGuestControl:
            p['allowGuestControl'] is bool ? p['allowGuestControl'] as bool : null,
        autoWait: p['autoWait'] is bool ? p['autoWait'] as bool : null,
        hasPassword: p['hasPassword'] is bool ? p['hasPassword'] as bool : null,
        hostSocketId: p['hostSocketId']?.toString(),
      ),
    );
  }

  // Merge live voice flags into the member list so badges stay current.
  void _onVoiceState(dynamic raw) {
    final room = state.room;
    if (room == null || raw is! List) return;
    final byId = {
      for (final e in raw.whereType<Map>())
        e['socketId'].toString(): e.cast<String, dynamic>()
    };
    final members = room.members
        .map((m) => byId.containsKey(m.socketId)
            ? m.copyWith(
                inVoice: byId[m.socketId]!['inVoice'] == true,
                micOn: byId[m.socketId]!['micOn'] == true,
                deafened: byId[m.socketId]!['deafened'] == true,
              )
            : m)
        .toList();
    state = state.copyWith(room: room.copyWith(members: members));
  }

  void _onHold(dynamic raw) {
    final room = state.room;
    if (room == null) return;
    final p = _asMap(raw);
    final pos = (p['positionSec'] is num) ? (p['positionSec'] as num).toDouble() : null;
    state = state.copyWith(
      holding: true,
      room: room.copyWith(
        playback: PartyPlayback(
          isPlaying: false,
          positionSec: pos ?? room.playback.livePosition,
          updatedAt: DateTime.now().millisecondsSinceEpoch,
        ),
      ),
      command: SyncCommand(
        epoch: ++_epoch,
        action: 'hold',
        isPlaying: false,
        positionSec: pos ?? room.playback.livePosition,
        byName: p['byName']?.toString(),
      ),
    );
  }

  void _onResume(dynamic raw) {
    final room = state.room;
    if (room == null) return;
    final p = _asMap(raw);
    final pos = (p['positionSec'] is num) ? (p['positionSec'] as num).toDouble() : room.playback.positionSec;
    state = state.copyWith(
      holding: false,
      room: room.copyWith(
        playback: PartyPlayback(
          isPlaying: true,
          positionSec: pos,
          updatedAt: DateTime.now().millisecondsSinceEpoch,
        ),
      ),
      command: SyncCommand(
        epoch: ++_epoch,
        action: 'resume',
        isPlaying: true,
        positionSec: pos,
      ),
    );
  }

  void _onBufferingStatus(dynamic raw) {
    final p = _asMap(raw);
    final list = (p['members'] as List?) ?? const [];
    state = state.copyWith(
      holding: p['holding'] == true,
      buffering: list
          .whereType<Map>()
          .map((m) => BufferingPeer(
                m['socketId'].toString(),
                (m['name'] ?? '').toString(),
                m['buffering'] == true,
                (m['secondsBehind'] is num) ? (m['secondsBehind'] as num).toDouble() : 0,
              ))
          .toList(),
    );
  }

  void _onKicked(dynamic raw) {
    final code = _asMap(raw)['roomCode']?.toString();
    if (code != null && code == state.room?.code) {
      state = state.copyWith(phase: PartyPhase.kicked);
    }
  }

  void _onConnect(dynamic _) {
    state = state.copyWith(connected: true, selfId: _socket.id ?? state.selfId);
    // Socket ids change across reconnects — rejoin transparently.
    if (state.phase == PartyPhase.inRoom && _lastJoin != null) {
      _socket.emitWithAck('party:join', _lastJoin, ack: (dynamic res) {
        final r = _asMap(res);
        if (r['success'] == true) {
          state = state.copyWith(
            room: PartyRoom.fromJson(_asMap(r['room'])),
            selfId: (r['selfId'] ?? _socket.id ?? '').toString(),
          );
        }
      });
    }
  }

  void _onDisconnect(dynamic _) => state = state.copyWith(connected: false);

  // ─── Profile / token helpers ────────────────────────────
  Future<String?> _token() => ref.read(tokenStoreProvider).read();

  Map<String, dynamic> _profile({String? guestName}) {
    final user = ref.read(authControllerProvider).user;
    final name = (user?.name.isNotEmpty == true)
        ? user!.name
        : ((guestName?.trim().isNotEmpty == true) ? guestName!.trim() : 'Guest');
    final avatar = (user?.avatar.isNotEmpty == true) ? user!.avatar : defaultAvatar(name);
    return {'name': name, 'avatar': avatar};
  }

  // ─── Public actions ─────────────────────────────────────
  /// Create a room. Returns the room code on success, or null with [state.gateError] set.
  Future<String?> create({
    required PartyMedia media,
    required String name,
    required bool isPublic,
    String? password,
    required bool allowGuestControl,
    bool autoWait = true,
  }) async {
    final token = await _token();
    final payload = {
      'name': name,
      'isPublic': isPublic,
      if (password != null && password.isNotEmpty) 'password': password,
      'allowGuestControl': allowGuestControl,
      'autoWait': autoWait,
      'media': media.toJson(),
      'profile': _profile(),
      'token': ?token,
    };
    final completer = Completer<String?>();
    _socket.emitWithAck('party:create', payload, ack: (dynamic res) {
      final r = _asMap(res);
      if (r['success'] == true) {
        final room = PartyRoom.fromJson(_asMap(r['room']));
        _lastJoin = {
          'code': room.code,
          'profile': _profile(),
          'token': ?token,
        };
        state = state.copyWith(
            room: room, selfId: (r['selfId'] ?? _socket.id ?? '').toString(), phase: PartyPhase.inRoom);
        completer.complete(room.code);
      } else {
        state = state.copyWith(gateError: (r['message'] ?? 'Could not create room').toString());
        completer.complete(null);
      }
    });
    return completer.future
        .timeout(const Duration(seconds: 8), onTimeout: () => null);
  }

  /// Open a room screen for [code]. The creator is already in (party:sync
  /// answers); a joiner sees the gate once metadata arrives.
  void enterRoom(String code) {
    final upper = code.toUpperCase();
    if (state.room?.code == upper && state.phase == PartyPhase.inRoom) {
      _socket.emit('party:sync');
      return;
    }
    state = state.copyWith(phase: PartyPhase.connecting, clearGateError: true);
    _socket.emit('party:sync');
    _gateTimer?.cancel();
    _gateTimer = Timer(const Duration(milliseconds: 700), () async {
      if (state.phase != PartyPhase.connecting) return;
      final meta = await ref.read(apiClientProvider).getPartyRoomMeta(upper);
      if (state.phase != PartyPhase.connecting) return;
      if (meta != null) {
        state = state.copyWith(phase: PartyPhase.gate, meta: meta);
      } else {
        state = state.copyWith(phase: PartyPhase.notFound);
      }
    });
  }

  Future<bool> join({required String code, String? password, String? guestName}) async {
    final token = await _token();
    final payload = {
      'code': code.toUpperCase(),
      if (password != null && password.isNotEmpty) 'password': password,
      'profile': _profile(guestName: guestName),
      'token': ?token,
    };
    _lastJoin = payload;
    final completer = Completer<bool>();
    _socket.emitWithAck('party:join', payload, ack: (dynamic res) {
      final r = _asMap(res);
      if (r['success'] == true) {
        state = state.copyWith(
          room: PartyRoom.fromJson(_asMap(r['room'])),
          selfId: (r['selfId'] ?? _socket.id ?? '').toString(),
          phase: PartyPhase.inRoom,
          clearGateError: true,
        );
        completer.complete(true);
      } else {
        state = state.copyWith(gateError: (r['message'] ?? 'Could not join').toString());
        completer.complete(false);
      }
    });
    return completer.future
        .timeout(const Duration(seconds: 8), onTimeout: () => false);
  }

  void leave() {
    _gateTimer?.cancel();
    _socket.emit('party:leave');
    _lastJoin = null;
    state = const PartyState();
  }

  void sendChat(String text) {
    final t = text.trim();
    if (t.isEmpty) return;
    _socket.emit('party:chat', {'text': t});
  }

  void emitPlayback(String action, {double? positionSec}) {
    _socket.emit('party:playback', {
      'action': action,
      'positionSec': ?positionSec,
    });
  }

  void emitMedia({int? season, int? episode, int? sourceIdx, String? category}) {
    _socket.emit('party:media', {
      'season': ?season,
      'episode': ?episode,
      'sourceIdx': ?sourceIdx,
      'category': ?category,
    });
  }

  void emitSettings(Map<String, dynamic> payload) =>
      _socket.emit('party:settings', payload);

  void emitMod(String action, String targetSocketId, {int durationSec = 300}) {
    _socket.emit('party:mod', {
      'action': action,
      'targetSocketId': targetSocketId,
      'durationSec': durationSec,
    });
  }

  /// Host heartbeat: the controlling player forwards its true position.
  void emitPosition(double positionSec, bool isPlaying) {
    _socket.emit('party:position', {'positionSec': positionSec, 'isPlaying': isPlaying});
  }

  /// Per-member buffering / position report driving the auto-wait coordinator.
  void reportBuffering(bool buffering, double positionSec) {
    _socket.emit('party:buffering', {'buffering': buffering, 'positionSec': positionSec});
  }

  Future<void> invite(String to) async {
    final code = state.room?.code;
    if (code == null) return;
    await ref.read(apiClientProvider).invitePartyUser(to, code);
  }

  @override
  void dispose() {
    _gateTimer?.cancel();
    _detach();
    super.dispose();
  }
}

/// Kept alive across the lobby → room navigation (one socket, one room at a
/// time). Resets to idle on leave().
final partyControllerProvider =
    StateNotifierProvider<PartyController, PartyState>((ref) => PartyController(ref));
