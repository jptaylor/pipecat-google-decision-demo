import { cn } from "@/lib/utils";

const DOTS = 16;

interface DotMeterProps {
  /** How much of the bar is lit, from 0 to 1, or null when there is nothing to show. */
  fraction: number | null;
  /** What the bar measures, for assistive technology. */
  label: string;
  /** The value as it is read out, such as "89%". */
  valueText?: string;
  /** The fill of a lit dot. */
  fill?: string;
  className?: string;
}

/** A bar made of dots, lit in proportion to a value: the display font's own grain. */
export function DotMeter({
  fraction,
  label,
  valueText,
  fill = "bg-meter",
  className,
}: DotMeterProps) {
  const lit = fraction === null ? 0 : Math.round(fraction * DOTS);
  return (
    <div
      role="meter"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round((fraction ?? 0) * 100)}
      aria-valuetext={valueText}
      className={cn(
        "grid auto-cols-fr grid-flow-col gap-1 sm:gap-1.5",
        className,
      )}
    >
      {Array.from({ length: DOTS }, (_, index) => (
        <span
          // The dots never reorder, so their position identifies them.
          key={index}
          className={cn(
            "aspect-square rounded-full transition-colors delay-stagger duration-300 motion-reduce:transition-none",
            index < lit ? fill : "bg-meter-track",
          )}
        />
      ))}
    </div>
  );
}
