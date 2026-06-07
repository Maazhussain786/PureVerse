import React from 'react';
import Link from 'next/link';

// Server Component fetching from our Node.js API Gateway
async function getTrendingMedia() {
  try {
    const res = await fetch('http://localhost:5000/api/trending', { cache: 'no-store' });
    if (!res.ok) return [];
    const data = await res.json();
    return data.data || [];
  } catch (e) {
    return [];
  }
}

export default async function Home() {
  const trending = await getTrendingMedia();
  
  if (!trending || trending.length === 0) {
    return (
      <main className="min-h-screen p-8 text-white flex flex-col items-center justify-center bg-[#09090E]">
        <h2 className="text-2xl font-bold mb-4 text-[#7C4DFF]">AniVerse</h2>
        <p className="text-gray-400">Loading media or backend API is currently unreachable...</p>
      </main>
    );
  }

  const heroItem = trending[0];
  const feedItems = trending.slice(1);

  return (
    <main className="min-h-screen text-white bg-[#09090E]">
      {/* Cinematic Hero Banner */}
      <div className="relative w-full h-[60vh] md:h-[75vh]">
        <div 
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: `url(${heroItem.bannerUrl})` }}
        />
        {/* Gradient fade to deep matte black */}
        <div className="absolute inset-0 bg-gradient-to-t from-[#09090E] via-[#09090E]/60 to-transparent" />
        
        <div className="absolute bottom-0 left-0 p-8 md:p-12 w-full max-w-4xl">
          <div className="flex gap-2 mb-3">
            <span className="bg-white/10 backdrop-blur-md border border-white/20 text-xs px-3 py-1 rounded-full uppercase tracking-wider">
              {heroItem.type}
            </span>
            <span className="bg-white/10 backdrop-blur-md border border-white/20 text-xs px-3 py-1 rounded-full text-yellow-400">
              ★ {heroItem.rating.toFixed(1)}
            </span>
          </div>
          <h1 className="text-4xl md:text-6xl font-bold mb-4 drop-shadow-lg">{heroItem.title}</h1>
          <p className="text-sm md:text-lg text-gray-300 mb-8 line-clamp-3 md:line-clamp-4 max-w-2xl drop-shadow-md">
            {heroItem.synopsis}
          </p>
          <div className="flex gap-4">
            <Link 
              href={`/watch/${heroItem.type}/${heroItem.id}`}
              className="bg-[#7C4DFF] hover:bg-[#6c3eee] transition-all duration-300 hover:scale-105 shadow-[0_0_20px_rgba(124,77,255,0.4)] text-white px-10 py-4 rounded-full font-semibold text-lg flex items-center gap-2"
            >
              <span>▶</span> Play Now
            </Link>
          </div>
        </div>
      </div>

      {/* Horizontal Trending Feed */}
      <div className="p-8 md:px-12 -mt-10 relative z-10">
        <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
          <span className="w-1 h-6 bg-[#7C4DFF] rounded-full"></span>
          Trending Now
        </h2>
        
        {/* Horizontally scrolling row */}
        <div className="flex gap-6 overflow-x-auto pb-8 pt-2 snap-x snap-mandatory hide-scrollbar">
          {feedItems.map((item: any) => (
            <Link 
              key={item.id} 
              href={`/watch/${item.type}/${item.id}`}
              className="flex-none w-[160px] md:w-[220px] snap-start group relative transition-all duration-300 hover:-translate-y-2"
            >
              <div className="aspect-[2/3] rounded-xl overflow-hidden glass-panel shadow-xl group-hover:shadow-[0_10px_30px_rgba(124,77,255,0.2)] transition-shadow">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img 
                  src={item.posterUrl} 
                  alt={item.title}
                  className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                  loading="lazy"
                />
              </div>
              <div className="mt-4">
                <h3 className="font-medium truncate text-gray-100 group-hover:text-[#7C4DFF] transition-colors">{item.title}</h3>
                <p className="text-sm text-gray-500 capitalize">{item.type} • {item.releaseYear}</p>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </main>
  );
}
