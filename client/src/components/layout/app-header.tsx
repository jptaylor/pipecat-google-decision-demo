import { PipecatMark } from "@/components/layout/pipecat-mark";
import {
  type SessionStatus,
  useSessionStatus,
} from "@/hooks/use-session-status";
import { cn } from "@/lib/utils";
import { usePerceptionStore } from "@/stores/perception-store";

const TITLE = "Pipecat Perception";
const SUBTITLE = "× Google Decision";
const LATENCY = "Latency";
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
    <header className="flex items-center justify-between gap-x-6 text-xs font-medium tracking-widest whitespace-nowrap text-muted-foreground uppercase">
      <h1 className="flex items-center gap-3">
        <PipecatMark className="size-5 text-foreground" />
        {/* Stacked, the mark stands for the name, which is still read out. */}
        <span className="sr-only text-foreground lg:not-sr-only">{TITLE}</span>
        <span className="sr-only lg:not-sr-only">{SUBTITLE}</span>
      </h1>
      <div className="flex items-center gap-x-6">
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
              "size-2 rounded-full bg-tone-now",
              isWorking && "animate-status motion-reduce:animate-none",
            )}
          />
          {STATUS_TEXT[status]}
        </p>
        {readMs === undefined ? null : (
          <span className="hidden sm:inline">
            {LATENCY}{" "}
            <span className="text-foreground">{Math.round(readMs)}</span>{" "}
            {MILLISECONDS}
          </span>
        )}
        {model ? <span className="hidden sm:inline">{model}</span> : null}
      </div>
    </header>
  );
}
