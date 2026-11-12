import {
  type SessionStatus,
  useSessionStatus,
} from "@/hooks/use-session-status";
import { cn } from "@/lib/utils";

const STATUS_TEXT: Record<SessionStatus, string> = {
  offline: "Play a clip or speak",
  connecting: "Connecting",
  ready: "Ready",
  hearing: "Listening",
  reading: "Reading",
  failed: "No reading",
};

/** One line under the pill saying what is happening, for those who can't read it from the pill. */
export function StatusLine() {
  const status = useSessionStatus();
  return (
    <p
      role="status"
      aria-live="polite"
      className={cn(
        "font-display text-lg leading-none font-bold tracking-widest uppercase",
        status === "failed" ? "text-destructive" : "text-muted-foreground",
      )}
    >
      {STATUS_TEXT[status]}
    </p>
  );
}
