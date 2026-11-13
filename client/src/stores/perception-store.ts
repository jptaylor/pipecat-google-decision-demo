import type {
  PipecatMetricsData,
  UserInputData,
  UserPerceptionSignal,
} from "@pipecat-ai/client-js";
import { create } from "zustand";

import { READER_PROCESSOR } from "@/lib/perception";
import {
  isServerMessage,
  type ServerMessage,
  type Session,
} from "@/types/perception";

/** What the pipeline is doing with the audio it hears: nothing, hearing a turn, or reading the turn just heard. */
export type Phase = "idle" | "hearing" | "reading";

export interface Reading {
  /** Counts up with each reading, so the page can tell a new one from the last. */
  id: number;
  /** The turn it is a reading of, by its number. */
  turn: number;
  signals: UserPerceptionSignal[];
  /** The turn's words, as transcribed. */
  text: string;
}

interface PerceptionState {
  session: Session | null;
  phase: Phase;
  /** How many turns the user has started. */
  turn: number;
  /** The clip being played, if any. */
  activeClipId: string | null;
  /** The clip played last, which the next one follows. */
  lastClipId: string | null;
  /** How many clips have been started, so each one's progress ring starts afresh. */
  clipCount: number;
  /** Whether Play is running through the clips, one after another. */
  isCycling: boolean;
  /** Where the turn on show came from: a clip's id, null for the microphone, undefined before any turn. */
  turnClipId: string | null | undefined;
  /** How many readings there have been. */
  readingCount: number;
  /** What the model made of the turn on show, once it has answered. */
  reading: Reading | null;
  /** How long the model took over its latest read, in milliseconds. */
  readMs: number | null;
  /** Whether the latest turn came to no reading. */
  hasFailed: boolean;
  /** Why a session couldn't be started. */
  connectionError: string | null;

  /** One of the demo's own messages arrived. */
  receive: (data: unknown) => void;
  /** The user, or a clip in their place, started speaking. */
  turnStarted: () => void;
  /** They stopped: the turn is being read. */
  turnStopped: () => void;
  /** Words of the user's arrived, the final ones with how they were said. */
  heard: (input: UserInputData) => void;
  /** The bot reported how long its services took. */
  measured: (metrics: PipecatMetricsData) => void;
  /** A turn's reading never came. */
  readingTimedOut: () => void;
  setCycling: (isCycling: boolean) => void;
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
  }
}

/** A final transcription: the turn's reading, or more words of a turn already read. */
function hear(
  state: PerceptionState,
  input: UserInputData,
): Partial<PerceptionState> {
  // Speech that started while this was being read is still being heard, and
  // this is a reading of the turn before it.
  const turn = state.phase === "hearing" ? state.turn - 1 : state.turn;
  const phase = state.phase === "hearing" ? "hearing" : "idle";
  const signals = input.perception;
  if (!signals?.length) {
    // Words that came with no reading: the model didn't answer in time, or failed.
    return state.reading?.turn === turn ? {} : { hasFailed: true, phase };
  }
  if (state.reading?.turn === turn) {
    // A long turn is transcribed in parts, each carrying the turn's one reading.
    const text = `${state.reading.text} ${input.text}`.trim();
    return { reading: { ...state.reading, signals, text } };
  }
  return {
    reading: {
      id: state.readingCount + 1,
      turn,
      signals,
      text: input.text.trim(),
    },
    readingCount: state.readingCount + 1,
    hasFailed: false,
    phase,
  };
}

export const usePerceptionStore = create<PerceptionState>()((set) => ({
  session: null,
  phase: "idle",
  turn: 0,
  activeClipId: null,
  lastClipId: null,
  clipCount: 0,
  isCycling: false,
  readingCount: 0,
  turnClipId: undefined,
  reading: null,
  readMs: null,
  hasFailed: false,
  connectionError: null,

  receive: (data) => {
    if (isServerMessage(data)) {
      set((state) => apply(state, data));
    }
  },
  // A new turn: the last one's reading makes way for it.
  turnStarted: () =>
    set((state) => ({
      phase: "hearing",
      turn: state.turn + 1,
      turnClipId: state.activeClipId,
      reading: null,
      hasFailed: false,
    })),
  turnStopped: () =>
    set((state) => (state.phase === "hearing" ? { phase: "reading" } : {})),
  heard: (input) => {
    if (input.input_type === "transcription" && input.final) {
      set((state) => hear(state, input));
    }
  },
  measured: (metrics) => {
    // The classifier's processing time is how long its read took. Other services report theirs too.
    const read = metrics.processing?.find((metric) =>
      metric.processor.startsWith(READER_PROCESSOR),
    );
    if (read) {
      set({ readMs: read.value * 1000 });
    }
  },
  readingTimedOut: () =>
    set((state) =>
      state.phase === "reading" ? { phase: "idle", hasFailed: true } : {},
    ),
  setCycling: (isCycling) => set({ isCycling }),
  setConnectionError: (connectionError) => set({ connectionError }),
  // The last reading stays on the page after a session ends; only what was live is cleared.
  sessionEnded: () =>
    set({ phase: "idle", activeClipId: null, isCycling: false }),
}));
