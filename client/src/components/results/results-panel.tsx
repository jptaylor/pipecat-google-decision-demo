import { DotGauge } from "@/components/results/dot-gauge";
import { LatencyReadout } from "@/components/results/latency-readout";
import { ToneHeadline } from "@/components/results/tone-headline";
import { TonePanels } from "@/components/results/tone-panels";
import {
  type SessionStatus,
  useSessionStatus,
} from "@/hooks/use-session-status";
import { MEASURES, tonesOf, valueOf } from "@/lib/perception";
import { cn } from "@/lib/utils";
import { usePerceptionStore } from "@/stores/perception-store";

const LABEL = "Reading";

/** The panels breathe while a turn is heard, and quicken while the model reads it. */
const WORKING: Partial<Record<SessionStatus, string>> = {
  hearing: "animate-hearing motion-reduce:animate-none",
  reading: "animate-assessing motion-reduce:animate-none",
};

/** What the model made of the turn on show: its tone, each measured signal, and how long it took. */
export function ResultsPanel() {
  const reading = usePerceptionStore((state) => state.reading);
  const status = useSessionStatus();
  const signals = reading?.signals;
  const tones = tonesOf(signals);
  return (
    <section
      aria-label={LABEL}
      aria-busy={status === "hearing" || status === "reading"}
      className={cn("flex min-w-0 flex-col gap-frame", WORKING[status])}
    >
      <ToneHeadline tone={tones?.[0]?.label} readingId={reading?.id} />
      <TonePanels tones={tones} />
      <div className="grid grid-cols-2 gap-frame-sm sm:grid-cols-4">
        {MEASURES.map((measure) => (
          <DotGauge
            key={measure.name}
            measure={measure}
            value={valueOf(signals, measure.name)}
          />
        ))}
      </div>
      <LatencyReadout reading={reading} />
    </section>
  );
}
