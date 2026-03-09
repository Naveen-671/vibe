"use client";

import { useEffect } from "react";
import { useTRPC } from "@/trpc/client";

export default function TrpcInspector() {
  const trpc = useTRPC();

  useEffect(() => {
    // We avoid `any` by working with unknown/object introspection
    try {
      const obj = trpc as unknown;
      // Print top-level keys (may be proxy-ish)
      console.log("[TRPC-INSPECT] typeof trpc:", typeof trpc, "keys:", Object.keys(obj as Record<string, unknown>));
      // Try to stringify a small shape safely (avoid circular)
      console.log("[TRPC-INSPECT] sample toString:", String(trpc));
    } catch (e) {
      console.error("[TRPC-INSPECT] inspect error", e);
    }
  }, [trpc]);

  return null;
}
