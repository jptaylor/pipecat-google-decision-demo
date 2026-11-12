import { create } from "zustand";

import {
  isServerMessage,
  type ServerMessage,
  type Session,
  type SignalReading,
} from "@/types/perception";

/** What the pipeline is doing with the audio it hears. */
export type Phase = "idle" | "hearing" | "reading";

export interface Reading {
  signals: SignalReading[];
  readMs: number;
  audioSecs: number;
}

interface PerceptionState {
  session: Session | null;
  phase: Phase;
  /** The clip being played, if any. */
  activeClipId: string | null;
  /** The clip played last, which Play plays again. */
  lastClipId: string | null;
  /** Where the turn on show came from: a clip's id, null for the microphone, undefined before any turn. */
  turnClipId: string | null | undefined;
  /** What the model made of the turn on show, once it has answered. */
  reading: Reading | null;
  /** Whether the latest read came to nothing. */
  hasFailed: boolean;
  /** Why a session couldn't be started. */
  connectionError: string | null;

  receive: (data: unknown) => void;
  setConnectionError: (error: string | null) => void;
  sessionEnded: () => void;
}

function apply(
  state: PerceptionState,
  message: ServerMessage,
): Partial<PerceptionState> {
  switch (message.type) {
    case "session":
      return {
        session: {
          model: message.model,
          clips: message.clips,
          maxSecs: message.maxSecs,
        },
      };
    case "clip-started":
      return { activeClipId: message.clipId, lastClipId: message.clipId };
    case "clip-finished":
      return state.activeClipId === message.clipId
        ? { activeClipId: null }
        : {};
    case "speech-started":
      // A new turn: the last one's reading makes way for it.
      return {
        phase: "hearing",
        turnClipId: message.clipId,
        reading: null,
        hasFailed: false,
      };
    case "speech-stopped":
      return { phase: "reading" };
    case "reading":
      return {
        turnClipId: message.clipId,
        reading: {
          signals: message.signals,
          readMs: message.readMs,
          audioSecs: message.audioSecs,
        },
        // Speech that started while this was being read is still being heard.
        phase: state.phase === "hearing" ? "hearing" : "idle",
      };
    case "reading-failed":
      return {
        hasFailed: true,
        phase: state.phase === "hearing" ? "hearing" : "idle",
      };
  }
}

export const usePerceptionStore = create<PerceptionState>()((set) => ({
  session: null,
  phase: "idle",
  activeClipId: null,
  lastClipId: null,
  turnClipId: undefined,
  reading: null,
  hasFailed: false,
  connectionError: null,

  receive: (data) => {
    if (isServerMessage(data)) {
      set((state) => apply(state, data));
    }
  },
  setConnectionError: (connectionError) => set({ connectionError }),
  // The last reading stays on the page after a session ends; only what was live is cleared.
  sessionEnded: () => set({ phase: "idle", activeClipId: null }),
}));
