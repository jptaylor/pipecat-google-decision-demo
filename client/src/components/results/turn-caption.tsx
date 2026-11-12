import { useShallow } from "zustand/react/shallow";

import { usePerceptionStore } from "@/stores/perception-store";

const MICROPHONE = "Microphone";
const CLIP = "Clip";

/** What the turn on show is: a clip, by how it was said and who says it, or the microphone. */
export function TurnCaption() {
  const { clips, turnClipId } = usePerceptionStore(
    useShallow((state) => ({
      clips: state.session?.clips,
      turnClipId: state.turnClipId,
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
    <p className="min-h-4 text-xs font-medium tracking-widest text-muted-foreground uppercase">
      {source}
    </p>
  );
}
