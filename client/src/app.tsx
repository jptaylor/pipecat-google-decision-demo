import { SessionControls } from "@/components/controls/session-controls";
import { StatusLine } from "@/components/controls/status-line";
import { VoicePill } from "@/components/pill/voice-pill";
import { ResultsPanel } from "@/components/results/results-panel";
import { VoiceWaveform } from "@/components/waveform/voice-waveform";
import { useHeardVoice } from "@/hooks/use-heard-voice";
import { usePerceptionEvents } from "@/hooks/use-perception-events";

const HEADER = "Pipecat Perception x Google Decision";

export function App() {
  usePerceptionEvents();
  const voice = useHeardVoice();
  return (
    // One screen, never scrolled: every size inside is counted in the screen's height (index.css).
    <div className="mx-auto flex h-dvh w-full max-w-page flex-col gap-frame-sm overflow-hidden px-6 py-frame-sm lg:px-12">
      <header className="relative z-10">
        <h1 className="text-xs font-medium tracking-widest text-muted-foreground uppercase">
          {HEADER}
        </h1>
      </header>
      <main className="grid min-h-0 flex-1 items-center gap-frame lg:grid-cols-2 lg:gap-16">
        <div className="flex flex-col items-center gap-frame-sm">
          <VoicePill className="size-pill" />
          {/* Above the pill's canvas, which reaches down over them. */}
          <div className="relative z-10 flex flex-col items-center gap-frame-sm">
            <StatusLine />
            <SessionControls />
          </div>
        </div>
        <div className="relative z-10 min-w-0">
          <ResultsPanel />
        </div>
      </main>
      <VoiceWaveform track={voice} className="relative z-10 h-wave shrink-0" />
    </div>
  );
}
