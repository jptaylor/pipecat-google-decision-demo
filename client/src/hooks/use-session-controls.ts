import {
  useMediaState,
  usePipecatClient,
  usePipecatClientMicControl,
} from "@pipecat-ai/client-react";

import { unlockBotAudio } from "@/components/pipecat/bot-audio";
import { ensureSession } from "@/lib/pipecat-client";
import { usePerceptionStore } from "@/stores/perception-store";

const START_FAILED = "Couldn't connect. Try again.";

interface SessionControls {
  /** Plays the next clip, or stops the one playing. */
  toggleClip: () => void;
  /** Turns the microphone on or off. Turning it on stops any clip playing. */
  toggleMic: () => void;
  isClipPlaying: boolean;
  /** Whether the microphone is on and being heard. */
  isMicOn: boolean;
  /** Whether the browser refused the microphone, or has none. */
  isMicUnavailable: boolean;
}

/**
 * The two things a visitor can do. Either one starts a session first if there
 * isn't one, and a clip and the microphone are never heard together.
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

  return {
    toggleClip: () => {
      if (isClipPlaying) {
        client?.sendClientMessage("stop-clip");
        return;
      }
      inSession(() => {
        enableMic(false);
        client?.sendClientMessage("play-clip");
      });
    },
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
