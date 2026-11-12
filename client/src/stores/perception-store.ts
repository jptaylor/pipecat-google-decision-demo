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
  /** Counts up with each reading, so the page can tell a new one from the last. */
  id: number;
  signals: SignalReading[];
  readMs: number;
  audioSecs: number;
}

interface PerceptionState {
  session: Session | null;
  phase: Phase;
  /** The clip being played, if any. */
  activeClipId: string | null;
  /** The clip played last, which a random pick leaves out. */
  lastClipId: string | null;
  /** How many clips have been started, so each one's progress ring starts afresh. */
  clipCount: number;
  /** Whether Play is running through the clips, one after another. */
  isCycling: boolean;
  /** The clips still to come in this pass through them all, in the order they'll play. */
  clipQueue: string[];
  /** Where the turn on show came from: a clip's id, null for the microphone, undefined before any turn. */
  turnClipId: string | null | undefined;
  /** How many readings there have been. */
  readingCount: number;
  /** What the model made of the turn on show, once it has answered. */
  reading: Reading | null;
  /** Whether the latest read came to nothing. */
  hasFailed: boolean;
  /** Why a session couldn't be started. */
  connectionError: string | null;

  receive: (data: unknown) => void;
  setCycling: (isCycling: boolean) => void;
  /** The next clip of the pass, or undefined before the clips are known. A new pass is shuffled afresh. */
  takeNextClip: () => string | undefined;
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
      return {
        activeClipId: message.clipId,
        lastClipId: message.clipId,
        clipCount: state.clipCount + 1,
      };
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
          id: state.readingCount + 1,
          signals: message.signals,
          readMs: message.readMs,
          audioSecs: message.audioSecs,
        },
        readingCount: state.readingCount + 1,
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

/** The ids in a random order, which doesn't open with the clip just played when there is another. */
function shuffled(ids: string[], lastClipId: string | null): string[] {
  const order = [...ids];
  for (let index = order.length - 1; index > 0; index--) {
    const other = Math.floor(Math.random() * (index + 1));
    // Both are within the list: this is the Fisher-Yates swap.
    [order[index], order[other]] = [order[other]!, order[index]!];
  }
  const first = order[0];
  if (first !== undefined && first === lastClipId && order.length > 1) {
    order.push(order.shift()!); // the list isn't empty: its first was just read
  }
  return order;
}

export const usePerceptionStore = create<PerceptionState>()((set, get) => ({
  session: null,
  phase: "idle",
  activeClipId: null,
  lastClipId: null,
  clipCount: 0,
  isCycling: false,
  clipQueue: [],
  readingCount: 0,
  turnClipId: undefined,
  reading: null,
  hasFailed: false,
  connectionError: null,

  receive: (data) => {
    if (isServerMessage(data)) {
      set((state) => apply(state, data));
    }
  },
  setCycling: (isCycling) => set({ isCycling }),
  takeNextClip: () => {
    const { clipQueue, lastClipId, session } = get();
    const queue =
      clipQueue.length > 0
        ? clipQueue
        : shuffled(session?.clips.map((clip) => clip.id) ?? [], lastClipId);
    const [next, ...rest] = queue;
    set({ clipQueue: rest });
    return next;
  },
  setConnectionError: (connectionError) => set({ connectionError }),
  // The last reading stays on the page after a session ends; only what was live is cleared.
  sessionEnded: () =>
    set({ phase: "idle", activeClipId: null, isCycling: false }),
}));
