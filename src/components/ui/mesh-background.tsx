"use client";

import { useEffect, useRef } from "react";
import { clsx } from "clsx";

import {
  hexToRgb,
  parseRgbTriplet,
  rgba,
  rotateHue,
  type MeshBackgroundConfig,
  type Rgb,
} from "@/lib/mesh-background";

type MeshBackgroundProps = {
  config: MeshBackgroundConfig;
  className?: string;
};

/** Cap the backing store so large displays don't burn fill-rate. */
const MAX_DPR = 1.5;
/** Ambient drift doesn't need 60fps — 30 is smooth and halves the work. */
const TARGET_FPS = 30;
const FRAME_INTERVAL = 1000 / TARGET_FPS;

type Palette = {
  /** Foreground color — used for grid hairlines. */
  line: Rgb;
  primary: Rgb;
  secondary: Rgb;
  tertiary: Rgb;
};

function readPalette(): Palette {
  const styles = getComputedStyle(document.documentElement);
  const glow = parseRgbTriplet(styles.getPropertyValue("--glow"));
  const primaryHex = hexToRgb(styles.getPropertyValue("--primary"));
  const lineHex = hexToRgb(styles.getPropertyValue("--foreground"));

  const primary = glow ?? primaryHex ?? { r: 99, g: 102, b: 241 };
  return {
    line: lineHex ?? { r: 255, g: 255, b: 255 },
    primary,
    secondary: rotateHue(primary, 48),
    tertiary: rotateHue(primary, -58),
  };
}

export function MeshBackground({ config, className }: MeshBackgroundProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const configRef = useRef(config);

  useEffect(() => {
    configRef.current = config;
  }, [config]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const context = canvas.getContext("2d", { alpha: true });
    if (!context) return;

    const gridCanvas = document.createElement("canvas");
    const gridContext = gridCanvas.getContext("2d");
    if (!gridContext) return;

    // Local non-null aliases keep TypeScript happy inside the closures below.
    const ctx: CanvasRenderingContext2D = context;
    const gridCtx: CanvasRenderingContext2D = gridContext;

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

    let width = 0;
    let height = 0;
    let dpr = 1;
    let gridKey = "";
    let clock = 0;
    let last = 0;
    let frame = 0;
    let cleared = false;
    let palette = readPalette();

    const pointer = { x: 0, y: 0, tx: 0, ty: 0 };

    const resize = () => {
      dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
      width = window.innerWidth;
      height = window.innerHeight;

      canvas.width = Math.max(1, Math.floor(width * dpr));
      canvas.height = Math.max(1, Math.floor(height * dpr));
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      gridCanvas.width = canvas.width;
      gridCanvas.height = canvas.height;
      gridCtx.setTransform(dpr, 0, 0, dpr, 0, 0);

      if (pointer.x === 0 && pointer.y === 0) {
        pointer.x = pointer.tx = width * 0.5;
        pointer.y = pointer.ty = height * 0.42;
      }

      gridKey = "";
      cleared = false;
    };

    const drawGrid = () => {
      const cfg = configRef.current;
      const key = [
        width,
        height,
        dpr,
        cfg.grid,
        cfg.gridSize,
        cfg.gridOpacity,
        palette.line.r,
        palette.line.g,
        palette.line.b,
      ].join("|");
      if (key === gridKey) return;
      gridKey = key;

      gridCtx.clearRect(0, 0, width, height);
      if (!cfg.grid || cfg.gridOpacity <= 0) return;

      // A 1-device-pixel hairline: lineWidth is scaled back by dpr and the
      // 0.5 device-pixel offset keeps each line crisp (no anti-aliased blur).
      const offset = 0.5 / dpr;
      gridCtx.lineWidth = 1 / dpr;
      gridCtx.strokeStyle = rgba(palette.line, cfg.gridOpacity);
      gridCtx.beginPath();
      for (let x = 0; x <= width; x += cfg.gridSize) {
        const px = Math.round(x) + offset;
        gridCtx.moveTo(px, 0);
        gridCtx.lineTo(px, height);
      }
      for (let y = 0; y <= height; y += cfg.gridSize) {
        const py = Math.round(y) + offset;
        gridCtx.moveTo(0, py);
        gridCtx.lineTo(width, py);
      }
      gridCtx.stroke();
    };

    const drawMesh = (time: number) => {
      const cfg = configRef.current;
      if (!cfg.mesh || cfg.meshIntensity <= 0) return;

      const intensity = cfg.meshIntensity;
      const reach = Math.max(width, height) * 0.5;
      const drift = reduceMotion.matches || !cfg.animated ? 0 : time;

      const blobs = [
        {
          color: palette.primary,
          x: width * 0.22,
          y: height * 0.3,
          r: reach,
          speed: 0.00007,
          phase: 0,
        },
        {
          color: palette.secondary,
          x: width * 0.8,
          y: height * 0.22,
          r: reach * 0.92,
          speed: 0.000095,
          phase: 1.7,
        },
        {
          color: palette.tertiary,
          x: width * 0.62,
          y: height * 0.85,
          r: reach * 1.05,
          speed: 0.00006,
          phase: 3.1,
        },
      ];

      ctx.globalCompositeOperation = "lighter";
      for (const blob of blobs) {
        const cx =
          blob.x + Math.cos(drift * blob.speed + blob.phase) * width * 0.13;
        const cy =
          blob.y +
          Math.sin(drift * blob.speed * 1.25 + blob.phase) * height * 0.13;
        const radius =
          blob.r * (0.9 + 0.1 * Math.sin(drift * blob.speed * 0.8 + blob.phase));

        const gradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius);
        gradient.addColorStop(0, rgba(blob.color, 0.1 * intensity));
        gradient.addColorStop(0.5, rgba(blob.color, 0.04 * intensity));
        gradient.addColorStop(1, rgba(blob.color, 0));
        ctx.fillStyle = gradient;
        ctx.fillRect(cx - radius, cy - radius, radius * 2, radius * 2);
      }
      ctx.globalCompositeOperation = "source-over";
    };

    const drawSpotlight = () => {
      const cfg = configRef.current;
      if (!cfg.spotlight || cfg.spotlightIntensity <= 0) return;

      const radius = Math.min(Math.max(width, height) * 0.34, 520);
      const intensity = cfg.spotlightIntensity;
      const gradient = ctx.createRadialGradient(
        pointer.x,
        pointer.y,
        0,
        pointer.x,
        pointer.y,
        radius,
      );
      gradient.addColorStop(0, rgba(palette.primary, 0.16 * intensity));
      gradient.addColorStop(0.35, rgba(palette.primary, 0.06 * intensity));
      gradient.addColorStop(1, rgba(palette.primary, 0));

      ctx.globalCompositeOperation = "lighter";
      ctx.fillStyle = gradient;
      ctx.fillRect(
        pointer.x - radius,
        pointer.y - radius,
        radius * 2,
        radius * 2,
      );
      ctx.globalCompositeOperation = "source-over";
    };

    const render = (time: number) => {
      frame = window.requestAnimationFrame(render);
      if (document.hidden) {
        last = time;
        return;
      }
      if (time - last < FRAME_INTERVAL) return;

      const delta = last === 0 ? FRAME_INTERVAL : Math.min(time - last, 60);
      last = time;
      clock += delta;

      const cfg = configRef.current;
      if (!cfg.enabled) {
        if (!cleared) {
          ctx.clearRect(0, 0, width, height);
          cleared = true;
        }
        return;
      }
      cleared = false;

      // Ease the focal light toward the cursor for a soft trailing feel.
      pointer.x += (pointer.tx - pointer.x) * 0.16;
      pointer.y += (pointer.ty - pointer.y) * 0.16;

      ctx.clearRect(0, 0, width, height);
      drawGrid();
      if (gridCanvas.width > 0) {
        ctx.drawImage(gridCanvas, 0, 0, width, height);
      }
      drawMesh(clock);
      drawSpotlight();
    };

    const onPointerMove = (event: PointerEvent) => {
      pointer.tx = event.clientX;
      pointer.ty = event.clientY;
    };

    const onPointerLeave = () => {
      pointer.tx = width * 0.5;
      pointer.ty = height * 0.42;
    };

    const observer = new MutationObserver(() => {
      palette = readPalette();
      gridKey = "";
    });
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme", "data-accent", "style", "class"],
    });

    resize();
    window.addEventListener("resize", resize);
    window.addEventListener("pointermove", onPointerMove, { passive: true });
    document.addEventListener("pointerleave", onPointerLeave);
    frame = window.requestAnimationFrame(render);

    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("resize", resize);
      window.removeEventListener("pointermove", onPointerMove);
      document.removeEventListener("pointerleave", onPointerLeave);
      observer.disconnect();
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      data-mesh-background
      className={clsx("pointer-events-none fixed inset-0 -z-10", className)}
    />
  );
}
