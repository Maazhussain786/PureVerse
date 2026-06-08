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
}

export default function NativePlayer({ url, subtitles, poster }: NativePlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !url) return;

    // Destroy previous HLS instance before creating a new one
    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }

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
        video.play().catch(() => {});
      });

      hls.on(Hls.Events.ERROR, (_event, data) => {
        if (data.fatal) {
          switch (data.type) {
            case Hls.ErrorTypes.NETWORK_ERROR:
              hls.startLoad();
              break;
            case Hls.ErrorTypes.MEDIA_ERROR:
              hls.recoverMediaError();
              break;
            default:
              hls.destroy();
              break;
          }
        }
      });

      return () => {
        if (hlsRef.current) {
          hlsRef.current.destroy();
          hlsRef.current = null;
        }
      };
    } else if (video.canPlayType("application/vnd.apple.mpegurl")) {
      video.src = url;
      video.addEventListener('loadedmetadata', () => {
        video.play().catch(() => {});
      });
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
