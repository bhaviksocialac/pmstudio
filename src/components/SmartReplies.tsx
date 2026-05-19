import { useEffect, useState } from "react";
import { Sparkles, Loader2 } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { generateSmartReplies } from "@/lib/ai-drafts.functions";

export function SmartReplies({
  messageId,
  messageBody,
  kind,
  onPick,
}: {
  messageId: string;
  messageBody: string;
  kind: "client" | "vendor";
  onPick: (text: string) => void;
}) {
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const fn = useServerFn(generateSmartReplies);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fn({ data: { messageBody, messageKind: kind } })
      .then((r) => { if (!cancelled) setSuggestions(r.suggestions ?? []); })
      .catch(() => { if (!cancelled) setSuggestions([]); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messageId]);

  if (loading) {
    return (
      <div className="mt-2 flex items-center gap-2 text-[11px] text-muted-foreground">
        <Loader2 className="h-3 w-3 animate-spin" /> Drafting suggestions…
      </div>
    );
  }
  if (suggestions.length === 0) return null;

  return (
    <div className="mt-2 flex flex-col gap-1.5 max-w-[75%]">
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
        <Sparkles className="h-3 w-3 text-[#c17f5a]" /> Smart Replies
      </div>
      <div className="flex flex-wrap gap-1.5">
        {suggestions.map((s, i) => (
          <button
            key={i}
            onClick={() => onPick(s)}
            className="text-left text-xs px-3 py-1.5 rounded-[10px] bg-[#c17f5a]/10 text-[#7a4a32] hover:bg-[#c17f5a]/20 transition-colors border border-[#c17f5a]/20"
          >
            {s}
          </button>
        ))}
      </div>
    </div>
  );
}
