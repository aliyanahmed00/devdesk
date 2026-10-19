"use client";

import { useEffect, useRef, type RefObject } from "react";

type AudioVisualizerProps = {
  analyserRef: RefObject<AnalyserNode | null>;
  active?: boolean;
  barCount?: number;
  className?: string;
};

const VIEW_HEIGHT = 100;
const BAR_WIDTH = 6;
const BAR_GAP = 4;
const MIN_HEIGHT = 6;
const MAX_GROWTH = 92;

export function AudioVisualizer({
  analyserRef,
  active = false,
  barCount = 40,
  className,
}: AudioVisualizerProps) {
  const rectsRef = useRef<(SVGRectElement | null)[]>([]);

  useEffect(() => {
    const rects = rectsRef.current;
    let frame = 0;
    let data: Uint8Array<ArrayBuffer> | null = null;

    const paint = (time: number) => {
      const analyser = analyserRef.current;
      if (active && analyser) {
        if (!data || data.length !== analyser.frequencyBinCount) {
          data = new Uint8Array(analyser.frequencyBinCount);
        }
        analyser.getByteFrequencyData(data);
        const usable = Math.max(1, Math.floor(data.length * 0.66));
        for (let i = 0; i < barCount; i += 1) {
          const rect = rects[i];
          if (!rect) continue;
          const start = Math.floor((i / barCount) * usable);
          const end = Math.max(
            start + 1,
            Math.floor(((i + 1) / barCount) * usable),
          );
          let sum = 0;
          for (let j = start; j < end; j += 1) sum += data[j];
          const level = sum / (end - start) / 255;
          const height = MIN_HEIGHT + level * MAX_GROWTH;
          rect.setAttribute("height", height.toFixed(1));
          rect.setAttribute("y", (VIEW_HEIGHT - height).toFixed(1));
        }
        return;
      }

      for (let i = 0; i < barCount; i += 1) {
        const rect = rects[i];
        if (!rect) continue;
        const idle = 0.1 + 0.14 * Math.abs(Math.sin(time / 900 + i * 0.55));
        const height = MIN_HEIGHT + idle * MAX_GROWTH;
        rect.setAttribute("height", height.toFixed(1));
        rect.setAttribute("y", (VIEW_HEIGHT - height).toFixed(1));
      }
    };

    const reduce =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (reduce) {
      paint(0);
      return;
    }

    const loop = (time: number) => {
      paint(time);
      frame = window.requestAnimationFrame(loop);
    };
    frame = window.requestAnimationFrame(loop);
    return () => window.cancelAnimationFrame(frame);
  }, [active, analyserRef, barCount]);

  const width = barCount * (BAR_WIDTH + BAR_GAP);

  return (
    <svg
      aria-hidden
      viewBox={`0 0 ${width} ${VIEW_HEIGHT}`}
      preserveAspectRatio="none"
      className={className}
    >
      {Array.from({ length: barCount }, (_, index) => (
        <rect
          key={index}
          ref={(element) => {
            rectsRef.current[index] = element;
          }}
          x={index * (BAR_WIDTH + BAR_GAP)}
          y={VIEW_HEIGHT - MIN_HEIGHT}
          width={BAR_WIDTH}
          height={MIN_HEIGHT}
          rx={BAR_WIDTH / 2}
          fill="currentColor"
        />
      ))}
    </svg>
  );
}
