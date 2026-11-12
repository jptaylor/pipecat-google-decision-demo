import { MeasureTile } from "@/components/results/measure-tile";
import { ToneReadout } from "@/components/results/tone-readout";
import { TurnFooter } from "@/components/results/turn-footer";
import { MEASURES, tonesOf, valueOf } from "@/lib/perception";
import { usePerceptionStore } from "@/stores/perception-store";

const LABEL = "Reading";

/** What the model made of the turn on show: its tone, then each measured signal. */
export function ResultsPanel() {
  const signals = usePerceptionStore((state) => state.reading?.signals);
  return (
    <section aria-label={LABEL} className="flex min-w-0 flex-col gap-10">
      <ToneReadout tones={tonesOf(signals)} />
      <div className="grid grid-cols-2 gap-x-6 gap-y-8 sm:gap-x-10">
        {MEASURES.map((measure) => (
          <MeasureTile
            key={measure.name}
            measure={measure}
            value={valueOf(signals, measure.name)}
          />
        ))}
      </div>
      <TurnFooter />
    </section>
  );
}
