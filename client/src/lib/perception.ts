import type { LabelConfidence, SignalReading } from "@/types/perception";

/**
 * The signals the page lays out, by the names the bot asks for them under
 * (server/perception.py). A change to the bot's questions is a change here.
 */
const TONE_SIGNAL = "tone";

/** The tones the model chooses between, in the order their bars are drawn. */
export const TONES = ["positive", "neutral", "sad", "frustrated"] as const;
export type Tone = (typeof TONES)[number];

export interface Measure {
  name: string;
  title: string;
  /** The top of its scale. A scale that tops out at 1 is shown as a percentage. */
  max: number;
  unit?: string;
}

/** The measured signals, in the order they're shown. */
export const MEASURES: readonly Measure[] = [
  { name: "sarcasm", title: "Sarcasm", max: 1 },
  { name: "laughter", title: "Laughter", max: 1 },
  { name: "arousal", title: "Energy", max: 1 },
  { name: "speech_rate", title: "Pace", max: 9, unit: "syl/s" },
];

const PERCENT = "%";

export function isTone(label: string | undefined): label is Tone {
  return TONES.some((tone) => tone === label);
}

/** How likely each tone is in a reading, likeliest first, or undefined if it has none. */
export function tonesOf(
  signals: SignalReading[] | undefined,
): LabelConfidence[] | undefined {
  const tone = signals?.find((signal) => signal.name === TONE_SIGNAL);
  return tone && "labels" in tone ? tone.labels : undefined;
}

/** A measured signal's value in a reading, or undefined if it has none. */
export function valueOf(
  signals: SignalReading[] | undefined,
  name: string,
): number | undefined {
  const signal = signals?.find((candidate) => candidate.name === name);
  return signal && "value" in signal ? signal.value : undefined;
}

/** A value as the page shows it: its figure, its unit, and how much of its bar it fills. */
export interface Figure {
  text: string;
  unit: string;
  fraction: number;
}

export function figureFor(measure: Measure, value: number): Figure {
  const fraction = Math.min(Math.max(value / measure.max, 0), 1);
  return measure.max === 1
    ? { text: String(Math.round(fraction * 100)), unit: PERCENT, fraction }
    : { text: value.toFixed(1), unit: measure.unit ?? "", fraction };
}

export function percent(confidence: number): string {
  return `${Math.round(confidence * 100)}${PERCENT}`;
}
