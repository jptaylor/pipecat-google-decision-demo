import { DotMeter } from "@/components/results/dot-meter";
import { figureFor, type Measure } from "@/lib/perception";
import { cn } from "@/lib/utils";

const EMPTY = "--";

interface MeasureTileProps {
  measure: Measure;
  /** The signal's value in the reading on show, or undefined when there is none. */
  value: number | undefined;
}

/** One measured signal: its name, its big figure and a bar of where it falls. */
export function MeasureTile({ measure, value }: MeasureTileProps) {
  const figure = value === undefined ? null : figureFor(measure, value);
  return (
    <article className="flex min-w-0 flex-col gap-1.5">
      <span className="text-xs font-medium tracking-widest text-muted-foreground uppercase">
        {measure.title}
      </span>
      <span className="flex items-baseline gap-2">
        <span
          className={cn(
            "font-display text-figure leading-none font-black tracking-tight",
            !figure && "text-muted-foreground/40",
          )}
        >
          {figure?.text ?? EMPTY}
        </span>
        {figure?.unit ? (
          <span className="text-base font-medium text-muted-foreground">
            {figure.unit}
          </span>
        ) : null}
      </span>
      <DotMeter
        fraction={figure?.fraction ?? null}
        label={measure.title}
        valueText={figure ? `${figure.text} ${figure.unit}` : undefined}
      />
    </article>
  );
}
