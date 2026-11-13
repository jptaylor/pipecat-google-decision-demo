/**
 * The demo's own messages from the bot, sent as RTVI server messages: the
 * session and its clips (server/bot.py, server/clips.py). The turns, their
 * words, their readings and how long a read took all come from Pipecat's own
 * RTVI events.
 */

export interface ClipInfo {
  id: string;
  mood: string;
  /** Whether it was meant: "sincere" or "sarcastic". */
  sincerity: string;
  voice: string;
  text: string;
  duration: number;
}

export interface Session {
  model: string;
  clips: ClipInfo[];
  maxSecs: number;
}

export type ServerMessage =
  | ({ type: "session" } & Session)
  | { type: "clip-started"; clipId: string }
  | { type: "clip-finished"; clipId: string; completed: boolean };

const MESSAGE_TYPES: ReadonlySet<string> = new Set<ServerMessage["type"]>([
  "session",
  "clip-started",
  "clip-finished",
]);

/** Whether a server message is one of the demo's. The bot is the only sender, so its shape is taken on trust. */
export function isServerMessage(data: unknown): data is ServerMessage {
  return (
    typeof data === "object" &&
    data !== null &&
    "type" in data &&
    typeof data.type === "string" &&
    MESSAGE_TYPES.has(data.type)
  );
}
