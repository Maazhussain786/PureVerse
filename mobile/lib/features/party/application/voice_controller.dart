import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_webrtc/flutter_webrtc.dart';
import 'package:permission_handler/permission_handler.dart';
import 'package:socket_io_client/socket_io_client.dart' as io;

import '../../../core/network/api_client.dart';
import '../../../shared/providers/api_providers.dart';
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
  // True once we've closed this connection — every native call re-checks this
  // (and that the peer is still the current one) AFTER each await, so a
  // teardown that races an in-flight signal can't fire a method on a closed
  // RTCPeerConnection (a native abort that Dart try/catch can't catch).
  bool closed = false;
  // Guards the offer→answer sequence so two offers for the same peer can't both
  // run setRemoteDescription on it (a classic native crash).
  bool negotiating = false;
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
  VoiceController(this._api) : super(const VoiceUiState()) {
    _socket = partySocket();
    _socket.on('party:voice-state', _onVoiceState);
    _socket.on('party:rtc-signal', _onSignal);
  }

  final ApiClient _api;
  late final io.Socket _socket;
  MediaStream? _localStream;
  final Map<String, _Peer> _peers = {};
  // De-dupes concurrent peer creation. `createPeerConnection` is async, so
  // without this the two near-simultaneous reconciles when a 2nd member joins
  // (one from joinVoice, one from the party:voice-state broadcast) both pass the
  // "peer doesn't exist yet" check and build TWO connections + fire duplicate
  // offers — which crashes libwebrtc natively and kills the app. The web client
  // never hits this because RTCPeerConnection there is created synchronously.
  final Map<String, Future<_Peer?>> _creating = {};
  // ICE candidates that arrive before the peer exists (offer/answer still in
  // flight). Buffered by peerId and drained into the peer once it's built, so
  // we don't silently drop candidates and fail to connect.
  final Map<String, List<RTCIceCandidate>> _earlyIce = {};
  List<Map<String, dynamic>> _lastVoiceState = const [];

  /// A peer is safe to call native methods on only while it's still the current
  /// connection for [peerId] and hasn't been closed. Re-checked after every
  /// await in the signaling paths.
  bool _alive(String peerId, _Peer peer) =>
      mounted && !peer.closed && identical(_peers[peerId], peer);

  // ICE config is fetched from the backend (GET /rtc/ice) so a TURN relay can be
  // added server-side WITHOUT rebuilding the app. Cached for the session; falls
  // back to STUN-only if the fetch fails. TURN is essential on mobile data /
  // carrier-grade NAT (pure STUN fails there). The old hardcoded
  // openrelay.metered.ca relay is DEAD — that's why voice stopped connecting.
  Map<String, dynamic>? _rtcConfig;

  static const Map<String, dynamic> _stunOnlyConfig = {
    'iceServers': [
      {'urls': 'stun:stun.l.google.com:19302'},
      {'urls': 'stun:stun1.l.google.com:19302'},
    ],
    'sdpSemantics': 'unified-plan',
  };

  Future<Map<String, dynamic>> _iceConfig() async {
    if (_rtcConfig != null) return _rtcConfig!;
    try {
      final servers = await _api.getIceServers();
      if (servers.isNotEmpty) {
        _rtcConfig = {'iceServers': servers, 'sdpSemantics': 'unified-plan'};
        return _rtcConfig!;
      }
    } catch (_) {/* fall back to STUN-only */}
    _rtcConfig = _stunOnlyConfig;
    return _rtcConfig!;
  }

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

    // Route call audio to the loudspeaker so remote voices are actually audible
    // (WebRTC defaults to the quiet earpiece on Android).
    try {
      await Helper.setSpeakerphoneOn(true);
    } catch (_) {/* not fatal */}

    await _iceConfig(); // warm the ICE config before peers are built
    state = state.copyWith(inVoice: true, micOn: true, deafened: false, connecting: false);
    _reconcilePeers(); // connect to everyone already in voice
  }

  Future<void> leaveVoice() async {
    if (!state.inVoice) return;
    _socket.emit('party:voice', {'inVoice': false});
    for (final id in _peers.keys.toList()) {
      _closePeer(id);
    }
    _creating.clear();
    _earlyIce.clear();
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
    // Skip anyone we're already connected to OR already building a connection
    // for — that guard (plus the de-dupe in _createPeer) is what stops the
    // duplicate-offer crash.
    for (final id in inVoiceIds) {
      if (_selfId.compareTo(id) < 0 &&
          !_peers.containsKey(id) &&
          !_creating.containsKey(id)) {
        _connectTo(id);
      }
    }
    state = state.copyWith(peerCount: _peers.length);
  }

  Future<void> _connectTo(String peerId) async {
    final peer = await _createPeer(peerId);
    if (peer == null || !_alive(peerId, peer)) return;
    try {
      final offer = await peer.pc.createOffer({});
      if (!_alive(peerId, peer)) return;
      await peer.pc.setLocalDescription(offer);
      if (!_alive(peerId, peer)) return;
      _signal(peerId, {'kind': 'offer', 'sdp': offer.sdp, 'type': offer.type});
    } catch (_) {
      _closePeer(peerId); // negotiation failed — drop, don't crash the mesh
    }
  }

  // ─── Signaling: SDP / ICE relay ─────────────────────────
  // Every SDP/ICE step is wrapped: a failure drops just that peer instead of
  // throwing into libwebrtc and taking the app down. The next voice-state
  // reconcile re-establishes the connection cleanly.
  Future<void> _onSignal(dynamic raw) async {
    if (raw is! Map) return;
    final from = raw['from']?.toString();
    final data = (raw['data'] as Map?)?.cast<String, dynamic>();
    if (from == null || data == null) return;
    final kind = data['kind'];

    try {
      if (kind == 'offer') {
        if (!state.inVoice) return; // not listening
        // Ignore a duplicate offer for a peer we've already set up or are
        // mid-negotiation with — re-applying a remote offer is a native crash.
        final already = _peers[from];
        if (already != null && (already.remoteDescSet || already.negotiating)) return;
        final peer = await _createPeer(from);
        // After the await, bail if it was torn down / superseded, or another
        // offer handler already claimed the negotiation.
        if (peer == null || !_alive(from, peer) || peer.remoteDescSet || peer.negotiating) {
          return;
        }
        peer.negotiating = true;
        try {
          await peer.pc.setRemoteDescription(
              RTCSessionDescription(data['sdp']?.toString(), data['type']?.toString()));
          if (!_alive(from, peer)) return;
          peer.remoteDescSet = true;
          await _flushIce(peer);
          if (!_alive(from, peer)) return;
          final answer = await peer.pc.createAnswer({});
          if (!_alive(from, peer)) return;
          await peer.pc.setLocalDescription(answer);
          if (!_alive(from, peer)) return;
          _signal(from, {'kind': 'answer', 'sdp': answer.sdp, 'type': answer.type});
        } finally {
          peer.negotiating = false;
        }
      } else if (kind == 'answer') {
        final peer = _peers[from];
        if (peer == null || peer.remoteDescSet) return; // ignore stray/duplicate
        await peer.pc.setRemoteDescription(
            RTCSessionDescription(data['sdp']?.toString(), data['type']?.toString()));
        if (!_alive(from, peer)) return;
        peer.remoteDescSet = true;
        await _flushIce(peer);
      } else if (kind == 'ice') {
        final c = RTCIceCandidate(
          data['candidate']?.toString(),
          data['sdpMid']?.toString(),
          (data['sdpMLineIndex'] as num?)?.toInt(),
        );
        final peer = _peers[from];
        if (peer == null) {
          // Peer is still being built — buffer so we don't drop the candidate.
          (_earlyIce[from] ??= []).add(c);
          return;
        }
        if (peer.remoteDescSet) {
          if (!_alive(from, peer)) return;
          await peer.pc.addCandidate(c);
        } else {
          peer.pendingIce.add(c); // buffer until remote description arrives
        }
      }
    } catch (_) {
      _closePeer(from);
    }
  }

  /// Get-or-create the peer for [peerId], de-duping concurrent creation so two
  /// reconciles can't build two connections for the same peer (the join crash).
  Future<_Peer?> _createPeer(String peerId) {
    final existing = _peers[peerId];
    if (existing != null) return Future.value(existing);
    final inFlight = _creating[peerId];
    if (inFlight != null) return inFlight;
    final fut = _buildPeer(peerId);
    _creating[peerId] = fut;
    fut.whenComplete(() => _creating.remove(peerId));
    return fut;
  }

  Future<_Peer?> _buildPeer(String peerId) async {
    final local = _localStream;
    if (local == null) return null;

    RTCPeerConnection pc;
    try {
      pc = await createPeerConnection(await _iceConfig());
    } catch (_) {
      return null;
    }
    // Another path may have created (or we may have torn down) while awaiting.
    if (!mounted || _peers.containsKey(peerId)) {
      try {
        await pc.close();
      } catch (_) {}
      return _peers[peerId];
    }

    final peer = _Peer(pc);
    _peers[peerId] = peer;

    // Adopt any ICE candidates that arrived before this peer existed.
    final early = _earlyIce.remove(peerId);
    if (early != null) peer.pendingIce.addAll(early);

    try {
      for (final track in local.getTracks()) {
        if (peer.closed) break; // torn down mid-build — stop touching the pc
        await pc.addTrack(track, local);
      }
    } catch (_) {/* sender setup is best-effort */}

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

    if (mounted) state = state.copyWith(peerCount: _peers.length);
    return peer;
  }

  Future<void> _flushIce(_Peer peer) async {
    final pending = [...peer.pendingIce];
    peer.pendingIce.clear();
    for (final c in pending) {
      if (peer.closed) return; // don't add to a closed connection
      try {
        await peer.pc.addCandidate(c);
      } catch (_) {/* a single bad candidate shouldn't kill the peer */}
    }
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
    _earlyIce.remove(peerId);
    final peer = _peers.remove(peerId);
    if (peer == null) return;
    peer.closed = true; // set BEFORE close so in-flight signals bail via _alive
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
    _creating.clear();
    _earlyIce.clear();
    _stopLocal();
    super.dispose();
  }
}

/// Scoped to the room screen (autoDispose) so leaving the room tears down the
/// mesh and releases the microphone.
final voiceControllerProvider =
    StateNotifierProvider.autoDispose<VoiceController, VoiceUiState>(
  (ref) => VoiceController(ref.read(apiClientProvider)),
);
