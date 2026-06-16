"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getSocket } from "../../lib/socket";

// Self-hosted WebRTC **mesh** voice for the watch party. Mirrors the Flutter
// voice controller: each voice member peers directly with every other voice
// member; the backend only relays opaque SDP/ICE over `party:rtc-signal`.
// Audio-only — remote audio plays through hidden <audio> elements, so "deafen"
// just mutes those (the video keeps playing). Glare rule: the peer with the
// lexicographically smaller socketId is the offerer.

const RTC_CONFIG: RTCConfiguration = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
  ],
};

interface Peer {
  pc: RTCPeerConnection;
  audio: HTMLAudioElement;
  pendingIce: RTCIceCandidateInit[];
  remoteDescSet: boolean;
}

interface VoiceSignal {
  kind: "offer" | "answer" | "ice";
  sdp?: string;
  type?: RTCSdpType;
  candidate?: string;
  sdpMid?: string | null;
  sdpMLineIndex?: number | null;
}

export interface VoiceChat {
  inVoice: boolean;
  micOn: boolean;
  deafened: boolean;
  connecting: boolean;
  peerCount: number;
  error: string | null;
  joinVoice: () => void;
  leaveVoice: () => void;
  toggleMic: () => void;
  toggleDeafen: () => void;
}

export function useVoiceChat(): VoiceChat {
  const [inVoice, setInVoice] = useState(false);
  const [micOn, setMicOn] = useState(false);
  const [deafened, setDeafened] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [peerCount, setPeerCount] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const localStream = useRef<MediaStream | null>(null);
  const peers = useRef<Map<string, Peer>>(new Map());
  const voiceIds = useRef<Set<string>>(new Set()); // last-known in-voice socketIds
  const inVoiceRef = useRef(false);
  const deafenedRef = useRef(false);

  const selfId = () => getSocket().id || "";
  const signal = (to: string, data: VoiceSignal) =>
    getSocket().emit("party:rtc-signal", { to, data });

  const closePeer = useCallback((id: string) => {
    const peer = peers.current.get(id);
    if (!peer) return;
    try {
      peer.pc.onicecandidate = null;
      peer.pc.ontrack = null;
      peer.pc.close();
    } catch { /* already closed */ }
    peer.audio.srcObject = null;
    peer.audio.remove();
    peers.current.delete(id);
    setPeerCount(peers.current.size);
  }, []);

  const createPeer = useCallback(
    (id: string): Peer | null => {
      const existing = peers.current.get(id);
      if (existing) return existing;
      const stream = localStream.current;
      if (!stream) return null;

      const pc = new RTCPeerConnection(RTC_CONFIG);
      const audio = document.createElement("audio");
      audio.autoplay = true;
      audio.muted = deafenedRef.current;
      document.body.appendChild(audio);
      const peer: Peer = { pc, audio, pendingIce: [], remoteDescSet: false };
      peers.current.set(id, peer);

      stream.getTracks().forEach((t) => pc.addTrack(t, stream));
      pc.onicecandidate = (e) => {
        if (e.candidate) {
          signal(id, {
            kind: "ice",
            candidate: e.candidate.candidate,
            sdpMid: e.candidate.sdpMid,
            sdpMLineIndex: e.candidate.sdpMLineIndex,
          });
        }
      };
      pc.ontrack = (e) => {
        if (e.streams[0]) audio.srcObject = e.streams[0];
      };
      pc.onconnectionstatechange = () => {
        if (pc.connectionState === "failed" || pc.connectionState === "closed") {
          closePeer(id);
        }
      };
      setPeerCount(peers.current.size);
      return peer;
    },
    [closePeer]
  );

  const connectTo = useCallback(
    async (id: string) => {
      const peer = createPeer(id);
      if (!peer) return;
      const offer = await peer.pc.createOffer();
      await peer.pc.setLocalDescription(offer);
      signal(id, { kind: "offer", sdp: offer.sdp, type: offer.type });
    },
    [createPeer]
  );

  // Open connections to peers we should offer to; drop peers that left voice.
  const reconcile = useCallback(() => {
    if (!inVoiceRef.current) return;
    const me = selfId();
    for (const id of Array.from(peers.current.keys())) {
      if (!voiceIds.current.has(id)) closePeer(id);
    }
    for (const id of voiceIds.current) {
      if (id === me) continue;
      if (!peers.current.has(id) && me < id) connectTo(id);
    }
  }, [closePeer, connectTo]);

  // ─── Socket wiring (lives for the hook's lifetime) ───
  useEffect(() => {
    const socket = getSocket();

    const onVoiceState = (
      list: { socketId: string; inVoice: boolean }[]
    ) => {
      voiceIds.current = new Set(
        (list || []).filter((m) => m.inVoice).map((m) => m.socketId)
      );
      reconcile();
    };

    const onSignal = async ({ from, data }: { from: string; data: VoiceSignal }) => {
      if (!from || !data) return;
      if (data.kind === "offer") {
        if (!inVoiceRef.current) return;
        const peer = createPeer(from);
        if (!peer) return;
        await peer.pc.setRemoteDescription({ type: data.type!, sdp: data.sdp });
        peer.remoteDescSet = true;
        for (const c of peer.pendingIce) await peer.pc.addIceCandidate(c);
        peer.pendingIce = [];
        const answer = await peer.pc.createAnswer();
        await peer.pc.setLocalDescription(answer);
        signal(from, { kind: "answer", sdp: answer.sdp, type: answer.type });
      } else if (data.kind === "answer") {
        const peer = peers.current.get(from);
        if (!peer) return;
        await peer.pc.setRemoteDescription({ type: data.type!, sdp: data.sdp });
        peer.remoteDescSet = true;
        for (const c of peer.pendingIce) await peer.pc.addIceCandidate(c);
        peer.pendingIce = [];
      } else if (data.kind === "ice") {
        const peer = peers.current.get(from);
        if (!peer) return;
        const cand: RTCIceCandidateInit = {
          candidate: data.candidate,
          sdpMid: data.sdpMid ?? undefined,
          sdpMLineIndex: data.sdpMLineIndex ?? undefined,
        };
        if (peer.remoteDescSet) await peer.pc.addIceCandidate(cand);
        else peer.pendingIce.push(cand);
      }
    };

    socket.on("party:voice-state", onVoiceState);
    socket.on("party:rtc-signal", onSignal);
    return () => {
      socket.off("party:voice-state", onVoiceState);
      socket.off("party:rtc-signal", onSignal);
    };
  }, [createPeer, reconcile]);

  // Tear down on unmount (leaving the room).
  useEffect(() => {
    const peerMap = peers.current;
    const stream = localStream;
    return () => {
      const socket = getSocket();
      if (inVoiceRef.current) socket.emit("party:voice", { inVoice: false });
      for (const id of Array.from(peerMap.keys())) closePeer(id);
      stream.current?.getTracks().forEach((t) => t.stop());
      stream.current = null;
    };
  }, [closePeer]);

  // ─── Controls ───
  const joinVoice = useCallback(async () => {
    if (inVoiceRef.current || connecting) return;
    setConnecting(true);
    setError(null);
    try {
      localStream.current = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: false,
      });
    } catch {
      setConnecting(false);
      setError("Microphone permission denied");
      return;
    }
    getSocket().emit(
      "party:voice",
      { inVoice: true, micOn: true, deafened: false },
      (res: { success?: boolean; message?: string }) => {
        if (res && res.success === false) {
          localStream.current?.getTracks().forEach((t) => t.stop());
          localStream.current = null;
          setConnecting(false);
          setError(res.message || "Voice is full");
          return;
        }
        inVoiceRef.current = true;
        deafenedRef.current = false;
        setInVoice(true);
        setMicOn(true);
        setDeafened(false);
        setConnecting(false);
        reconcile();
      }
    );
  }, [connecting, reconcile]);

  const leaveVoice = useCallback(() => {
    if (!inVoiceRef.current) return;
    getSocket().emit("party:voice", { inVoice: false });
    for (const id of Array.from(peers.current.keys())) closePeer(id);
    localStream.current?.getTracks().forEach((t) => t.stop());
    localStream.current = null;
    inVoiceRef.current = false;
    setInVoice(false);
    setMicOn(false);
    setDeafened(false);
  }, [closePeer]);

  const toggleMic = useCallback(() => {
    if (!inVoiceRef.current) return;
    const next = !micOn;
    localStream.current?.getAudioTracks().forEach((t) => (t.enabled = next));
    setMicOn(next);
    getSocket().emit("party:voice", { micOn: next });
  }, [micOn]);

  const toggleDeafen = useCallback(() => {
    if (!inVoiceRef.current) return;
    const next = !deafened;
    deafenedRef.current = next;
    peers.current.forEach((p) => (p.audio.muted = next));
    setDeafened(next);
    getSocket().emit("party:voice", { deafened: next });
  }, [deafened]);

  return {
    inVoice,
    micOn,
    deafened,
    connecting,
    peerCount,
    error,
    joinVoice,
    leaveVoice,
    toggleMic,
    toggleDeafen,
  };
}
