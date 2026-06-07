import React from 'react';

export default function WatchPage({ params }: { params: { type: string, id: string } }) {
  // In a real flow, this would fetch from our Node.js backend
  const streamUrl = 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8';

  return (
    <div className="bg-black min-h-screen text-white flex flex-col items-center p-4">
      <div className="w-full max-w-6xl aspect-video bg-gray-900 rounded-xl overflow-hidden shadow-2xl border border-white/10 mt-10">
        {/* Note: Native video tag requires an HLS library (like hls.js) for broad browser support. */}
        {/* We use a direct source here assuming native Safari support or a wrapper component. */}
        <video 
          className="w-full h-full"
          controls 
          autoPlay 
          src={streamUrl} 
        />
      </div>
      <div className="w-full max-w-6xl mt-6 glass-panel p-6 rounded-xl">
        <h1 className="text-3xl font-bold mb-2 text-[#7C4DFF]">
          Watching: {params.type.toUpperCase()} - {params.id}
        </h1>
        <p className="text-gray-400">Stream powered by AniVerse API Gateway • Auto Server</p>
      </div>
    </div>
  );
}
