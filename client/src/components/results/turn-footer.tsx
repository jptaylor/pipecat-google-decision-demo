import { useShallow } from "zustand/react/shallow";

import { usePerceptionStore } from "@/stores/perception-store";

const MICROPHONE = "Microphone";
const CLIP = "Clip";

/** What the turn on show is, and the model that read it. */
export function TurnFooter() {
  const { session, turnClipId } = usePerceptionStore(
    useShallow((state) => ({
      session: state.session,
      turnClipId: state.turnClipId,
    })),
  );
  const clip = session?.clips.find((candidate) => candidate.id === turnClipId);
  const source =
    turnClipId === undefined
      ? null
      : clip
        ? `${CLIP} · ${clip.mood} · ${clip.voice}`
        : MICROPHONE;

  return (
    <footer className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2 text-xs font-medium tracking-widest text-muted-foreground uppercase">
      <span>{source}</span>
      {session ? <span>{session.model}</span> : null}
    </footer>
  );
}
