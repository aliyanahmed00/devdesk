"use client";

import {
  createContext,
  useCallback,
  useContext,
  useState,
  type ReactNode,
} from "react";
import { AlertTriangle, CheckCircle2, Info, X } from "lucide-react";
import { clsx } from "clsx";

type ToastTone = "success" | "info" | "error";

type Toast = {
  id: string;
  message: string;
  tone: ToastTone;
};

type ToastContextValue = {
  toast: (message: string, tone?: ToastTone) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

const TONE_STYLES: Record<ToastTone, string> = {
  success: "border-emerald-500/40 text-emerald-500",
  info: "border-primary/40 text-primary",
  error: "border-rose-500/40 text-rose-500",
};

const TONE_ICONS: Record<ToastTone, typeof Info> = {
  success: CheckCircle2,
  info: Info,
  error: AlertTriangle,
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const dismiss = useCallback((id: string) => {
    setToasts((current) => current.filter((item) => item.id !== id));
  }, []);

  const toast = useCallback(
    (message: string, tone: ToastTone = "info") => {
      const id = crypto.randomUUID();
      setToasts((current) => [...current, { id, message, tone }]);
      window.setTimeout(() => {
        setToasts((current) => current.filter((item) => item.id !== id));
      }, 2800);
    },
    [],
  );

  return (
    <ToastContext value={{ toast }}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed bottom-4 right-4 z-[100] flex w-full max-w-xs flex-col gap-2"
      >
        {toasts.map((item) => {
          const Icon = TONE_ICONS[item.tone];
          return (
            <div
              key={item.id}
              className={clsx(
                "animate-slide-in-right pointer-events-auto flex items-start gap-2.5 rounded-xl border bg-card/90 p-3 text-sm text-card-foreground shadow-lg backdrop-blur-md",
                TONE_STYLES[item.tone],
              )}
            >
              <Icon className="mt-0.5 size-4 shrink-0" />
              <span className="flex-1 leading-snug text-foreground">
                {item.message}
              </span>
              <button
                type="button"
                onClick={() => dismiss(item.id)}
                aria-label="Dismiss notification"
                className="shrink-0 text-muted-foreground transition-colors hover:text-foreground"
              >
                <X className="size-3.5" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return context;
}
