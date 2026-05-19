import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Phone, Paperclip, Send, Sparkles, MessageCircle } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { conversations, type Conversation } from "@/lib/studio-data";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/messages")({
  head: () => ({ meta: [{ title: "Messages — StudioOS" }, { name: "description", content: "All client and vendor conversations in one inbox, with AI drafts." }] }),
  component: MessagesPage,
});

function MessagesPage() {
  const [activeId, setActiveId] = useState(conversations[0].id);
  const [filter, setFilter] = useState<"All" | "Clients" | "Vendors" | "Unread">("All");
  const [draft, setDraft] = useState("");
  const active = conversations.find((c) => c.id === activeId)!;

  const filtered = conversations.filter((c) => {
    if (filter === "Clients") return c.kind === "client";
    if (filter === "Vendors") return c.kind === "vendor";
    if (filter === "Unread") return !!c.unread;
    return true;
  });

  const send = () => {
    if (!draft.trim()) return;
    toast.success("Message sent");
    setDraft("");
  };

  return (
    <AppShell>
      <main className="px-4 md:px-8 py-6 md:py-8 max-w-[1400px] w-full pb-24 md:pb-8">
        <div className="mb-6">
          <div className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground mb-3">Inbox</div>
          <h1 className="font-display text-4xl md:text-5xl">Messages</h1>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-[340px_1fr] gap-4 h-[calc(100vh-220px)] min-h-[560px]">
          {/* Conversation list */}
          <aside className="rounded-[16px] bg-card border border-border flex flex-col overflow-hidden" style={{ boxShadow: "var(--shadow-card)" }}>
            <div className="px-3 py-3 border-b border-border flex gap-1">
              {(["All","Clients","Vendors","Unread"] as const).map((f) => (
                <button key={f} onClick={() => setFilter(f)}
                        className={`flex-1 h-8 rounded-[6px] text-[11px] font-medium transition-colors ${filter === f ? "bg-[#1a1612] text-white" : "text-muted-foreground hover:bg-muted"}`}>
                  {f}
                </button>
              ))}
            </div>
            <div className="flex-1 overflow-y-auto divide-y divide-border">
              {filtered.map((c) => (
                <ConversationRow key={c.id} c={c} active={c.id === activeId} onClick={() => setActiveId(c.id)} />
              ))}
            </div>
          </aside>

          {/* Active conversation */}
          <section className="rounded-[16px] bg-card border border-border flex flex-col overflow-hidden" style={{ boxShadow: "var(--shadow-card)" }}>
            <div className="px-5 py-4 border-b border-border flex items-center gap-3">
              <span className="h-10 w-10 rounded-full bg-[#c17f5a] text-white text-xs font-medium flex items-center justify-center">{active.initials}</span>
              <div className="flex-1 min-w-0">
                <div className="font-medium">{active.name}</div>
                {active.project && <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-[6px] bg-muted text-muted-foreground">{active.project}</span>}
              </div>
              <button onClick={() => toast("WhatsApp opened")} className="h-9 w-9 rounded-[10px] border border-border flex items-center justify-center hover:bg-muted"><MessageCircle className="h-4 w-4 text-[#7a9e8a]" /></button>
              <button onClick={() => toast("Calling…")} className="h-9 w-9 rounded-[10px] border border-border flex items-center justify-center hover:bg-muted"><Phone className="h-4 w-4" /></button>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-3 bg-[#faf8f5]/40">
              {active.messages.map((m, i) => (
                <div key={i} className={`flex ${m.from === "me" ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[75%] rounded-[16px] px-4 py-2.5 text-sm ${m.from === "me" ? "bg-[#c17f5a] text-white rounded-br-[6px]" : "bg-card border border-border rounded-bl-[6px]"}`}>
                    <div>{m.text}</div>
                    <div className={`text-[10px] mt-1 font-mono ${m.from === "me" ? "text-white/70" : "text-muted-foreground"}`}>{m.time}</div>
                  </div>
                </div>
              ))}

              {active.aiDraft && (
                <div className="rounded-[16px] bg-[#1a1612] text-white p-4">
                  <div className="flex items-center gap-2 mb-2 text-[#c17f5a]">
                    <Sparkles className="h-3.5 w-3.5" /><span className="text-[10px] uppercase tracking-wider">AI has drafted a reply</span>
                  </div>
                  <p className="text-sm leading-relaxed text-white/85">{active.aiDraft}</p>
                  <div className="flex gap-2 mt-4">
                    <button onClick={() => { toast.success("Reply sent"); }} className="h-9 px-4 rounded-[6px] bg-[#c17f5a] text-white text-xs font-medium hover:brightness-95">Send This</button>
                    <button onClick={() => setDraft(active.aiDraft || "")} className="h-9 px-4 rounded-[6px] border border-white/25 text-white text-xs font-medium hover:bg-white/5">Edit</button>
                  </div>
                </div>
              )}
            </div>

            <div className="border-t border-border p-4">
              <div className="flex items-center gap-2 mb-2 text-[11px]">
                <span className="text-muted-foreground">Send via</span>
                <button className="px-2 py-0.5 rounded-[6px] bg-[#7a9e8a] text-white font-medium">WhatsApp</button>
                <button className="px-2 py-0.5 rounded-[6px] border border-border text-muted-foreground hover:bg-muted">App</button>
              </div>
              <div className="flex items-center gap-2">
                <button className="h-10 w-10 rounded-[10px] border border-border flex items-center justify-center hover:bg-muted"><Paperclip className="h-4 w-4" /></button>
                <button onClick={() => setDraft(active.aiDraft || "Drafted by AI…")} className="h-10 w-10 rounded-[10px] border border-border flex items-center justify-center hover:bg-muted text-[#c17f5a]"><Sparkles className="h-4 w-4" /></button>
                <input value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => e.key === "Enter" && send()}
                       placeholder="Type a message…"
                       className="flex-1 h-10 px-3 rounded-[10px] bg-background border border-border text-sm focus:outline-none focus:ring-2 focus:ring-ring/30" />
                <button onClick={send} className="h-10 px-4 rounded-[6px] bg-primary text-primary-foreground text-sm font-medium hover:brightness-95 inline-flex items-center gap-1.5">
                  <Send className="h-3.5 w-3.5" /> Send
                </button>
              </div>
            </div>
          </section>
        </div>
      </main>
    </AppShell>
  );
}

function ConversationRow({ c, active, onClick }: { c: Conversation; active: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} className={`w-full text-left px-4 py-3.5 flex gap-3 transition-colors ${active ? "bg-muted" : "hover:bg-muted/50"}`}>
      <span className="h-10 w-10 rounded-full bg-[#c17f5a] text-white text-xs font-medium flex items-center justify-center shrink-0">{c.initials}</span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm font-medium truncate">{c.name}</span>
          <span className="text-[10px] font-mono text-muted-foreground shrink-0">{c.time}</span>
        </div>
        <div className="flex items-center gap-2 mt-0.5">
          <p className="text-xs text-muted-foreground truncate flex-1">{c.preview}</p>
          {c.unread && <span className="shrink-0 inline-flex h-4 min-w-4 px-1 items-center justify-center text-[10px] font-mono rounded-full bg-[#c17f5a] text-white">{c.unread}</span>}
        </div>
        {c.aiSummary && <span className="inline-block mt-1 text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded-[4px]" style={{ background: "rgba(193,127,90,0.15)", color: "#c17f5a" }}>AI summarised</span>}
      </div>
    </button>
  );
}
