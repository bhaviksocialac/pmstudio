import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Languages, Loader2 } from "lucide-react";
import { translateToHindi } from "@/lib/whatsapp.functions";

/**
 * Toggle that translates `text` to Hindi on demand and shows a preview.
 * When enabled, `onPreview(hindiText)` is called with the translation so
 * the parent can use it as the actual send body.
 */
export function HindiToggle({
  text,
  onPreview,
}: {
  text: string;
  onPreview?: (hindi: string | null) => void;
}) {
  const fn = useServerFn(translateToHindi);
  const [on, setOn] = useState(false);
  const [hindi, setHindi] = useState<string>("");
  const [loading, setLoading] = useState(false);

  const toggle = async () => {
    if (on) {
      setOn(false);
      setHindi("");
      onPreview?.(null);
      return;
    }
    if (!text.trim()) return;
    setOn(true);
    setLoading(true);
    try {
      const res = await fn({ data: { text } });
      setHindi(res.translated ?? "");
      onPreview?.(res.translated ?? null);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <button
        type="button"
        onClick={toggle}
        className={`inline-flex items-center gap-1.5 text-[11px] px-2.5 py-1 rounded-[6px] border transition-colors ${
          on ? "bg-[#c17f5a] text-white border-[#c17f5a]" : "border-border text-muted-foreground hover:bg-muted"
        }`}
      >
        {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Languages className="h-3 w-3" />}
        Translate to Hindi
      </button>
      {on && (loading || hindi) && (
        <div className="mt-2 p-2.5 rounded-[8px] bg-[#fff7eb] border border-[#d4882a]/30 text-sm">
          <div className="text-[10px] uppercase tracking-[0.18em] text-[#a06520] font-mono mb-1">Hindi preview</div>
          {loading ? (
            <div className="flex items-center gap-2 text-xs text-muted-foreground"><Loader2 className="h-3 w-3 animate-spin" /> Translating…</div>
          ) : (
            <p className="whitespace-pre-wrap text-foreground/90">{hindi}</p>
          )}
        </div>
      )}
    </div>
  );
}
