import { useShallow } from "zustand/react/shallow";

import { latencyText } from "@/lib/perception";
import { usePerceptionStore } from "@/stores/perception-store";

const MICROPHONE = "Microphone";
const CLIP = "Clip";
const READ_IN = "Read in";

/** What the turn on show is, the model that read it, and how long the read took. */
export function TurnFooter() {
  const { session, turnClipId, reading } = usePerceptionStore(
    useShallow((state) => ({
      session: state.session,
      turnClipId: state.turnClipId,
      reading: state.reading,
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
      <span className="flex gap-x-6">
        {reading ? (
          <span>
            {READ_IN} {latencyText(reading.readMs)}
          </span>
        ) : null}
        {session ? <span>{session.model}</span> : null}
      </span>
    </footer>
  );
}
