import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_webrtc/flutter_webrtc.dart';
import 'package:permission_handler/permission_handler.dart';
import 'package:socket_io_client/socket_io_client.dart' as io;

import '../data/party_socket.dart';

/// Local voice state surfaced to the UI (the authoritative per-member flags for
/// *everyone* live in the room member list — this is just our own intent + the
/// live peer count of the mesh).
@immutable
class VoiceUiState {
  final bool inVoice;
  final bool micOn;
  final bool deafened;
  final bool connecting;
  final int peerCount;
  final String? error;

  const VoiceUiState({
    this.inVoice = false,
    this.micOn = false,
    this.deafened = false,
    this.connecting = false,
    this.peerCount = 0,
    this.error,
  });

  VoiceUiState copyWith({
    bool? inVoice,
    bool? micOn,
    bool? deafened,
    bool? connecting,
    int? peerCount,
    String? error,
    bool clearError = false,
  }) =>
      VoiceUiState(
        inVoice: inVoice ?? this.inVoice,
        micOn: micOn ?? this.micOn,
        deafened: deafened ?? this.deafened,
        connecting: connecting ?? this.connecting,
        peerCount: peerCount ?? this.peerCount,
        error: clearError ? null : (error ?? this.error),
      );
}

class _Peer {
  final RTCPeerConnection pc;
  final List<RTCIceCandidate> pendingIce = [];
  MediaStream? remoteStream;
  bool remoteDescSet = false;
  _Peer(this.pc);
}

/// WebRTC **mesh** voice for a watch party. Each voice member peers directly
/// with every other voice member; the backend only relays opaque SDP/ICE over
/// `party:rtc-signal`. Audio-only — remote audio auto-plays through the device,
/// so "deafen" just disables every remote track while the video keeps playing.
///
/// Glare rule (matches the web client): the peer with the lexicographically
/// smaller socketId is the offerer.
class VoiceController extends StateNotifier<VoiceUiState> {
  VoiceController() : super(const VoiceUiState()) {
    _socket = partySocket();
    _socket.on('party:voice-state', _onVoiceState);
    _socket.on('party:rtc-signal', _onSignal);
  }

  late final io.Socket _socket;
  MediaStream? _localStream;
  final Map<String, _Peer> _peers = {};
  List<Map<String, dynamic>> _lastVoiceState = const [];

  static const Map<String, dynamic> _rtcConfig = {
    'iceServers': [
      {'urls': 'stun:stun.l.google.com:19302'},
      {'urls': 'stun:stun1.l.google.com:19302'},
    ],
    'sdpSemantics': 'unified-plan',
  };

  String get _selfId => _socket.id ?? '';

  // ─── Public controls ────────────────────────────────────
  Future<void> joinVoice() async {
    if (state.inVoice || state.connecting) return;
    state = state.copyWith(connecting: true, clearError: true);

    final status = await Permission.microphone.request();
    if (!status.isGranted) {
      state = state.copyWith(connecting: false, error: 'Microphone permission denied');
      return;
    }

    try {
      _localStream ??= await navigator.mediaDevices
          .getUserMedia({'audio': true, 'video': false});
    } catch (e) {
      state = state.copyWith(connecting: false, error: 'Could not open microphone');
      return;
    }

    // Tell the server we're joining; it may refuse if voice is full.
    final res = await _emitVoiceAck({'inVoice': true, 'micOn': true, 'deafened': false});
    if (res['success'] != true) {
      await _stopLocal();
      state = state.copyWith(
          connecting: false, error: (res['message'] ?? 'Voice is full').toString());
      return;
    }

    state = state.copyWith(inVoice: true, micOn: true, deafened: false, connecting: false);
    _reconcilePeers(); // connect to everyone already in voice
  }

  Future<void> leaveVoice() async {
    if (!state.inVoice) return;
    _socket.emit('party:voice', {'inVoice': false});
    for (final id in _peers.keys.toList()) {
      _closePeer(id);
    }
    await _stopLocal();
    state = const VoiceUiState();
  }

  void toggleMic() {
    if (!state.inVoice) return;
    final next = !state.micOn;
    for (final t in _localStream?.getAudioTracks() ?? const <MediaStreamTrack>[]) {
      t.enabled = next;
    }
    state = state.copyWith(micOn: next);
    _socket.emit('party:voice', {'micOn': next});
  }

  void toggleDeafen() {
    if (!state.inVoice) return;
    final next = !state.deafened;
    _applyDeafen(next);
    state = state.copyWith(deafened: next);
    _socket.emit('party:voice', {'deafened': next});
  }

  // ─── Signaling: who is in voice ─────────────────────────
  void _onVoiceState(dynamic raw) {
    if (raw is! List) return;
    _lastVoiceState = raw
        .whereType<Map>()
        .map((e) => e.cast<String, dynamic>())
        .toList();
    if (state.inVoice) _reconcilePeers();
  }

  /// Open connections to voice peers we should offer to, and tear down peers
  /// that left voice. Offerer = the smaller socketId.
  void _reconcilePeers() {
    final inVoiceIds = <String>{
      for (final m in _lastVoiceState)
        if (m['inVoice'] == true && m['socketId'] != _selfId)
          m['socketId'].toString(),
    };

    // Drop peers no longer in voice.
    for (final id in _peers.keys.toList()) {
      if (!inVoiceIds.contains(id)) _closePeer(id);
    }
    // We initiate to peers with a larger id; smaller-id peers initiate to us.
    for (final id in inVoiceIds) {
      if (!_peers.containsKey(id) && _selfId.compareTo(id) < 0) {
        _connectTo(id);
      }
    }
    state = state.copyWith(peerCount: _peers.length);
  }

  Future<void> _connectTo(String peerId) async {
    final peer = await _createPeer(peerId);
    if (peer == null) return;
    final offer = await peer.pc.createOffer({});
    await peer.pc.setLocalDescription(offer);
    _signal(peerId, {'kind': 'offer', 'sdp': offer.sdp, 'type': offer.type});
  }

  // ─── Signaling: SDP / ICE relay ─────────────────────────
  Future<void> _onSignal(dynamic raw) async {
    if (raw is! Map) return;
    final from = raw['from']?.toString();
    final data = (raw['data'] as Map?)?.cast<String, dynamic>();
    if (from == null || data == null) return;
    final kind = data['kind'];

    if (kind == 'offer') {
      if (!state.inVoice) return; // not listening
      final peer = await _createPeer(from);
      if (peer == null) return;
      await peer.pc.setRemoteDescription(
          RTCSessionDescription(data['sdp']?.toString(), data['type']?.toString()));
      peer.remoteDescSet = true;
      await _flushIce(peer);
      final answer = await peer.pc.createAnswer({});
      await peer.pc.setLocalDescription(answer);
      _signal(from, {'kind': 'answer', 'sdp': answer.sdp, 'type': answer.type});
    } else if (kind == 'answer') {
      final peer = _peers[from];
      if (peer == null) return;
      await peer.pc.setRemoteDescription(
          RTCSessionDescription(data['sdp']?.toString(), data['type']?.toString()));
      peer.remoteDescSet = true;
      await _flushIce(peer);
    } else if (kind == 'ice') {
      final peer = _peers[from];
      if (peer == null) return;
      final c = RTCIceCandidate(
        data['candidate']?.toString(),
        data['sdpMid']?.toString(),
        (data['sdpMLineIndex'] as num?)?.toInt(),
      );
      if (peer.remoteDescSet) {
        await peer.pc.addCandidate(c);
      } else {
        peer.pendingIce.add(c); // buffer until remote description arrives
      }
    }
  }

  Future<_Peer?> _createPeer(String peerId) async {
    final existing = _peers[peerId];
    if (existing != null) return existing;
    final local = _localStream;
    if (local == null) return null;

    final pc = await createPeerConnection(_rtcConfig);
    final peer = _Peer(pc);
    _peers[peerId] = peer;

    for (final track in local.getTracks()) {
      await pc.addTrack(track, local);
    }

    pc.onIceCandidate = (RTCIceCandidate c) {
      if (c.candidate == null) return;
      _signal(peerId, {
        'kind': 'ice',
        'candidate': c.candidate,
        'sdpMid': c.sdpMid,
        'sdpMLineIndex': c.sdpMLineIndex,
      });
    };
    pc.onTrack = (RTCTrackEvent e) {
      if (e.streams.isNotEmpty) {
        peer.remoteStream = e.streams.first;
        // Honor an active deafen for late-arriving tracks.
        if (state.deafened) {
          for (final t in e.streams.first.getAudioTracks()) {
            t.enabled = false;
          }
        }
      }
    };
    pc.onConnectionState = (RTCPeerConnectionState s) {
      if (s == RTCPeerConnectionState.RTCPeerConnectionStateFailed ||
          s == RTCPeerConnectionState.RTCPeerConnectionStateClosed) {
        _closePeer(peerId);
      }
    };

    state = state.copyWith(peerCount: _peers.length);
    return peer;
  }

  Future<void> _flushIce(_Peer peer) async {
    for (final c in peer.pendingIce) {
      await peer.pc.addCandidate(c);
    }
    peer.pendingIce.clear();
  }

  void _applyDeafen(bool deafened) {
    for (final peer in _peers.values) {
      for (final t in peer.remoteStream?.getAudioTracks() ?? const <MediaStreamTrack>[]) {
        t.enabled = !deafened;
      }
    }
  }

  void _signal(String to, Map<String, dynamic> data) {
    _socket.emit('party:rtc-signal', {'to': to, 'data': data});
  }

  Future<Map<String, dynamic>> _emitVoiceAck(Map<String, dynamic> payload) {
    final completer = Completer<Map<String, dynamic>>();
    _socket.emitWithAck('party:voice', payload, ack: (dynamic res) {
      completer.complete((res as Map?)?.cast<String, dynamic>() ?? {'success': true});
    });
    // Don't hang forever if the server never acks.
    return completer.future.timeout(const Duration(seconds: 6),
        onTimeout: () => {'success': true});
  }

  void _closePeer(String peerId) {
    final peer = _peers.remove(peerId);
    if (peer == null) return;
    try {
      peer.pc.onIceCandidate = null;
      peer.pc.onTrack = null;
      peer.pc.onConnectionState = null;
      peer.pc.close();
    } catch (_) {/* already gone */}
    if (mounted) state = state.copyWith(peerCount: _peers.length);
  }

  Future<void> _stopLocal() async {
    for (final t in _localStream?.getTracks() ?? const <MediaStreamTrack>[]) {
      try {
        await t.stop();
      } catch (_) {}
    }
    try {
      await _localStream?.dispose();
    } catch (_) {}
    _localStream = null;
  }

  @override
  void dispose() {
    _socket.off('party:voice-state', _onVoiceState);
    _socket.off('party:rtc-signal', _onSignal);
    for (final id in _peers.keys.toList()) {
      _closePeer(id);
    }
    _stopLocal();
    super.dispose();
  }
}

/// Scoped to the room screen (autoDispose) so leaving the room tears down the
/// mesh and releases the microphone.
final voiceControllerProvider =
    StateNotifierProvider.autoDispose<VoiceController, VoiceUiState>(
  (ref) => VoiceController(),
);
