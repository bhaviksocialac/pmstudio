import { useEffect, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Sparkles, X, Send, Loader2, Check } from "lucide-react";
import { toast } from "sonner";
import { askCopilot } from "@/lib/ai-copilot.functions";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { onAskCopilot } from "@/lib/app-bus";

type Msg = { role: "user" | "assistant"; content: string };
type Action =
  | { kind: "answer" }
  | { kind: "create_task"; title: string; project_name?: string; due_date?: string; assignee?: string; priority?: string }
  | { kind: "draft_message"; recipient: string; channel: "whatsapp" | "email"; body: string }
  | { kind: "update_status"; entity: string; target: string; status: string };

function suggestedPrompts(): string[] {
  const hour = new Date().getHours();
  const base = [
    "Which project needs my attention today?",
    "Show me all overdue tasks",
    "What is the total pending collection across projects?",
    "Which vendor has the most delays?",
  ];
  if (hour < 11) return ["Plan my day", ...base.slice(0, 4)];
  if (hour > 17) return ["Summarise today's progress", ...base.slice(0, 4)];
  return ["Draft a WhatsApp update to my urgent client", ...base];
}

export function AICopilot() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [pendingAction, setPendingAction] = useState<Action | null>(null);
  const askFn = useServerFn(askCopilot);
  const { user } = useAuth();
  const qc = useQueryClient();
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, pendingAction]);

  const ask = useMutation({
    mutationFn: async (text: string) => {
      const next: Msg[] = [...messages, { role: "user", content: text }];
      setMessages(next);
      setInput("");
      const res = await askFn({ data: { messages: next } });
      return res;
    },
    onSuccess: (res) => {
      setMessages((m) => [...m, { role: "assistant", content: res.reply }]);
      if (res.action.kind !== "answer") setPendingAction(res.action);
    },
    onError: (e) => {
      setMessages((m) => [...m, { role: "assistant", content: `Error: ${e instanceof Error ? e.message : "Failed"}` }]);
    },
  });

  const executeAction = async () => {
    if (!pendingAction || !user) return;
    try {
      if (pendingAction.kind === "create_task") {
        // resolve project by name
        let projectId: string | null = null;
        if (pendingAction.project_name) {
          const { data } = await supabase.from("projects").select("id,name").ilike("name", `%${pendingAction.project_name}%`).limit(1).maybeSingle();
          projectId = data?.id ?? null;
        }
        const priority = pendingAction.priority ?? "Medium";
        const encoded = `[${priority}] [Execution] ${pendingAction.title}`;
        const { error } = await supabase.from("tasks").insert({
          user_id: user.id,
          title: encoded,
          assignee: pendingAction.assignee ?? null,
          due_date: pendingAction.due_date ?? null,
          project_id: projectId,
          done: false,
        });
        if (error) throw error;
        toast.success("Task created");
        qc.invalidateQueries({ queryKey: ["tasks"] });
      } else if (pendingAction.kind === "draft_message") {
        const { error } = await supabase.from("ai_drafts").insert({
          user_id: user.id,
          kind: "event_notification",
          recipient_kind: "client",
          recipient_name: pendingAction.recipient,
          body: pendingAction.body,
          status: "pending",
          meta: { channel: pendingAction.channel },
        });
        if (error) throw error;
        toast.success("Draft saved to Pending Approvals");
        qc.invalidateQueries({ queryKey: ["ai_drafts"] });
      } else if (pendingAction.kind === "update_status") {
        toast.message("Status updates require manual confirmation in this preview.");
      }
      setMessages((m) => [...m, { role: "assistant", content: "Done — saved." }]);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setPendingAction(null);
    }
  };

  return (
    <>
      {!open && (
        <button
          onClick={() => setOpen(true)}
          aria-label="Open AI Copilot"
          className="fixed bottom-20 md:bottom-6 right-6 z-40 h-14 w-14 rounded-full bg-[#1a1612] text-white shadow-xl hover:scale-105 transition-transform flex items-center justify-center"
          style={{ boxShadow: "0 10px 30px -10px rgba(193,127,90,0.55)" }}
        >
          <Sparkles className="h-6 w-6 text-[#c17f5a]" />
        </button>
      )}

      {open && (
        <div className="fixed inset-0 z-50 bg-black/30 backdrop-blur-sm" onClick={() => setOpen(false)}>
          <div className="absolute right-0 top-0 bottom-0 w-full max-w-md bg-card flex flex-col shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="px-5 py-4 border-b border-border flex items-center justify-between bg-[#1a1612] text-white">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-[#c17f5a]" />
                <div>
                  <div className="font-display text-lg leading-none">PMStudio Copilot</div>
                  <div className="text-[10px] uppercase tracking-wider text-white/50 mt-1">Ask anything · English or Hindi</div>
                </div>
              </div>
              <button onClick={() => setOpen(false)} className="h-9 w-9 rounded-[10px] hover:bg-white/10 flex items-center justify-center">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {messages.length === 0 && (
                <div className="space-y-3">
                  <p className="text-sm text-muted-foreground">Suggested prompts for right now:</p>
                  <div className="space-y-2">
                    {suggestedPrompts().map((p) => (
                      <button key={p} onClick={() => ask.mutate(p)}
                        className="w-full text-left px-3 py-2.5 rounded-[10px] border border-border bg-card hover:border-[#c17f5a] hover:bg-[#fff7eb] text-sm">
                        {p}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {messages.map((m, i) => (
                <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[85%] px-3 py-2 rounded-[12px] text-sm whitespace-pre-wrap leading-relaxed ${
                    m.role === "user"
                      ? "bg-[#c17f5a] text-white rounded-br-[4px]"
                      : "bg-muted rounded-bl-[4px]"
                  }`}>
                    {m.content}
                  </div>
                </div>
              ))}

              {ask.isPending && (
                <div className="flex justify-start"><div className="px-3 py-2 rounded-[12px] bg-muted text-xs text-muted-foreground inline-flex items-center gap-2">
                  <Loader2 className="h-3 w-3 animate-spin" /> Thinking…
                </div></div>
              )}

              {pendingAction && (
                <div className="rounded-[12px] border-2 border-[#c17f5a] bg-[#fff7eb] p-3 space-y-2">
                  <div className="text-[10px] uppercase tracking-wider text-[#c17f5a] font-medium">Confirm action</div>
                  <pre className="text-xs whitespace-pre-wrap font-mono text-foreground">{JSON.stringify(pendingAction, null, 2)}</pre>
                  <div className="flex gap-2">
                    <button onClick={executeAction}
                      className="h-9 px-4 rounded-[6px] bg-[#7a9e8a] text-white text-xs font-medium inline-flex items-center gap-1.5 hover:brightness-110">
                      <Check className="h-3 w-3" /> Confirm & save
                    </button>
                    <button onClick={() => setPendingAction(null)}
                      className="h-9 px-4 rounded-[6px] border border-border text-xs font-medium hover:bg-muted">Cancel</button>
                  </div>
                </div>
              )}

              <div ref={bottomRef} />
            </div>

            <div className="p-3 border-t border-border flex gap-2">
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && input.trim() && !ask.isPending) ask.mutate(input.trim()); }}
                placeholder="Ask anything…"
                className="flex-1 h-10 px-3 rounded-[10px] bg-card border border-border text-sm focus:outline-none focus:ring-2 focus:ring-ring/30"
              />
              <button onClick={() => input.trim() && ask.mutate(input.trim())} disabled={ask.isPending || !input.trim()}
                className="h-10 w-10 rounded-[10px] bg-primary text-primary-foreground flex items-center justify-center disabled:opacity-50">
                <Send className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
