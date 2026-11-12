import { cn } from "@/lib/utils";

const TITLE = "Tone";
const EMPTY = "--";
/** How long after the letter before it each letter of the tone's name comes in. */
const LETTER_STAGGER_MS = 45;

interface ToneHeadlineProps {
  /** The likeliest tone of the reading on show, or undefined when there is none. */
  tone: string | undefined;
  /** The reading's number, so a new reading brings its name in afresh. */
  readingId: number | undefined;
}

/** The tone the model heard, as the page's headline, in that tone's colour. */
export function ToneHeadline({ tone, readingId }: ToneHeadlineProps) {
  const word = tone ?? EMPTY;
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs font-medium tracking-widest text-muted-foreground uppercase">
        {TITLE}
      </span>
      <h2
        aria-label={tone ?? undefined}
        className="font-display text-headline leading-none font-black tracking-tight uppercase"
      >
        <span
          key={readingId}
          aria-hidden={tone ? "true" : undefined}
          className={cn("flex", tone ? "text-tone-now" : "opacity-30")}
        >
          {[...word].map((letter, index) => (
            <span
              // The letters of one word never reorder.
              key={index}
              className={cn(
                tone && "animate-letter-in motion-reduce:animate-none",
              )}
              // Each letter follows the one before it.
              style={{ animationDelay: `${index * LETTER_STAGGER_MS}ms` }}
            >
              {letter}
            </span>
          ))}
        </span>
      </h2>
    </div>
  );
}
