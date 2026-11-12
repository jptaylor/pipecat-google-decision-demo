import { RTVIEvent } from "@pipecat-ai/client-js";
import { useRTVIClientEvent } from "@pipecat-ai/client-react";

import { usePerceptionStore } from "@/stores/perception-store";

/** Feeds the bot's messages into the perception store. Mount once, under the client provider. */
export function usePerceptionEvents(): void {
  const receive = usePerceptionStore((state) => state.receive);
  const sessionEnded = usePerceptionStore((state) => state.sessionEnded);
  useRTVIClientEvent(RTVIEvent.ServerMessage, receive);
  useRTVIClientEvent(RTVIEvent.Disconnected, sessionEnded);
}
