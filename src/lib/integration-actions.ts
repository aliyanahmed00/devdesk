"use client";

import { useEffect, useRef } from "react";

import type { IntegrationId } from "@/lib/integrations";

const OPEN_EVENT = "devdesk:open-integration";

/** Ask the Integrations view to open the connect drawer for an integration. */
export function emitOpenIntegration(id: IntegrationId) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent<IntegrationId>(OPEN_EVENT, { detail: id }),
  );
}

export function useOpenIntegration(handler: (id: IntegrationId) => void) {
  const handlerRef = useRef(handler);

  useEffect(() => {
    handlerRef.current = handler;
  });

  useEffect(() => {
    const listener = (event: Event) => {
      handlerRef.current((event as CustomEvent<IntegrationId>).detail);
    };
    window.addEventListener(OPEN_EVENT, listener);
    return () => window.removeEventListener(OPEN_EVENT, listener);
  }, []);
}
