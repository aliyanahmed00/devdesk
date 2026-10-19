"use client";

import { useEffect, useState } from "react";

export function formatRelativeTime(timestamp: number, now = Date.now()): string {
  const diff = Math.max(0, now - timestamp);
  const seconds = Math.round(diff / 1000);

  if (seconds < 45) return "just now";

  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? "" : "s"} ago`;

  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;

  const days = Math.round(hours / 24);
  if (days < 30) return `${days} day${days === 1 ? "" : "s"} ago`;

  const months = Math.round(days / 30);
  if (months < 12) return `${months} month${months === 1 ? "" : "s"} ago`;

  const years = Math.round(months / 12);
  return `${years} year${years === 1 ? "" : "s"} ago`;
}

export function formatClockTime(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function useNow(intervalMs = 30_000): number {
  const [now, setNow] = useState(0);

  useEffect(() => {
    const tick = () => setNow(Date.now());
    const timeout = window.setTimeout(tick, 0);
    const interval = window.setInterval(tick, intervalMs);
    return () => {
      window.clearTimeout(timeout);
      window.clearInterval(interval);
    };
  }, [intervalMs]);

  return now;
}
