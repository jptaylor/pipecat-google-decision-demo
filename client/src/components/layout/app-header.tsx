import {
  type SessionStatus,
  useSessionStatus,
} from "@/hooks/use-session-status";
import { cn } from "@/lib/utils";
import { usePerceptionStore } from "@/stores/perception-store";

const TITLE = "Pipecat Perception";
const SUBTITLE = "× Google Decision";
const READ_IN = "Read in";
const MILLISECONDS = "ms";

const STATUS_TEXT: Record<SessionStatus, string> = {
  offline: "Play a clip or speak",
  connecting: "Connecting",
  ready: "Ready",
  hearing: "Listening",
  reading: "Reading",
  failed: "No reading",
};

/** The page's name, what is happening right now, how long the last read took and the model asked. */
export function AppHeader() {
  const status = useSessionStatus();
  const readMs = usePerceptionStore((state) => state.reading?.readMs);
  const model = usePerceptionStore((state) => state.session?.model);
  const isWorking =
    status === "connecting" || status === "hearing" || status === "reading";

  return (
    <header className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 text-xs font-medium tracking-widest text-muted-foreground uppercase">
      <h1 className="flex items-center gap-3">
        <svg
          aria-hidden="true"
          viewBox="0 0 22 22"
          className="size-5 text-foreground"
        >
          <circle
            cx="11"
            cy="11"
            r="9"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
          />
          <circle cx="11" cy="11" r="3.5" fill="currentColor" />
        </svg>
        <span className="text-foreground">{TITLE}</span>
        <span>{SUBTITLE}</span>
      </h1>
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
        <p
          role="status"
          aria-live="polite"
          className={cn(
            "flex items-center gap-2",
            status === "failed" ? "text-destructive" : "text-foreground",
          )}
        >
          <span
            aria-hidden="true"
            className={cn(
              "size-2 rounded-full bg-tone-now text-tone-now dot-lit",
              isWorking && "animate-status motion-reduce:animate-none",
            )}
          />
          {STATUS_TEXT[status]}
        </p>
        {readMs === undefined ? null : (
          <span>
            {READ_IN} {Math.round(readMs)} {MILLISECONDS}
          </span>
        )}
        {model ? <span>{model}</span> : null}
      </div>
    </header>
  );
}
