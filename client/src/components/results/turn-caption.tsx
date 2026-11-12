import { useShallow } from "zustand/react/shallow";

import { usePerceptionStore } from "@/stores/perception-store";

const MICROPHONE = "Microphone";
const CLIP = "Clip";
const AUDIO_SUFFIX = "s of audio";

/** What the turn on show is, a clip by how it was said and who says it or the microphone, and how much of it the model heard. */
export function TurnCaption() {
  const { clips, turnClipId, audioSecs } = usePerceptionStore(
    useShallow((state) => ({
      clips: state.session?.clips,
      turnClipId: state.turnClipId,
      audioSecs: state.reading?.audioSecs,
    })),
  );
  const clip = clips?.find((candidate) => candidate.id === turnClipId);
  const source =
    turnClipId === undefined
      ? null
      : clip
        ? `${CLIP} · ${clip.mood} · ${clip.sincerity} · ${clip.voice}`
        : MICROPHONE;

  return (
    <p className="flex min-h-4 justify-between gap-6 text-xs font-medium tracking-widest text-muted-foreground uppercase">
      <span className="truncate">{source}</span>
      {audioSecs === undefined ? null : (
        <span className="shrink-0">
          {audioSecs.toFixed(1)} {AUDIO_SUFFIX}
        </span>
      )}
    </p>
  );
}
