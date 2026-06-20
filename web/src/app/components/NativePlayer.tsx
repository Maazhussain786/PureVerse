"use client";

import React, { useEffect, useRef } from "react";
import Hls from "hls.js";

interface SubtitleTrack {
  lang: string;
  url: string;
}

interface NativePlayerProps {
  url: string;
  subtitles?: SubtitleTrack[];
  poster?: string;
  /** Called when the stream can't be played, so the caller can fall back. */
  onFatal?: () => void;
}

export default function NativePlayer({ url, subtitles, poster, onFatal }: NativePlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  // Keep the latest onFatal without re-running the effect when it changes.
  const onFatalRef = useRef(onFatal);
  useEffect(() => {
    onFatalRef.current = onFatal;
  }, [onFatal]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !url) return;

    // Destroy previous HLS instance before creating a new one
    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }

    // Give a stuck/blocked stream a bounded time to produce its first frame,
    // then hand back to the caller (→ iframe fallback) instead of hanging.
    let recovered = false;
    let networkRetries = 0;
    const startTimeout = window.setTimeout(() => {
      if (!recovered) onFatalRef.current?.();
    }, 12000);
    const clearStart = () => {
      recovered = true;
      window.clearTimeout(startTimeout);
    };

    if (Hls.isSupported()) {
      const hls = new Hls({
        capLevelToPlayerSize: true,
        maxBufferSize: 30 * 1000 * 1000,
        startPosition: -1,
        lowLatencyMode: false,
        backBufferLength: 90,
      });

      hls.loadSource(url);
      hls.attachMedia(video);
      hlsRef.current = hls;

      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        clearStart();
        video.play().catch(() => {});
      });

      hls.on(Hls.Events.ERROR, (_event, data) => {
        if (!data.fatal) return;
        switch (data.type) {
          case Hls.ErrorTypes.NETWORK_ERROR:
            // Retry a couple of times, then give up to the fallback.
            if (networkRetries++ < 2) {
              hls.startLoad();
            } else {
              clearStart();
              hls.destroy();
              onFatalRef.current?.();
            }
            break;
          case Hls.ErrorTypes.MEDIA_ERROR:
            hls.recoverMediaError();
            break;
          default:
            clearStart();
            hls.destroy();
            onFatalRef.current?.();
            break;
        }
      });

      return () => {
        window.clearTimeout(startTimeout);
        if (hlsRef.current) {
          hlsRef.current.destroy();
          hlsRef.current = null;
        }
      };
    } else if (video.canPlayType("application/vnd.apple.mpegurl")) {
      // Safari / iOS native HLS.
      video.src = url;
      video.addEventListener("loadedmetadata", () => {
        clearStart();
        video.play().catch(() => {});
      });
      video.addEventListener("error", () => onFatalRef.current?.());
      return () => window.clearTimeout(startTimeout);
    } else {
      window.clearTimeout(startTimeout);
      onFatalRef.current?.();
    }
  }, [url]);

  return (
    <div className="w-full h-full bg-black relative flex items-center justify-center">
      <video
        ref={videoRef}
        controls
        autoPlay
        crossOrigin="anonymous"
        poster={poster}
        className="w-full h-full outline-none"
        style={{ backgroundColor: "black" }}
      >
        {subtitles &&
          subtitles.map((sub, idx) => (
            <track
              key={idx}
              kind="subtitles"
              srcLang={sub.lang.slice(0, 2).toLowerCase()}
              src={sub.url}
              label={sub.lang}
              default={sub.lang.toLowerCase() === "english" || idx === 0}
            />
          ))}
      </video>
    </div>
  );
}
