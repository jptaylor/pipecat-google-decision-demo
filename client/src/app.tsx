import { SessionControls } from "@/components/controls/session-controls";
import { StatusLine } from "@/components/controls/status-line";
import { VoicePill } from "@/components/pill/voice-pill";
import { ResultsPanel } from "@/components/results/results-panel";
import { usePerceptionEvents } from "@/hooks/use-perception-events";

export function App() {
  usePerceptionEvents();
  return (
    <main className="mx-auto grid min-h-dvh w-full max-w-page items-center gap-10 px-6 pt-[max(1.5rem,env(safe-area-inset-top))] pb-[max(1.5rem,env(safe-area-inset-bottom))] lg:grid-cols-2 lg:gap-16 lg:px-12">
      <div className="flex flex-col items-center gap-6">
        <VoicePill className="max-w-xs lg:max-w-xl" />
        <StatusLine />
        <SessionControls />
      </div>
      <ResultsPanel />
    </main>
  );
}
