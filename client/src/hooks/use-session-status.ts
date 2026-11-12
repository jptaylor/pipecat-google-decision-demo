import { usePipecatClientTransportState } from "@pipecat-ai/client-react";

import { usePerceptionStore } from "@/stores/perception-store";

/** Where a session and its current turn stand, in the order they happen. */
export type SessionStatus =
  "offline" | "connecting" | "ready" | "hearing" | "reading" | "failed";

/** One word for what is happening right now, for the pill and the status line alike. */
export function useSessionStatus(): SessionStatus {
  const transportState = usePipecatClientTransportState();
  const phase = usePerceptionStore((state) => state.phase);
  const hasFailed = usePerceptionStore((state) => state.hasFailed);

  if (transportState === "ready") {
    if (phase !== "idle") return phase;
    return hasFailed ? "failed" : "ready";
  }
  const isOffline =
    transportState === "disconnected" ||
    transportState === "disconnecting" ||
    transportState === "error";
  return isOffline ? "offline" : "connecting";
}
