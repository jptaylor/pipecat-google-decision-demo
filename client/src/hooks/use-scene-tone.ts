import { useSessionStatus } from "@/hooks/use-session-status";
import { isTone, type Tone, tonesOf } from "@/lib/perception";
import { usePerceptionStore } from "@/stores/perception-store";

/** What colours the page: the tone of the reading on show, or that a turn is in progress. */
export type SceneTone = Tone | "listening";

/**
 * The colour the page and the pill are in. A turn being heard or read has its
 * own, so the neutral it starts from and a reading of "neutral" aren't lost in
 * each other; then the reading's tone takes over.
 */
export function useSceneTone(): SceneTone {
  const status = useSessionStatus();
  const tone = usePerceptionStore(
    (state) => tonesOf(state.reading?.signals)?.[0]?.label,
  );
  if (status === "hearing" || status === "reading") return "listening";
  return isTone(tone) ? tone : "neutral";
}
