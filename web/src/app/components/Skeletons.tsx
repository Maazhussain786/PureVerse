import React from "react";
import LoadingSpinner from "./LoadingSpinner";

export function HeroSkeleton() {
  return <LoadingSpinner />;
}

export function MediaRowSkeleton({ count = 6, landscape = false }: { count?: number; landscape?: boolean }) {
  return <LoadingSpinner />;
}

