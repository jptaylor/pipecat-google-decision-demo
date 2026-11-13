import { useEffect, useRef } from "react";

import { ClipRing } from "@/components/pill/clip-ring";
import type { Mood } from "@/components/pill/webgl-pill/mood";
import type { MotionMode } from "@/components/pill/webgl-pill/motion";
import { Pill, type PillHandle } from "@/components/pill/webgl-pill/Pill";
import { useHeardVoice } from "@/hooks/use-heard-voice";
import { useSceneTone } from "@/hooks/use-scene-tone";
import {
  type SessionStatus,
  useSessionStatus,
} from "@/hooks/use-session-status";
import { cn } from "@/lib/utils";
import { usePerceptionStore } from "@/stores/perception-store";

const LABEL = "Voice indicator";
const UNSUPPORTED = "This browser can't draw the pill.";

/** How the pill is set up for this page. */
const PILL_SETTINGS = {
  // The pill is drawn on a canvas that reaches past its place on the page, so
  // its glow has room to fade out: this is how much of that canvas the pill
  // itself takes, which leaves it a little smaller than its place, with the
  // clip ring round it.
  fill: 0.5,
  // Idle, it goes on turning slowly and never comes to rest, so a spin winds
  // down into that turn instead of snapping home.
  idleTurnSeconds: 20,
  restAfter: Number.POSITIVE_INFINITY,
  // The pointer only nudges it.
  pointerTilt: 5,
};

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
 * heard, it is violet while the turn is heard and turns over while the model
 * reads, and it takes the colour of the tone the model heard, with a pulse as
 * the reading lands.
 */
export function VoicePill({ className }: VoicePillProps) {
  // The pill's imperative handle, for the pulse.
  const pill = useRef<PillHandle>(null);
  const status = useSessionStatus();
  const isClipPlaying = usePerceptionStore(
    (state) => state.activeClipId !== null,
  );
  const tone = useSceneTone();
  const voice = useHeardVoice();

  const readingId = usePerceptionStore((state) => state.reading?.id);

  // The pill is drawn outside React, so a new reading is passed on to it here.
  useEffect(() => {
    if (readingId !== undefined) {
      pill.current?.pulse();
    }
  }, [readingId]);

  // Zinc at rest and for a neutral reading, violet while a turn is heard and read, then the tone's own.
  const mood: Mood = tone === "listening" ? "violet" : tone;

  return (
    <div className={cn("relative shrink-0", className)}>
      <div aria-hidden="true" className="absolute pill-bed" />
      <ClipRing />
      {/* Larger than its place, and faded out towards its edge, so the glow
          is never cut off square. The pill sets its own box to fill this one. */}
      <div className="absolute -inset-1/5 mask-radial-from-70% mask-radial-to-100% mask-radial-closest-side">
        <Pill
          ref={pill}
          mood={mood}
          motion={MOTION[status]}
          audio={voice}
          // It holds still for a clip, rather than turning after the pointer.
          interactive={!isClipPlaying}
          settings={PILL_SETTINGS}
          aria-label={LABEL}
          fallback={
            <p className="flex size-full items-center justify-center text-sm text-muted-foreground">
              {UNSUPPORTED}
            </p>
          }
          className="size-full"
        />
      </div>
    </div>
  );
}
