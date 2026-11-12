import { SessionControls } from "@/components/controls/session-controls";
import { AppHeader } from "@/components/layout/app-header";
import { Backdrop } from "@/components/layout/backdrop";
import { VoicePill } from "@/components/pill/voice-pill";
import { ResultsPanel } from "@/components/results/results-panel";
import { TurnCaption } from "@/components/results/turn-caption";
import { VoiceWaveform } from "@/components/waveform/voice-waveform";
import { useClipCycle } from "@/hooks/use-clip-cycle";
import { useHeardVoice } from "@/hooks/use-heard-voice";
import { usePerceptionEvents } from "@/hooks/use-perception-events";
import { useSceneTone } from "@/hooks/use-scene-tone";

export function App() {
  usePerceptionEvents();
  useClipCycle();
  const voice = useHeardVoice();
  const tone = useSceneTone();
  return (
    // One screen, never scrolled: every size inside is counted in the screen's height (index.css),
    // and what reaches past it is clipped, which unlike hiding it leaves nothing to scroll to.
    // The tone of the reading on show, or the colour of a turn in progress, colours the backdrop, the ring and the gauges.
    <div
      data-tone={tone}
      className="tone-scope relative isolate h-dvh overflow-clip"
    >
      <Backdrop />
      <div className="mx-auto flex h-full w-full max-w-page flex-col gap-frame-sm px-6 py-frame-sm lg:px-12">
        <div className="relative z-10">
          <AppHeader />
        </div>
        <main className="grid min-h-0 flex-1 items-center gap-frame lg:grid-cols-2 lg:gap-16">
          <div className="flex flex-col items-center gap-frame lg:gap-frame-lg">
            <VoicePill className="size-pill" />
            {/* Above the pill's canvas, which reaches down over them. */}
            <div className="relative z-10">
              <SessionControls />
            </div>
          </div>
          <div className="relative z-10 min-w-0">
            <ResultsPanel />
          </div>
        </main>
        <footer className="relative z-10 flex shrink-0 flex-col gap-2 border-t pt-2">
          <TurnCaption />
          <VoiceWaveform track={voice} className="h-wave" />
        </footer>
      </div>
    </div>
  );
}
