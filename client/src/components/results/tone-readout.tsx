import { DotMeter } from "@/components/results/dot-meter";
import { percent, type Tone, TONES } from "@/lib/perception";
import { cn } from "@/lib/utils";
import type { LabelConfidence } from "@/types/perception";

const TITLE = "Tone";
const EMPTY = "--";

/** Each tone's bar, in the colour the pill takes for it. */
const TONE_FILLS: Record<Tone, string> = {
  positive: "bg-tone-positive",
  neutral: "bg-tone-neutral",
  sad: "bg-tone-sad",
  frustrated: "bg-tone-frustrated",
};

interface ToneReadoutProps {
  /** How likely each tone is, likeliest first, or undefined when there is no reading. */
  tones: LabelConfidence[] | undefined;
}

/** How the voice sounds: the likeliest tone as the headline, and a bar for each. */
export function ToneReadout({ tones }: ToneReadoutProps) {
  const likeliest = tones?.[0]?.label;
  return (
    <article className="flex flex-col gap-8">
      <div className="flex flex-col gap-2">
        <span className="text-xs font-medium tracking-widest text-muted-foreground uppercase">
          {TITLE}
        </span>
        <span
          className={cn(
            "font-display text-5xl leading-none font-black tracking-tight uppercase sm:text-7xl 2xl:text-8xl",
            !likeliest && "text-muted-foreground/40",
          )}
        >
          {likeliest ?? EMPTY}
        </span>
      </div>
      <ul className="grid grid-cols-2 gap-x-6 gap-y-5 sm:gap-x-10">
        {TONES.map((tone) => {
          const confidence = tones?.find(
            (candidate) => candidate.label === tone,
          )?.confidence;
          const value = confidence === undefined ? null : percent(confidence);
          return (
            <li key={tone} className="flex min-w-0 flex-col gap-2">
              <span className="flex items-baseline justify-between gap-3">
                <span className="text-sm font-medium capitalize">{tone}</span>
                <span
                  className={cn(
                    "font-display text-xl leading-none font-black",
                    !value && "text-muted-foreground/40",
                  )}
                >
                  {value ?? EMPTY}
                </span>
              </span>
              <DotMeter
                fraction={confidence ?? null}
                label={`${TITLE}: ${tone}`}
                valueText={value ?? undefined}
                fill={TONE_FILLS[tone]}
              />
            </li>
          );
        })}
      </ul>
    </article>
  );
}
