"use client";

import { clsx } from "clsx";

type SwitchProps = {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  disabled?: boolean;
  className?: string;
};

export function Switch({
  checked,
  onChange,
  label,
  disabled = false,
  className,
}: SwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={clsx(
        "relative h-5 w-9 shrink-0 rounded-full transition-colors disabled:cursor-not-allowed disabled:opacity-40",
        checked
          ? "bg-primary shadow-[0_0_10px_rgb(var(--glow)/0.5)]"
          : "bg-muted-foreground/30",
        className,
      )}
    >
      <span
        aria-hidden
        className={clsx(
          "absolute top-0.5 size-4 rounded-full bg-white transition-all",
          checked ? "left-[18px]" : "left-0.5",
        )}
      />
    </button>
  );
}
