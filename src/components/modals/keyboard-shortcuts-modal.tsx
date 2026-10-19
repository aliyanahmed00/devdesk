"use client";

import { useEffect, useState } from "react";
import { RotateCcw } from "lucide-react";
import { clsx } from "clsx";

import { Modal } from "@/components/ui/modal";
import { useToast } from "@/components/providers/toast-provider";
import { useHotkeys } from "@/components/providers/hotkeys-provider";
import {
  HOTKEYS,
  HOTKEY_CATEGORY_ORDER,
  comboFromEvent,
  comboToKeycaps,
  detectMac,
  formatCombo,
  getHotkey,
  isModifierKey,
  isValidCombo,
  type HotkeyCombo,
  type HotkeyId,
} from "@/lib/hotkeys";

type KeyboardShortcutsModalProps = {
  open: boolean;
  onClose: () => void;
};

function Keycap({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="rounded border border-zinc-700 bg-zinc-800 px-2 py-1 font-mono text-xs text-zinc-200">
      {children}
    </kbd>
  );
}

function Keycaps({ combo, isMac }: { combo: HotkeyCombo; isMac: boolean }) {
  return (
    <span className="flex items-center gap-1">
      {comboToKeycaps(combo, isMac).map((cap, index) => (
        <Keycap key={`${cap}-${index}`}>{cap}</Keycap>
      ))}
    </span>
  );
}

export function KeyboardShortcutsModal({
  open,
  onClose,
}: KeyboardShortcutsModalProps) {
  const { prefs, isEnabled, toggleEnabled, setCombo, reset } = useHotkeys();
  const { toast } = useToast();
  const [recordingId, setRecordingId] = useState<HotkeyId | null>(null);
  const isMac = detectMac();

  useEffect(() => {
    if (!recordingId) return;

    const onKey = (event: KeyboardEvent) => {
      event.preventDefault();
      event.stopImmediatePropagation();

      if (event.key === "Escape") {
        setRecordingId(null);
        return;
      }
      if (isModifierKey(event.key)) return;

      const combo = comboFromEvent(event);
      const def = getHotkey(recordingId);
      if (!def) {
        setRecordingId(null);
        return;
      }
      if (!isValidCombo(combo)) {
        toast("Include a modifier (⌘/Ctrl, Shift or Alt)", "error");
        return;
      }
      setCombo(def.id, combo);
      toast(`${def.label} → ${formatCombo(combo, isMac)}`, "success");
      setRecordingId(null);
    };

    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [recordingId, setCombo, toast, isMac]);

  return (
    <Modal open={open} onClose={onClose} title="Keyboard shortcuts" size="md">
      <p className="text-sm text-muted-foreground">
        Rebind any action by clicking its keys, or toggle it off. Your choices
        are saved in this browser.
      </p>

      <div className="mt-4 flex flex-col gap-5">
        {HOTKEY_CATEGORY_ORDER.map((category) => (
          <section key={category}>
            <h3 className="font-mono text-[10px] font-semibold tracking-wider text-zinc-400 uppercase">
              {category}
            </h3>
            <ul className="mt-2 flex flex-col gap-1">
              {HOTKEYS.filter((def) => def.category === category).map((def) => {
                const Icon = def.icon;
                const combo = prefs.combos[def.id] ?? def.defaultCombo;
                const enabled = isEnabled(def.id);
                const recording = recordingId === def.id;

                return (
                  <li
                    key={def.id}
                    className={clsx(
                      "flex items-center gap-3 rounded-lg border border-border/60 bg-background/40 px-3 py-2 transition-opacity",
                      def.remappable && !enabled && "opacity-50",
                    )}
                  >
                    <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted/60 text-muted-foreground">
                      <Icon className="size-4" />
                    </span>

                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">
                        {def.label}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {def.description}
                      </p>
                    </div>

                    {def.remappable ? (
                      <div className="flex shrink-0 items-center gap-2">
                        <button
                          type="button"
                          onClick={() =>
                            setRecordingId(recording ? null : def.id)
                          }
                          aria-label={`Change ${def.label} shortcut`}
                          className={clsx(
                            "rounded-lg border px-2 py-1 text-xs transition-colors",
                            recording
                              ? "animate-pulse border-primary/60 bg-primary/10 text-primary"
                              : "border-border hover:bg-muted",
                          )}
                        >
                          {recording ? (
                            <span className="flex items-center gap-1 font-mono">
                              Press keys…
                            </span>
                          ) : (
                            <Keycaps combo={combo} isMac={isMac} />
                          )}
                        </button>
                        <button
                          type="button"
                          role="switch"
                          aria-checked={enabled}
                          aria-label={`Toggle ${def.label}`}
                          onClick={() => toggleEnabled(def.id)}
                          className={clsx(
                            "relative h-5 w-9 shrink-0 rounded-full transition-colors",
                            enabled ? "bg-primary" : "bg-muted",
                          )}
                        >
                          <span
                            className={clsx(
                              "absolute top-0.5 size-4 rounded-full bg-background shadow transition-transform",
                              enabled ? "left-4" : "left-0.5",
                            )}
                          />
                        </button>
                      </div>
                    ) : (
                      <div className="flex shrink-0 items-center gap-2">
                        <Keycaps combo={combo} isMac={isMac} />
                        <span className="rounded-full border border-border px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                          Built-in
                        </span>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </div>

      <div className="mt-5 flex justify-end border-t border-border pt-4">
        <button
          type="button"
          onClick={() => {
            reset();
            setRecordingId(null);
            toast("Shortcuts reset to defaults", "info");
          }}
          className="btn-surface flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium"
        >
          <RotateCcw className="size-4 opacity-70" />
          Reset to defaults
        </button>
      </div>
    </Modal>
  );
}
