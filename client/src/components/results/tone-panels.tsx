import { percent, type Tone, TONES } from "@/lib/perception";
import { cn } from "@/lib/utils";
import type { LabelConfidence } from "@/types/perception";

const TITLE = "Tone";
const EMPTY = "--";
const COLUMNS = 8;
const ROWS = 6;
const DOTS = COLUMNS * ROWS;

/** Each tone's lit dots, and its panel when it is the likeliest. */
const TONE_STYLES: Record<Tone, { dot: string; top: string }> = {
  positive: {
    dot: "bg-tone-positive",
    top: "border-tone-positive/45 bg-tone-positive/10",
  },
  neutral: {
    dot: "bg-tone-neutral",
    top: "border-tone-neutral/45 bg-tone-neutral/10",
  },
  sad: {
    dot: "bg-tone-sad",
    top: "border-tone-sad/45 bg-tone-sad/10",
  },
  frustrated: {
    dot: "bg-tone-frustrated",
    top: "border-tone-frustrated/45 bg-tone-frustrated/10",
  },
};

/** The grid's dots in the order they're drawn, each with its place in the order they light: bottom row first. */
const GRID = Array.from({ length: DOTS }, (_, drawn) => {
  const row = Math.floor(drawn / COLUMNS);
  return (ROWS - 1 - row) * COLUMNS + (drawn % COLUMNS);
});

interface TonePanelsProps {
  /** How likely each tone is, likeliest first, or undefined when there is no reading. */
  tones: LabelConfidence[] | undefined;
}

/** A panel a tone: how likely the model made it, as a figure and a grid of dots that fills from the bottom. */
export function TonePanels({ tones }: TonePanelsProps) {
  const likeliest = tones?.[0]?.label;
  return (
    <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
      {TONES.map((tone) => {
        const confidence = tones?.find(
          (candidate) => candidate.label === tone,
        )?.confidence;
        const lit =
          confidence === undefined
            ? 0
            : Math.max(confidence > 0 ? 1 : 0, Math.round(confidence * DOTS));
        const isTop = tone === likeliest;
        const value = confidence === undefined ? null : percent(confidence);
        return (
          <li
            key={tone}
            className={cn(
              "flex min-w-0 flex-col gap-3 rounded-2xl border p-3 transition-colors duration-500 sm:gap-4 sm:p-4",
              isTop ? TONE_STYLES[tone].top : "border-border bg-card/40",
            )}
          >
            <div className="flex flex-col gap-1">
              <span className="text-xs leading-none font-medium capitalize">
                {tone}
              </span>
              <span
                className={cn(
                  "font-display text-panel leading-none font-black",
                  !isTop && "opacity-55",
                )}
              >
                {value ?? EMPTY}
              </span>
            </div>
            <div
              role="meter"
              aria-label={`${TITLE}: ${tone}`}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.round((confidence ?? 0) * 100)}
              aria-valuetext={value ?? undefined}
              className="grid w-full max-w-dotgrid grid-cols-8 gap-1 sm:gap-1.5"
            >
              {GRID.map((order) => (
                <span
                  key={order}
                  className={cn(
                    "aspect-square rounded-full transition-[background-color,opacity] duration-500 motion-reduce:transition-none",
                    order < lit ? TONE_STYLES[tone].dot : "bg-meter-track",
                    order < lit && !isTop && "opacity-45",
                  )}
                />
              ))}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
