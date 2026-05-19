import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { Send, Loader2, MessageSquare, Share2 } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AppShell } from "@/components/AppShell";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";
import { SmartReplies } from "@/components/SmartReplies";
import { RouteMessageModal } from "@/components/RouteMessageModal";
import { HindiToggle } from "@/components/HindiToggle";
import { VoiceNoteUploader } from "@/components/VoiceNoteUploader";

export const Route = createFileRoute("/_authenticated/messages")({
  head: () => ({ meta: [{ title: "Messages — PMStudio" }, { name: "description", content: "All client and vendor conversations in one inbox." }] }),
  component: MessagesPage,
});

type DbMessage = {
  id: string;
  body: string;
  from_me: boolean;
  kind: "client" | "vendor";
  thread_with: string | null;
  sent_at: string;
};

function MessagesPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [activeThread, setActiveThread] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [hindiPreview, setHindiPreview] = useState<string | null>(null);
  const [routeOpen, setRouteOpen] = useState(false);
  const [filter, setFilter] = useState<"All" | "Clients" | "Vendors">("All");

  const { data: messages = [], isLoading } = useQuery({
    queryKey: ["messages"],
    queryFn: async () => {
      const { data, error } = await supabase.from("messages").select("*").order("sent_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as DbMessage[];
    },
  });

  const threads = useMemo(() => {
    const map = new Map<string, { key: string; kind: "client" | "vendor"; messages: DbMessage[] }>();
    for (const m of messages) {
      const key = m.thread_with ?? `__${m.kind}__`;
      if (!map.has(key)) map.set(key, { key, kind: m.kind, messages: [] });
      map.get(key)!.messages.push(m);
    }
    return Array.from(map.values()).filter((t) =>
      filter === "All" ? true : filter === "Clients" ? t.kind === "client" : t.kind === "vendor",
    );
  }, [messages, filter]);

  const active = threads.find((t) => t.key === activeThread) ?? threads[0];

  const send = useMutation({
    mutationFn: async () => {
      if (!draft.trim() || !active) return;
      const bodyToSend = (hindiPreview ?? draft).trim();
      const { error } = await supabase.from("messages").insert({
        user_id: user!.id,
        body: bodyToSend,
        from_me: true,
        kind: active.kind,
        thread_with: active.key.startsWith("__") ? null : active.key,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setDraft("");
      setHindiPreview(null);
      qc.invalidateQueries({ queryKey: ["messages"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed to send"),
  });

  return (
    <AppShell>
      <main className="px-4 md:px-8 py-6 md:py-8 max-w-[1400px] w-full pb-24 md:pb-8">
        <div className="mb-6">
          <div className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground mb-3">Inbox</div>
          <h1 className="font-display text-4xl md:text-5xl">Messages</h1>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-[340px_1fr] gap-4 h-[calc(100vh-220px)] min-h-[560px]">
          <aside className="rounded-[16px] bg-card border border-border flex flex-col overflow-hidden" style={{ boxShadow: "var(--shadow-card)" }}>
            <div className="px-3 py-3 border-b border-border flex gap-1">
              {(["All", "Clients", "Vendors"] as const).map((f) => (
                <button key={f} onClick={() => setFilter(f)}
                  className={`flex-1 h-8 rounded-[6px] text-[11px] font-medium transition-colors ${filter === f ? "bg-[#1a1612] text-white" : "text-muted-foreground hover:bg-muted"}`}>
                  {f}
                </button>
              ))}
            </div>
            <div className="flex-1 overflow-y-auto divide-y divide-border">
              {isLoading ? (
                <div className="p-10 flex justify-center"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
              ) : threads.length === 0 ? (
                <div className="p-10 text-center text-sm text-muted-foreground">
                  <MessageSquare className="h-6 w-6 mx-auto mb-2 opacity-50" />
                  No conversations yet.
                </div>
              ) : threads.map((t) => {
                const last = t.messages[t.messages.length - 1];
                const isActive = active?.key === t.key;
                const label = t.key.startsWith("__") ? (t.kind === "client" ? "Clients" : "Vendors") : t.key.slice(0, 8);
                return (
                  <button key={t.key} onClick={() => setActiveThread(t.key)}
                    className={`w-full text-left px-4 py-3.5 flex gap-3 transition-colors ${isActive ? "bg-muted" : "hover:bg-muted/50"}`}>
                    <span className="h-10 w-10 rounded-full bg-[#c17f5a] text-white text-xs font-medium flex items-center justify-center shrink-0">
                      {label.slice(0, 2).toUpperCase()}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">{label}</div>
                      <p className="text-xs text-muted-foreground truncate mt-0.5">{last.body}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          </aside>

          <section className="rounded-[16px] bg-card border border-border flex flex-col overflow-hidden" style={{ boxShadow: "var(--shadow-card)" }}>
            {!active ? (
              <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground">Select a conversation</div>
            ) : (
              <>
                <div className="px-5 py-4 border-b border-border">
                  <div className="font-medium capitalize">{active.kind} thread</div>
                </div>
                <div className="flex-1 overflow-y-auto p-5 space-y-3 bg-[#faf8f5]/40">
                  {active.messages.map((m, idx) => {
                    const isLastInbound = !m.from_me && idx === active.messages.length - 1;
                    return (
                      <div key={m.id}>
                        <div className={`flex ${m.from_me ? "justify-end" : "justify-start"}`}>
                          <div className={`max-w-[75%] rounded-[16px] px-4 py-2.5 text-sm ${m.from_me ? "bg-[#c17f5a] text-white rounded-br-[6px]" : "bg-card border border-border rounded-bl-[6px]"}`}>
                            <div>{m.body}</div>
                            <div className={`text-[10px] mt-1 font-mono ${m.from_me ? "text-white/70" : "text-muted-foreground"}`}>
                              {new Date(m.sent_at).toLocaleString()}
                            </div>
                          </div>
                        </div>
                        {isLastInbound && (
                          <SmartReplies
                            messageId={m.id}
                            messageBody={m.body}
                            kind={m.kind}
                            onPick={(t) => setDraft(t)}
                          />
                        )}
                      </div>
                    );
                  })}
                </div>
                <div className="border-t border-border p-4">
                  <div className="flex items-center gap-2">
                    <input value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => e.key === "Enter" && send.mutate()}
                      placeholder="Type a message…"
                      className="flex-1 h-10 px-3 rounded-[10px] bg-background border border-border text-sm focus:outline-none focus:ring-2 focus:ring-ring/30" />
                    <button onClick={() => send.mutate()} disabled={send.isPending || !draft.trim()}
                      className="h-10 px-4 rounded-[6px] bg-primary text-primary-foreground text-sm font-medium hover:brightness-95 inline-flex items-center gap-1.5 disabled:opacity-60">
                      <Send className="h-3.5 w-3.5" /> Send
                    </button>
                  </div>
                </div>
              </>
            )}
          </section>
        </div>
      </main>
    </AppShell>
  );
}
