import { RTVIEvent } from "@pipecat-ai/client-js";
import { useRTVIClientEvent } from "@pipecat-ai/client-react";
import { useEffect } from "react";

import { usePerceptionStore } from "@/stores/perception-store";

/**
 * How long a turn waits for its reading. A reading arrives on the turn's
 * final transcription, so speech with no words in it, or a read that fails
 * before any are transcribed, is never answered.
 */
const READING_TIMEOUT_MS = 6000;

/**
 * Feeds the bot's messages into the perception store: Pipecat's own events
 * for the user's turns, their words and readings, and the time a read took,
 * and the demo's server messages for the session and its clips. Mount once,
 * under the client provider.
 */
export function usePerceptionEvents(): void {
  const receive = usePerceptionStore((state) => state.receive);
  const turnStarted = usePerceptionStore((state) => state.turnStarted);
  const turnStopped = usePerceptionStore((state) => state.turnStopped);
  const heard = usePerceptionStore((state) => state.heard);
  const measured = usePerceptionStore((state) => state.measured);
  const readingTimedOut = usePerceptionStore((state) => state.readingTimedOut);
  const sessionEnded = usePerceptionStore((state) => state.sessionEnded);
  useRTVIClientEvent(RTVIEvent.ServerMessage, receive);
  useRTVIClientEvent(RTVIEvent.UserStartedSpeaking, turnStarted);
  useRTVIClientEvent(RTVIEvent.UserStoppedSpeaking, turnStopped);
  useRTVIClientEvent(RTVIEvent.UserInput, heard);
  useRTVIClientEvent(RTVIEvent.Metrics, measured);
  useRTVIClientEvent(RTVIEvent.Disconnected, sessionEnded);

  const isReading = usePerceptionStore((state) => state.phase === "reading");
  const turn = usePerceptionStore((state) => state.turn);
  useEffect(() => {
    if (!isReading) return;
    const timeout = setTimeout(readingTimedOut, READING_TIMEOUT_MS);
    return () => clearTimeout(timeout);
  }, [isReading, turn, readingTimedOut]);
}
