"use client";

import { useEffect, useState } from "react";
import { Clock } from "lucide-react";

export function HeaderClock() {
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    let active = true;
    const tick = () => {
      if (active) setNow(new Date());
    };
    const boot = window.setTimeout(tick, 0);
    const interval = window.setInterval(tick, 1000);
    return () => {
      active = false;
      window.clearTimeout(boot);
      window.clearInterval(interval);
    };
  }, []);

  const time = now
    ? now.toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      })
    : "--:--:--";
  const date = now
    ? now.toLocaleDateString([], {
        weekday: "short",
        month: "short",
        day: "numeric",
      })
    : "----------";

  return (
    <div className="hidden items-center gap-2 rounded-lg border border-zinc-800/80 bg-zinc-900/60 px-3 py-1.5 backdrop-blur-xl xl:flex">
      <Clock className="size-3.5 text-primary" />
      <span className="font-mono text-xs font-medium tabular-nums tracking-tight text-foreground">
        {time}
      </span>
      <span className="font-mono text-[11px] text-zinc-500">{date}</span>
    </div>
  );
}
