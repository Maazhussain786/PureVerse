import React from "react";
import { HeroSkeleton, MediaRowSkeleton } from "./components/Skeletons";

export default function Loading() {
  return (
    <main className="min-h-screen">
      <HeroSkeleton />
      <div className="relative z-10 -mt-8 px-4 md:px-8 w-full mx-auto">
        <div className="flex flex-col lg:flex-row gap-6 xl:gap-10">
          <div className="flex-1 min-w-0 flex flex-col gap-8">
            <MediaRowSkeleton />
            <MediaRowSkeleton />
            <MediaRowSkeleton />
            <MediaRowSkeleton />
          </div>
          <div className="w-full lg:w-[320px] xl:w-[360px] shrink-0 mt-2">
             <div className="bg-[var(--bg-card)] rounded-xl border border-[var(--glass-border)] p-5 h-[600px] animate-pulse">
                <div className="h-6 bg-white/10 rounded w-1/3 mb-6"></div>
                <div className="flex flex-col gap-4">
                  {[...Array(5)].map((_, i) => (
                    <div key={i} className="flex gap-4">
                      <div className="w-8 h-12 bg-white/5 rounded"></div>
                      <div className="flex-1 space-y-2">
                        <div className="h-4 bg-white/10 rounded w-3/4"></div>
                        <div className="h-3 bg-white/5 rounded w-1/2"></div>
                      </div>
                    </div>
                  ))}
                </div>
             </div>
          </div>
        </div>
      </div>
    </main>
  );
}
