"use client";

import { cn } from "@/lib/utils";

/**
 * Animated SVG waveform. Bars animate when `active`, static when idle.
 * `level` (0-1) optionally scales amplitude for real-time volume.
 */
export function Waveform({
  active,
  level = 1,
  bars = 5,
  className,
}: {
  active: boolean;
  level?: number;
  bars?: number;
  className?: string;
}) {
  const heights = [0.4, 0.7, 1, 0.6, 0.85, 0.5, 0.9];
  return (
    <div className={cn("flex items-center gap-[3px] h-6", className)}>
      {Array.from({ length: bars }).map((_, i) => {
        const base = heights[i % heights.length];
        return (
          <span
            key={i}
            className={cn(
              "w-[3px] rounded-full",
              active ? "bg-accent animate-wave" : "bg-text-muted"
            )}
            style={{
              height: `${(active ? base * Math.max(0.3, level) : 0.3) * 100}%`,
              animationDelay: `${i * 0.12}s`,
              animationDuration: `${0.7 + (i % 3) * 0.15}s`,
            }}
          />
        );
      })}
    </div>
  );
}
