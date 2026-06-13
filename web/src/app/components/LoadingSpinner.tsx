import React from "react";

export default function LoadingSpinner() {
  return (
    <div className="w-full min-h-[40vh] flex flex-col items-center justify-center gap-4">
      <div className="w-12 h-12 rounded-full border-4 border-white/10 border-t-[var(--accent-primary)] animate-spin" />
      <p className="text-sm text-[var(--text-muted)] font-medium tracking-wide">
        Loading...
      </p>
    </div>
  );
}
