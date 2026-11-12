import { cn } from "@/lib/utils";
import type { Reading } from "@/stores/perception-store";

const TITLE = "Read in";
const EMPTY = "--";
const MILLISECONDS = "ms";
const AUDIO_SUFFIX = "s of audio";

interface LatencyReadoutProps {
  /** The reading on show, or null when there is none. */
  reading: Reading | null;
}

/** How long the model took to read the turn, as big as any of its answers. */
export function LatencyReadout({ reading }: LatencyReadoutProps) {
  return (
    <article className="flex min-w-0 flex-col gap-1.5">
      <span className="text-xs font-medium tracking-widest text-muted-foreground uppercase">
        {TITLE}
      </span>
      <span className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span
          className={cn(
            "font-display text-latency leading-none font-black tracking-tight",
            !reading && "text-muted-foreground/40",
          )}
        >
          {reading ? Math.round(reading.readMs) : EMPTY}
        </span>
        <span className="text-base font-medium text-muted-foreground">
          {MILLISECONDS}
        </span>
        {reading ? (
          <span className="text-sm text-muted-foreground">
            {reading.audioSecs.toFixed(1)} {AUDIO_SUFFIX}
          </span>
        ) : null}
      </span>
    </article>
  );
}
