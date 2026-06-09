import React from "react";

export function HeroSkeleton() {
  return (
    <div className="relative w-full h-[82vh] md:h-[92vh] bg-[var(--bg-secondary)]">
      <div className="absolute bottom-0 left-0 right-0 p-8 md:p-14 lg:p-20">
        <div className="max-w-3xl">
          <div className="flex gap-2 mb-4">
            <div className="skeleton w-20 h-7 rounded-full" />
            <div className="skeleton w-16 h-7 rounded-full" />
          </div>
          <div className="skeleton w-[60%] h-14 mb-5 rounded-lg" />
          <div className="skeleton w-[80%] h-5 mb-3 rounded" />
          <div className="skeleton w-[50%] h-5 mb-8 rounded" />
          <div className="flex gap-4">
            <div className="skeleton w-40 h-12 rounded-full" />
            <div className="skeleton w-32 h-12 rounded-full" />
          </div>
        </div>
      </div>
    </div>
  );
}

export function MediaRowSkeleton({ count = 6, landscape = false }: { count?: number; landscape?: boolean }) {
  const widthClass = landscape
    ? "w-[230px] sm:w-[280px] md:w-[320px]"
    : "w-[140px] sm:w-[160px] md:w-[180px]";
  const aspectClass = landscape ? "aspect-video" : "aspect-[2/3]";
  return (
    <section className="mb-14 md:mb-16">
      <div className="flex items-center gap-3 mb-4 px-1">
        <div className="skeleton w-1 h-6 rounded-full" />
        <div className="skeleton w-44 h-7 rounded" />
      </div>
      <div className="flex gap-4 md:gap-5 overflow-hidden">
        {Array.from({ length: count }).map((_, i) => (
          <div key={i} className={`flex-none ${widthClass}`}>
            <div className={`skeleton ${aspectClass} rounded-xl`} />
            <div className="skeleton w-[80%] h-4 mt-2.5 rounded" />
            <div className="skeleton w-[50%] h-3 mt-2 rounded" />
          </div>
        ))}
      </div>
    </section>
  );
}
