/** The demo's own messages from the bot, sent as RTVI server messages (see server/reporter.py). */

export interface ClipInfo {
  id: string;
  mood: string;
  voice: string;
  text: string;
  duration: number;
}

export interface Session {
  model: string;
  clips: ClipInfo[];
  maxSecs: number;
}

export interface LabelConfidence {
  label: string;
  confidence: number;
}

/** One signal of a reading: a choice's labels, likeliest first, or a value. */
export type SignalReading =
  { name: string; labels: LabelConfidence[] } | { name: string; value: number };

export type ServerMessage =
  | ({ type: "session" } & Session)
  | { type: "clip-started"; clipId: string }
  | { type: "clip-finished"; clipId: string; completed: boolean }
  | { type: "speech-started"; clipId: string | null }
  | { type: "speech-stopped"; clipId: string | null }
  | {
      type: "reading";
      clipId: string | null;
      signals: SignalReading[];
      readMs: number;
      audioSecs: number;
    }
  | { type: "reading-failed"; clipId: string | null; reason: string };

const MESSAGE_TYPES: ReadonlySet<string> = new Set<ServerMessage["type"]>([
  "session",
  "clip-started",
  "clip-finished",
  "speech-started",
  "speech-stopped",
  "reading",
  "reading-failed",
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
