import {
  MicIcon,
  MicOffIcon,
  PlayIcon,
  SkipForwardIcon,
  SquareIcon,
} from "lucide-react";

import { ClipPicker } from "@/components/controls/clip-picker";
import { Button } from "@/components/ui/button";
import { useSessionControls } from "@/hooks/use-session-controls";
import { useSessionStatus } from "@/hooks/use-session-status";
import { usePerceptionStore } from "@/stores/perception-store";

const PLAY = "Play a clip at random";
const STOP = "Stop the clip";
const NEXT = "Play another clip at random";
const MIC_ON = "Turn on the microphone";
const MIC_OFF = "Turn off the microphone";
const MIC_UNAVAILABLE = "The microphone is unavailable. Check its permission.";

const BUTTON_CLASSES =
  "size-control rounded-full [&_svg:not([class*='size-'])]:size-6";

/** The demo's controls: play a clip at random or pick one, move on to another, or open the microphone. */
export function SessionControls() {
  const {
    toggleClip,
    nextClip,
    toggleMic,
    isClipPlaying,
    isMicOn,
    isMicUnavailable,
  } = useSessionControls();
  const isConnecting = useSessionStatus() === "connecting";
  const connectionError = usePerceptionStore((state) => state.connectionError);
  const error = connectionError ?? (isMicUnavailable ? MIC_UNAVAILABLE : null);

  return (
    <div className="flex flex-col items-center gap-frame-sm">
      <div className="flex items-center gap-4">
        <Button
          variant={isClipPlaying ? "default" : "outline"}
          size="icon-lg"
          disabled={isConnecting}
          aria-label={isClipPlaying ? STOP : PLAY}
          onClick={toggleClip}
          className={BUTTON_CLASSES}
        >
          {isClipPlaying ? (
            <SquareIcon className="fill-current" />
          ) : (
            <PlayIcon className="fill-current" />
          )}
        </Button>
        <Button
          variant="outline"
          size="icon-lg"
          disabled={isConnecting}
          aria-label={NEXT}
          onClick={nextClip}
          className={BUTTON_CLASSES}
        >
          <SkipForwardIcon className="fill-current" />
        </Button>
        <Button
          variant={isMicOn ? "default" : "outline"}
          size="icon-lg"
          disabled={isConnecting}
          aria-pressed={isMicOn}
          aria-label={isMicOn ? MIC_OFF : MIC_ON}
          onClick={toggleMic}
          className={BUTTON_CLASSES}
        >
          {isMicOn ? <MicIcon /> : <MicOffIcon />}
        </Button>
      </div>
      <ClipPicker />
      {error ? (
        <p role="alert" className="text-center text-sm text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}
