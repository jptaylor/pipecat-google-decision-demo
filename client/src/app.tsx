import { SessionControls } from "@/components/controls/session-controls";
import { StatusLine } from "@/components/controls/status-line";
import { VoicePill } from "@/components/pill/voice-pill";
import { ResultsPanel } from "@/components/results/results-panel";
import { usePerceptionEvents } from "@/hooks/use-perception-events";

const HEADER = "Pipecat Perception x Google Decision";

export function App() {
  usePerceptionEvents();
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-page flex-col gap-6 px-6 pt-[max(1.5rem,env(safe-area-inset-top))] pb-[max(1.5rem,env(safe-area-inset-bottom))] lg:px-12">
      <header>
        <h1 className="text-xs font-medium tracking-widest text-muted-foreground uppercase">
          {HEADER}
        </h1>
      </header>
      <main className="grid flex-1 items-center gap-10 lg:grid-cols-2 lg:gap-16">
        <div className="flex flex-col items-center gap-6">
          <VoicePill className="max-w-xs lg:max-w-xl" />
          <StatusLine />
          <SessionControls />
        </div>
        <ResultsPanel />
      </main>
    </div>
  );
}
