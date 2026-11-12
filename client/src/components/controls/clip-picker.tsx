import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useSessionControls } from "@/hooks/use-session-controls";
import { usePerceptionStore } from "@/stores/perception-store";
import type { ClipInfo } from "@/types/perception";

const LABEL = "Select clip";
/** One list for "no clips yet", so the store's selector returns the same value each time. */
const NO_CLIPS: ClipInfo[] = [];

function capitalize(word: string): string {
  return word.charAt(0).toUpperCase() + word.slice(1);
}

function clipLabel(clip: ClipInfo): string {
  return `${capitalize(clip.mood)} · ${capitalize(clip.sincerity)} · ${clip.voice}`;
}

/** The clips by whether they were meant, in the order the bot lists them. */
function bySincerity(clips: ClipInfo[]): [string, ClipInfo[]][] {
  const groups = new Map<string, ClipInfo[]>();
  for (const clip of clips) {
    groups.set(clip.sincerity, [...(groups.get(clip.sincerity) ?? []), clip]);
  }
  return [...groups];
}

/** Every clip by the tone it was said in and whether it was meant. Choosing one plays it. */
export function ClipPicker() {
  const clips = usePerceptionStore((state) => state.session?.clips) ?? NO_CLIPS;
  const lastClipId = usePerceptionStore((state) => state.lastClipId);
  const { playClip } = useSessionControls();

  return (
    <Select
      value={lastClipId}
      onValueChange={(clipId) => {
        if (clipId) playClip(clipId);
      }}
      items={clips.map((clip) => ({ value: clip.id, label: clipLabel(clip) }))}
      disabled={clips.length === 0}
    >
      <SelectTrigger aria-label={LABEL} className="min-h-11 w-80 max-w-full">
        <SelectValue placeholder={LABEL} />
      </SelectTrigger>
      <SelectContent>
        {bySincerity(clips).map(([sincerity, group]) => (
          <SelectGroup key={sincerity}>
            <SelectLabel className="capitalize">{sincerity}</SelectLabel>
            {group.map((clip) => (
              <SelectItem key={clip.id} value={clip.id} className="capitalize">
                {clip.mood} · {clip.voice}
              </SelectItem>
            ))}
          </SelectGroup>
        ))}
      </SelectContent>
    </Select>
  );
}
