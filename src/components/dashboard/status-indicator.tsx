"use client";

import { useEffect, useState } from "react";
import { clsx } from "clsx";

export function StatusIndicator() {
  const [online, setOnline] = useState(true);

  useEffect(() => {
    let active = true;
    const update = () => {
      if (active) setOnline(navigator.onLine);
    };
    const boot = window.setTimeout(update, 0);
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      active = false;
      window.clearTimeout(boot);
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);

  return (
    <div
      className={clsx(
        "hidden items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium md:flex",
        online
          ? "border-emerald-500/30 bg-emerald-500/5 text-emerald-500"
          : "border-rose-500/40 bg-rose-500/5 text-rose-500",
      )}
      title={online ? "Session active" : "No network connection"}
    >
      <span className="relative flex size-1.5">
        {online && (
          <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-500 opacity-75" />
        )}
        <span
          className={clsx(
            "relative inline-flex size-1.5 rounded-full",
            online ? "bg-emerald-500" : "bg-rose-500",
          )}
        />
      </span>
      {online ? "Active session" : "Offline"}
    </div>
  );
}
