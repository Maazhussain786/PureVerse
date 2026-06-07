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

    if (Hls.isSupported()) {
      const hls = new Hls({
        capLevelToPlayerSize: true,
        maxBufferSize: 30 * 1000 * 1000, // 30 MB
      });

      hls.loadSource(url);
      hls.attachMedia(video);
      hlsRef.current = hls;

      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        // Ready to play
      });

      return () => {
        hls.destroy();
      };
    } else if (video.canPlayType("application/vnd.apple.mpegurl")) {
      // Native HLS support (Safari)
      video.src = url;
    }
  }, [url]);

  return (
    <div className="w-full aspect-video rounded-2xl overflow-hidden bg-black ring-1 ring-white/5 shadow-[0_8px_40px_rgba(0,0,0,0.8)] relative group">
      <video
        ref={videoRef}
        controls
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
