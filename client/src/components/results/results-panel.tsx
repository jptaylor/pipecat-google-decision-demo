import { DotGauge } from "@/components/results/dot-gauge";
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

/**
 * While a turn is in progress the panels sink back and pulse, slowly while
 * it is heard and quicker while the model reads it, under the word for which.
 */
const WORKING: Partial<
  Record<SessionStatus, { word: string; pulse: string; wordPulse: string }>
> = {
  hearing: {
    word: "Listening",
    pulse: "animate-hearing motion-reduce:animate-none",
    wordPulse: "animate-word-hearing motion-reduce:animate-none",
  },
  reading: {
    word: "Reading",
    pulse: "animate-assessing motion-reduce:animate-none",
    wordPulse: "animate-word-assessing motion-reduce:animate-none",
  },
};

/** What the model made of the turn on show: its tone, and each measured signal. */
export function ResultsPanel() {
  const reading = usePerceptionStore((state) => state.reading);
  const status = useSessionStatus();
  const working = WORKING[status];
  const signals = reading?.signals;
  const tones = tonesOf(signals);
  return (
    <section
      aria-label={LABEL}
      aria-busy={working !== undefined}
      className="relative min-w-0"
    >
      <div className={cn("flex flex-col gap-frame", working?.pulse)}>
        <ToneHeadline tone={tones?.[0]?.label} readingId={reading?.id} />
        <TonePanels tones={tones} />
        <hr className="border-border/60" />
        <div className="grid grid-cols-4 gap-frame-sm">
          {MEASURES.map((measure) => (
            <DotGauge
              key={measure.name}
              measure={measure}
              value={valueOf(signals, measure.name)}
            />
          ))}
        </div>
      </div>
      {/* The header's status line is what assistive technology is told. */}
      {working ? (
        <p
          aria-hidden="true"
          className={cn(
            "pointer-events-none absolute inset-0 flex items-center justify-center font-display text-headline leading-none font-black tracking-widest uppercase",
            working.wordPulse,
          )}
        >
          {working.word}
        </p>
      ) : null}
    </section>
  );
}
