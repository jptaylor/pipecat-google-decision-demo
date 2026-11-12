import {
  useMediaState,
  usePipecatClient,
  usePipecatClientMicControl,
} from "@pipecat-ai/client-react";

import { unlockBotAudio } from "@/components/pipecat/bot-audio";
import { ensureSession } from "@/lib/pipecat-client";
import { usePerceptionStore } from "@/stores/perception-store";
import type { ClipInfo } from "@/types/perception";

const START_FAILED = "Couldn't connect. Try again.";

/** A clip at random, and not the one played last when there is another. */
function randomClip(
  clips: ClipInfo[],
  lastClipId: string | null,
): string | undefined {
  const others = clips.filter((clip) => clip.id !== lastClipId);
  const pool = others.length > 0 ? others : clips;
  return pool[Math.floor(Math.random() * pool.length)]?.id;
}

interface SessionControls {
  /** Stops the clip playing, or plays one at random. */
  toggleClip: () => void;
  /** Plays another clip at random, in place of any clip playing. */
  nextClip: () => void;
  /** Plays the clip of that id. */
  playClip: (clipId: string) => void;
  /** Turns the microphone on or off. Turning it on stops any clip playing. */
  toggleMic: () => void;
  isClipPlaying: boolean;
  /** Whether the microphone is on and being heard. */
  isMicOn: boolean;
  /** Whether the browser refused the microphone, or has none. */
  isMicUnavailable: boolean;
}

/**
 * What a visitor can do. Each one starts a session first if there isn't one,
 * and a clip and the microphone are never heard together.
 */
export function useSessionControls(): SessionControls {
  const client = usePipecatClient();
  const { enableMic, isMicEnabled } = usePipecatClientMicControl();
  const isMicUnavailable = useMediaState().mic.state === "error";
  // A microphone that failed to open is asked for but isn't on: pressing again retries it.
  const isMicOn = isMicEnabled && !isMicUnavailable;
  const isClipPlaying = usePerceptionStore(
    (state) => state.activeClipId !== null,
  );
  const setConnectionError = usePerceptionStore(
    (state) => state.setConnectionError,
  );

  /** Runs an action once a session is up. */
  const inSession = (action: () => void) => {
    if (!client) return;
    // Inside the tap, so browsers let the clips be heard later.
    unlockBotAudio();
    setConnectionError(null);
    ensureSession(client).then(action, () => setConnectionError(START_FAILED));
  };

  /** Plays a clip: the one named, or one at random. */
  const play = (clipId?: string) => {
    inSession(() => {
      enableMic(false);
      // The clips are known once the session is: read now, not when the button was drawn.
      const { session, lastClipId } = usePerceptionStore.getState();
      const chosen = clipId ?? randomClip(session?.clips ?? [], lastClipId);
      // With no clip named, the bot plays the next one in its own list.
      client?.sendClientMessage(
        "play-clip",
        chosen ? { clipId: chosen } : undefined,
      );
    });
  };

  return {
    toggleClip: () => {
      if (isClipPlaying) {
        client?.sendClientMessage("stop-clip");
        return;
      }
      play();
    },
    nextClip: () => play(),
    playClip: play,
    toggleMic: () => {
      if (isMicOn) {
        enableMic(false);
        return;
      }
      inSession(() => {
        client?.sendClientMessage("stop-clip");
        enableMic(true);
      });
    },
    isClipPlaying,
    isMicOn,
    isMicUnavailable,
  };
}
