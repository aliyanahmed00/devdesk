"use client";

import { useEffect, useRef } from "react";

import { useToast } from "@/components/providers/toast-provider";

export function ServiceWorkerProvider() {
  const { toast } = useToast();
  const wasOffline = useRef(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const handleOnline = () => {
      if (!wasOffline.current) return;
      wasOffline.current = false;
      toast("Back online — your workspace is syncing.", "success");
    };

    const handleOffline = () => {
      if (wasOffline.current) return;
      wasOffline.current = true;
      toast("You're offline. Cached widgets still work.", "info");
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    let registered = false;
    const register = () => {
      if (registered) return;
      registered = true;
      navigator.serviceWorker
        .register("/sw.js", { scope: "/", updateViaCache: "none" })
        .catch(() => {
          /* registration is best-effort */
        });
    };

    if ("serviceWorker" in navigator && process.env.NODE_ENV === "production") {
      if (document.readyState === "complete") {
        register();
      } else {
        window.addEventListener("load", register, { once: true });
      }
    }

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("load", register);
    };
  }, [toast]);

  return null;
}
