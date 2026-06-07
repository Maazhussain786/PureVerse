import React from "react";

export function HeroSkeleton() {
  return (
    <div className="relative w-full h-[70vh] md:h-[80vh] bg-[var(--bg-secondary)]">
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

export function MediaRowSkeleton({ count = 8 }: { count?: number }) {
  return (
    <section className="mb-10">
      <div className="flex items-center gap-3 mb-5 px-1">
        <div className="skeleton w-1 h-6 rounded-full" />
        <div className="skeleton w-40 h-7 rounded" />
      </div>
      <div className="flex gap-4 md:gap-5 overflow-hidden">
        {Array.from({ length: count }).map((_, i) => (
          <div key={i} className="flex-none w-[140px] sm:w-[160px] md:w-[180px]">
            <div className="skeleton aspect-[2/3] rounded-xl" />
            <div className="skeleton w-[80%] h-4 mt-2.5 rounded" />
          </div>
        ))}
      </div>
    </section>
  );
}
