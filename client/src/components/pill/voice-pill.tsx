import { RTVIEvent } from "@pipecat-ai/client-js";
import {
  usePipecatClientMediaTrack,
  useRTVIClientEvent,
} from "@pipecat-ai/client-react";
import { useRef } from "react";

import type { Mood } from "@/components/pill/webgl-pill/mood";
import type { MotionMode } from "@/components/pill/webgl-pill/motion";
import { Pill, type PillHandle } from "@/components/pill/webgl-pill/Pill";
import { useSessionControls } from "@/hooks/use-session-controls";
import {
  type SessionStatus,
  useSessionStatus,
} from "@/hooks/use-session-status";
import { isTone, tonesOf } from "@/lib/perception";
import { cn } from "@/lib/utils";
import { usePerceptionStore } from "@/stores/perception-store";
import { isServerMessage } from "@/types/perception";

const LABEL = "Voice indicator";
const UNSUPPORTED = "This browser can't draw the pill.";

/** How the pill carries itself through a turn: it turns over while a session or a reading is on its way. */
const MOTION: Record<SessionStatus, MotionMode> = {
  offline: "auto",
  connecting: "spinning",
  ready: "auto",
  hearing: "listening",
  reading: "spinning",
  failed: "auto",
};

interface VoicePillProps {
  className?: string;
}

/**
 * The glass pill, following the turn: its light moves with the voice being
 * heard, it turns over while the model reads, and it takes the colour of the
 * tone the model heard, with a pulse as the reading lands.
 */
export function VoicePill({ className }: VoicePillProps) {
  // The pill's imperative handle, for the pulse.
  const pill = useRef<PillHandle>(null);
  const status = useSessionStatus();
  const isClipPlaying = usePerceptionStore(
    (state) => state.activeClipId !== null,
  );
  const tone = usePerceptionStore(
    (state) => tonesOf(state.reading?.signals)?.[0]?.label,
  );
  const { isMicOn } = useSessionControls();
  const clipTrack = usePipecatClientMediaTrack("audio", "bot");
  const micTrack = usePipecatClientMediaTrack("audio", "local");

  useRTVIClientEvent(RTVIEvent.ServerMessage, (data: unknown) => {
    if (isServerMessage(data) && data.type === "reading") {
      pill.current?.pulse();
    }
  });

  // A turn not read yet has no tone: the pill waits in its neutral colour.
  const mood: Mood = isTone(tone) ? tone : "neutral";
  const voice = isClipPlaying ? clipTrack : isMicOn ? micTrack : null;

  return (
    <Pill
      ref={pill}
      mood={mood}
      motion={MOTION[status]}
      audio={voice}
      aria-label={LABEL}
      fallback={
        <p className="flex size-full items-center justify-center text-sm text-muted-foreground">
          {UNSUPPORTED}
        </p>
      }
      className={cn("aspect-square w-full", className)}
    />
  );
}
