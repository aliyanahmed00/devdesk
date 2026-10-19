"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Command,
  GripVertical,
  Layers,
  PartyPopper,
  Plug,
  X,
  type LucideIcon,
} from "lucide-react";
import { clsx } from "clsx";

import type { DashboardTab } from "@/components/dashboard/dashboard-tabs";

export const TOUR_STORAGE_KEY = "devdesk:onboarding-tour";

type TourStep = {
  id: string;
  target: string;
  title: string;
  description: string;
  icon: LucideIcon;
  /** Dashboard tab the target lives on (navigated to when the step opens). */
  tab?: DashboardTab;
};

const STEPS: TourStep[] = [
  {
    id: "palette",
    target: "search",
    title: "Command Palette",
    description:
      "Press ⌘K (or Ctrl+K) anywhere to search notes, tasks, snippets and jump to any action. The search bar up here works too.",
    icon: Command,
  },
  {
    id: "reorder",
    target: "widget-drag",
    title: "Reorder Widgets",
    description:
      "Drag the grip handle on any card to rearrange your dashboard. Your layout is saved automatically — no setup required.",
    icon: GripVertical,
    tab: "overview",
  },
  {
    id: "workspace",
    target: "workspace",
    title: "Workspace Selector",
    description:
      "Switch between saved workspaces. Each profile keeps its own widgets, layout and theme so you can context-switch instantly.",
    icon: Layers,
    tab: "overview",
  },
  {
    id: "integrations",
    target: "integrations",
    title: "Integrations Portal",
    description:
      "Open the Integrations tab to connect GitHub, Vercel, Docker, Supabase and more — then sync live developer data.",
    icon: Plug,
  },
];

type OnboardingTourProps = {
  open: boolean;
  onClose: () => void;
  onNavigate?: (tab: DashboardTab) => void;
};

const GAP = 14;
const MARGIN = 12;
const TOOLTIP_WIDTH = 340;
const TOOLTIP_HEIGHT = 210;

function rectOf(el: Element): DOMRect | null {
  const rect = el.getBoundingClientRect();
  if (rect.width === 0 && rect.height === 0) return null;
  return rect;
}

export function OnboardingTour({
  open,
  onClose,
  onNavigate,
}: OnboardingTourProps) {
  const [stepIndex, setStepIndex] = useState(0);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const [viewport, setViewport] = useState({ w: 0, h: 0 });
  const scrolledRef = useRef(false);
  const onNavigateRef = useRef(onNavigate);

  useEffect(() => {
    onNavigateRef.current = onNavigate;
  }, [onNavigate]);

  const step = STEPS[stepIndex];
  const isLast = stepIndex === STEPS.length - 1;

  const goNext = useCallback(() => {
    setStepIndex((index) => Math.min(index + 1, STEPS.length - 1));
  }, []);

  const goPrev = useCallback(() => {
    setStepIndex((index) => Math.max(index - 1, 0));
  }, []);

  useEffect(() => {
    if (!open) return;
    const id = window.setTimeout(() => setStepIndex(0), 0);
    return () => window.clearTimeout(id);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    if (step.tab) onNavigateRef.current?.(step.tab);
    scrolledRef.current = false;

    let cancelled = false;
    const delays = [0, 80, 200, 400, 650];
    const timers = delays.map((delay, index) =>
      window.setTimeout(() => {
        if (cancelled) return;
        const el = document.querySelector<HTMLElement>(
          `[data-tour="${step.target}"]`,
        );
        const resolved = el ? rectOf(el) : null;
        if (!resolved) {
          if (index === 0 || index === delays.length - 1) setRect(null);
          return;
        }
        if (!scrolledRef.current) {
          scrolledRef.current = true;
          el?.scrollIntoView({ block: "center", inline: "center" });
        }
        setRect(resolved);
        setViewport({ w: window.innerWidth, h: window.innerHeight });
      }, delay),
    );

    return () => {
      cancelled = true;
      timers.forEach((timer) => window.clearTimeout(timer));
    };
  }, [open, step.target, step.tab, stepIndex]);

  useEffect(() => {
    if (!open) return;
    const onMove = () => {
      const el = document.querySelector<HTMLElement>(
        `[data-tour="${step.target}"]`,
      );
      setRect(el ? rectOf(el) : null);
      setViewport({ w: window.innerWidth, h: window.innerHeight });
    };
    window.addEventListener("resize", onMove);
    window.addEventListener("scroll", onMove, true);
    return () => {
      window.removeEventListener("resize", onMove);
      window.removeEventListener("scroll", onMove, true);
    };
  }, [open, step.target]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.isComposing) return;
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      } else if (event.key === "ArrowRight" || event.key === "Enter") {
        event.preventDefault();
        if (isLast) onClose();
        else goNext();
      } else if (event.key === "ArrowLeft") {
        event.preventDefault();
        goPrev();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, isLast, goNext, goPrev, onClose]);

  const tooltip = useMemo(() => {
    if (!rect) return { centered: true as const };
    const vw = viewport.w || 1024;
    const vh = viewport.h || 768;
    const tw = Math.min(TOOLTIP_WIDTH, vw - MARGIN * 2);
    const th = TOOLTIP_HEIGHT;

    const roomBelow = vh - rect.bottom;
    const placeTop =
      roomBelow < th + GAP + MARGIN && rect.top > th + GAP + MARGIN;

    let left = rect.left + rect.width / 2 - tw / 2;
    left = Math.max(MARGIN, Math.min(left, vw - tw - MARGIN));

    let top = placeTop ? rect.top - GAP - th : rect.bottom + GAP;
    top = Math.max(MARGIN, Math.min(top, vh - th - MARGIN));

    return { centered: false as const, left, top, width: tw };
  }, [rect, viewport]);

  if (!open) return null;

  const StepIcon = step.icon;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Product tour"
      className="fixed inset-0 z-[100]"
    >
      {rect ? (
        <div
          aria-hidden
          className="pointer-events-none absolute rounded-xl transition-all duration-300 ease-out"
          style={{
            left: rect.left,
            top: rect.top,
            width: rect.width,
            height: rect.height,
            boxShadow: "0 0 0 9999px rgba(0, 0, 0, 0.72)",
          }}
        />
      ) : (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-black/72 backdrop-blur-[2px]"
        />
      )}

      {rect && (
        <div
          aria-hidden
          className="pointer-events-none absolute animate-pulse rounded-xl ring-2 ring-primary/80 transition-all duration-300 ease-out"
          style={{
            left: rect.left,
            top: rect.top,
            width: rect.width,
            height: rect.height,
          }}
        />
      )}

      <div
        role="group"
        aria-live="polite"
        className={clsx(
          "glass animate-scale-in absolute flex flex-col gap-4 rounded-2xl border border-primary/30 p-5 text-card-foreground shadow-2xl",
          "pointer-events-auto",
        )}
        style={
          tooltip.centered
            ? {
                left: "50%",
                top: "50%",
                width: `min(${TOOLTIP_WIDTH}px, calc(100vw - 2rem))`,
                maxHeight: "calc(100vh - 2rem)",
                overflowY: "auto",
                transform: "translate(-50%, -50%)",
              }
            : {
                left: tooltip.left,
                top: tooltip.top,
                width: tooltip.width,
                maxHeight: `calc(100vh - ${MARGIN * 2}px)`,
                overflowY: "auto",
              }
        }
      >
        <div className="flex items-start gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary ring-1 ring-inset ring-primary/25">
            <StepIcon className="size-5" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="font-mono text-[10px] font-semibold tracking-wider text-primary uppercase">
                Step {stepIndex + 1} of {STEPS.length}
              </span>
            </div>
            <h2 className="mt-0.5 text-base font-semibold tracking-tight">
              {step.title}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Skip tour"
            title="Skip tour"
            className="flex size-7 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <X className="size-4" />
          </button>
        </div>

        <p className="text-sm leading-relaxed text-muted-foreground">
          {step.description}
        </p>

        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-1.5" aria-hidden>
            {STEPS.map((candidate, index) => (
              <button
                key={candidate.id}
                type="button"
                tabIndex={-1}
                onClick={() => setStepIndex(index)}
                aria-label={`Go to step ${index + 1}`}
                className={clsx(
                  "h-1.5 rounded-full transition-all",
                  index === stepIndex
                    ? "w-5 bg-primary"
                    : "w-1.5 bg-muted-foreground/40 hover:bg-muted-foreground/70",
                )}
              />
            ))}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg px-2.5 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              Skip tour
            </button>
            {stepIndex > 0 && (
              <button
                type="button"
                onClick={goPrev}
                className="btn-surface flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-medium"
              >
                <ChevronLeft className="size-3.5" />
                Previous
              </button>
            )}
            <button
              type="button"
              onClick={isLast ? onClose : goNext}
              className="btn-primary flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-medium"
            >
              {isLast ? (
                <>
                  <Check className="size-3.5" />
                  Finish
                </>
              ) : (
                <>
                  Next
                  <ChevronRight className="size-3.5" />
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {rect === null && (
        <span className="pointer-events-none absolute left-1/2 top-6 flex -translate-x-1/2 items-center gap-1.5 rounded-full bg-black/60 px-3 py-1 font-mono text-[11px] text-zinc-300">
          <PartyPopper className="size-3.5" />
          Quick tour
        </span>
      )}
    </div>
  );
}
