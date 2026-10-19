"use client";

import {
  Component,
  useEffect,
  useState,
  type ErrorInfo,
  type ReactNode,
} from "react";
import { AlertTriangle, RotateCw, WifiOff } from "lucide-react";
import { clsx } from "clsx";

import { useMockApi } from "@/components/providers/mock-api-provider";
import {
  isMockApiError,
  mockRequest,
  type MockApiError,
} from "@/lib/api-client";
import type { WidgetDefinition } from "./widget-registry";

type Phase = "ready" | "loading" | "error";

function WidgetSkeleton() {
  return (
    <div aria-hidden className="flex h-full flex-col gap-3">
      <div className="h-3 w-1/3 animate-pulse rounded bg-muted" />
      <div className="h-20 animate-pulse rounded-lg bg-muted" />
      <div className="h-3 w-2/3 animate-pulse rounded bg-muted" />
      <div className="h-3 w-1/2 animate-pulse rounded bg-muted" />
    </div>
  );
}

function ErrorOverlay({
  title,
  message,
  offline,
  onRetry,
}: {
  title: string;
  message: string;
  offline: boolean;
  onRetry: () => void;
}) {
  return (
    <div className="flex h-full min-h-40 flex-col items-center justify-center gap-3 py-6 text-center">
      <span
        className={clsx(
          "flex size-11 items-center justify-center rounded-xl ring-1 ring-inset",
          offline
            ? "bg-amber-500/10 text-amber-400 ring-amber-500/30"
            : "bg-rose-500/10 text-rose-400 ring-rose-500/30",
        )}
      >
        {offline ? (
          <WifiOff className="size-5" />
        ) : (
          <AlertTriangle className="size-5" />
        )}
      </span>
      <div className="space-y-1">
        <p className="text-sm font-medium text-foreground">{title}</p>
        <p className="mx-auto max-w-xs text-xs text-muted-foreground">
          {message}
        </p>
      </div>
      <button
        type="button"
        onClick={onRetry}
        className="btn-surface flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium"
      >
        <RotateCw className="size-3.5" />
        Retry connection
      </button>
    </div>
  );
}

type BoundaryProps = {
  widget: WidgetDefinition;
  onRetry: () => void;
  children: ReactNode;
};

type BoundaryState = { error: Error | null };

/** Catches render-time failures thrown by a widget so the rest of the grid survives. */
class WidgetErrorBoundary extends Component<BoundaryProps, BoundaryState> {
  state: BoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): BoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Surface to the console for debugging; the grid itself stays alive.
    if (process.env.NODE_ENV !== "production") {
      console.error(`[widget:${this.props.widget.id}]`, error, info);
    }
  }

  private reset = () => {
    this.setState({ error: null });
    this.props.onRetry();
  };

  render() {
    if (this.state.error) {
      return (
        <ErrorOverlay
          title="Widget crashed"
          message={this.state.error.message || "An unexpected error occurred."}
          offline={false}
          onRetry={this.reset}
        />
      );
    }
    return this.props.children;
  }
}

/**
 * Simulates an initial data load for a widget through the mock API layer.
 * Shows a skeleton during latency and a retry overlay when the request fails
 * (offline mode, forced status, or a random failure).
 */
export function WidgetLoader({
  widget,
  children,
}: {
  widget: WidgetDefinition;
  children: ReactNode;
}) {
  const { offline } = useMockApi();
  const [phase, setPhase] = useState<Phase>("ready");
  const [error, setError] = useState<MockApiError | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    const boot = window.setTimeout(() => {
      setPhase("loading");
      setError(null);
      mockRequest<boolean>({
        url: `/api/widgets/${widget.id}`,
        method: "GET",
        source: widget.title,
        payload: { widget: widget.id },
        signal: controller.signal,
      })
        .then(() => {
          if (!controller.signal.aborted) setPhase("ready");
        })
        .catch((cause: unknown) => {
          if (controller.signal.aborted) return;
          if (cause instanceof Error && cause.name === "AbortError") return;
          setError(isMockApiError(cause) ? cause : null);
          setPhase("error");
        });
    }, 0);

    return () => {
      controller.abort();
      window.clearTimeout(boot);
    };
  }, [widget.id, widget.title, offline, attempt]);

  const retry = () => setAttempt((value) => value + 1);

  return (
    <WidgetErrorBoundary widget={widget} onRetry={retry}>
      {phase === "loading" ? (
        <WidgetSkeleton />
      ) : phase === "error" ? (
        <ErrorOverlay
          title={
            offline || error?.offline
              ? "Connection lost"
              : `Request failed${error ? ` · ${error.status}` : ""}`
          }
          message={error?.message ?? "Unable to load this widget."}
          offline={offline || Boolean(error?.offline)}
          onRetry={retry}
        />
      ) : (
        children
      )}
    </WidgetErrorBoundary>
  );
}
