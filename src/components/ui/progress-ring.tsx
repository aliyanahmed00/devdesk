"use client";

import { useEffect, useState, type ReactNode } from "react";
import { clsx } from "clsx";

type ProgressRingProps = {
  value: number;
  max: number;
  size?: number;
  stroke?: number;
  /** Stroke color for the progress arc (e.g. "text-indigo-500"). */
  className?: string;
  /** Stroke color for the track. */
  trackClassName?: string;
  children?: ReactNode;
};

/**
 * Animated SVG progress ring. The arc animates in on mount and eases to new
 * values as `value`/`max` change.
 */
export function ProgressRing({
  value,
  max,
  size = 96,
  stroke = 8,
  className,
  trackClassName,
  children,
}: ProgressRingProps) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const id = window.setTimeout(() => setReady(true), 40);
    return () => window.clearTimeout(id);
  }, []);

  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const ratio = max > 0 ? Math.min(1, Math.max(0, value / max)) : 0;
  const offset = circumference * (1 - (ready ? ratio : 0));
  const center = size / 2;

  return (
    <div
      className="relative inline-flex shrink-0 items-center justify-center"
      style={{ width: size, height: size }}
    >
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="-rotate-90"
        aria-hidden
      >
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          strokeWidth={stroke}
          className={clsx(
            "stroke-current text-muted-foreground/15",
            trackClassName,
          )}
        />
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className={clsx(
            "stroke-current transition-[stroke-dashoffset] duration-700 ease-out",
            className,
          )}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        {children}
      </div>
    </div>
  );
}
