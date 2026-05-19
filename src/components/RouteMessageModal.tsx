import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { X, Sparkles, Loader2, MessageCircle, User } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { suggestRoute } from "@/lib/whatsapp.functions";

type Kind = "client" | "design" | "execution" | "accounts";
type Option = { kind: Kind | "dm"; label: string; phone: string | null };

export function RouteMessageModal({
  open,
  onClose,
  messageBody,
}: {
  open: boolean;
  onClose: () => void;
  messageBody: string;
}) {
  const { data: groups = [] } = useQuery({
    enabled: open,
    queryKey: ["whatsapp_groups"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("whatsapp_groups")
        .select("kind, label, phone");
      if (error) throw error;
      return data ?? [];
    },
  });
  const suggestFn = useServerFn(suggestRoute);
  const [suggested, setSuggested] = useState<{ kind: string; reason: string } | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) { setSuggested(null); return; }
    setLoading(true);
    suggestFn({ data: { messageBody } })
      .then((r) => setSuggested(r))
      .catch(() => setSuggested(null))
      .finally(() => setLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, messageBody]);

  if (!open) return null;

  const byKind = new Map(groups.map((g) => [g.kind, g]));
  const options: Option[] = (["client", "design", "execution", "accounts"] as Kind[]).map((k) => {
    const g = byKind.get(k);
    return { kind: k, label: g?.label ?? `${k[0].toUpperCase()}${k.slice(1)} Group`, phone: g?.phone ?? null };
  });
  options.push({ kind: "dm", label: "Individual DM", phone: null });

  const onPick = (opt: Option) => {
    if (!opt.phone) {
      toast.error(
        opt.kind === "dm"
          ? "Open the thread in the inbox to DM directly."
          : `No phone set for ${opt.label}. Add it in Settings.`,
      );
      return;
    }
    const url = `https://wa.me/${opt.phone.replace(/[^0-9]/g, "")}?text=${encodeURIComponent(messageBody)}`;
    window.open(url, "_blank");
    toast.success(`Opened WhatsApp · ${opt.label}`);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-up" onClick={onClose}>
      <div className="w-full max-w-md bg-card rounded-[16px] shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="px-6 py-5 border-b border-border flex items-center justify-between">
          <div>
            <h3 className="font-display text-xl">Route Message</h3>
            <p className="text-xs text-muted-foreground mt-0.5">Pick group or DM</p>
          </div>
          <button onClick={onClose} className="h-9 w-9 rounded-[10px] hover:bg-muted flex items-center justify-center">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="px-6 py-4">
          <div className="rounded-[8px] bg-muted/60 p-3 text-xs text-muted-foreground mb-4 max-h-24 overflow-y-auto">
            {messageBody}
          </div>
          {loading && (
            <div className="flex items-center gap-2 text-[11px] text-muted-foreground mb-3">
              <Loader2 className="h-3 w-3 animate-spin" /> AI suggesting destination…
            </div>
          )}
          {suggested && !loading && (
            <div className="mb-3 flex items-start gap-2 text-[11px] text-[#7a4a32] bg-[#c17f5a]/10 p-2.5 rounded-[8px] border border-[#c17f5a]/20">
              <Sparkles className="h-3 w-3 mt-0.5 text-[#c17f5a]" />
              <span><strong className="font-medium">AI suggests {suggested.kind.toUpperCase()}</strong> — {suggested.reason}</span>
            </div>
          )}
          <div className="space-y-2">
            {options.map((opt) => {
              const isSuggested = suggested?.kind === opt.kind;
              return (
                <button
                  key={opt.kind}
                  onClick={() => onPick(opt)}
                  className={`w-full text-left p-3 rounded-[10px] border transition-colors flex items-center gap-3 ${
                    isSuggested
                      ? "border-[#c17f5a] bg-[#c17f5a]/5 ring-1 ring-[#c17f5a]/30"
                      : "border-border hover:bg-muted"
                  }`}
                >
                  <span className="h-9 w-9 rounded-[8px] bg-muted flex items-center justify-center">
                    {opt.kind === "dm" ? <User className="h-4 w-4" /> : <MessageCircle className="h-4 w-4 text-[#25D366]" />}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium">{opt.label}</div>
                    <div className="text-[11px] text-muted-foreground font-mono">{opt.phone ?? "No number set"}</div>
                  </div>
                  {isSuggested && (
                    <span className="text-[9px] uppercase tracking-wider font-mono px-1.5 py-0.5 rounded-[4px] bg-[#c17f5a] text-white">
                      Suggested
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
