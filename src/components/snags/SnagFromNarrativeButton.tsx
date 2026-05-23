import { useState } from "react";
import { AlertCircle, X } from "lucide-react";

// Lazy-loaded inline trigger that shows a banner when the user's narrative
// looks like a snag rather than a task. Opens the SnagsTab add-modal via a custom event.
export function SnagFromNarrativeButton({ projectId, text, onDismiss }: { projectId: string; text: string; onDismiss: () => void }) {
  const [dismissed, setDismissed] = useState(false);
  if (dismissed) return null;
  return (
    <div className="mt-3 rounded-[10px] bg-[#fdf3f1] border border-[#c4685a40] p-3 flex items-start gap-2.5">
      <AlertCircle className="h-4 w-4 text-[#c4685a] mt-0.5 shrink-0" />
      <div className="flex-1 text-xs">
        <div className="font-medium text-[#8a2a1f]">This sounds like a snag, not a task.</div>
        <div className="text-muted-foreground mt-0.5">Snags track quality issues with before/after photos and block Finishing milestones until closed.</div>
      </div>
      <button
        onClick={() => window.dispatchEvent(new CustomEvent("snag:create-from-narrative", { detail: { projectId, description: text } }))}
        className="h-8 px-3 rounded-[6px] bg-[#c4685a] text-white text-xs font-medium hover:brightness-95"
      >
        Create snag instead
      </button>
      <button onClick={() => { setDismissed(true); onDismiss(); }} className="text-muted-foreground hover:text-foreground"><X className="h-3.5 w-3.5" /></button>
    </div>
  );
}
