import { LatencyReadout } from "@/components/results/latency-readout";
import { MeasureTile } from "@/components/results/measure-tile";
import { ToneReadout } from "@/components/results/tone-readout";
import { TurnFooter } from "@/components/results/turn-footer";
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
  return (
    <section aria-label={LABEL} className="flex min-w-0 flex-col gap-frame">
      <div
        aria-busy={status === "hearing" || status === "reading"}
        className={cn("flex flex-col gap-frame", WORKING[status])}
      >
        <ToneReadout tones={tonesOf(signals)} />
        <div className="grid grid-cols-2 gap-x-6 gap-y-frame sm:gap-x-10">
          {MEASURES.map((measure) => (
            <MeasureTile
              key={measure.name}
              measure={measure}
              value={valueOf(signals, measure.name)}
            />
          ))}
        </div>
        <LatencyReadout reading={reading} />
      </div>
      <TurnFooter />
    </section>
  );
}
