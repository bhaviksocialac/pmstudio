import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Send, Pencil, Trash2, X, Check, MessageSquare, FileText, Clock, AlertTriangle, Bell, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { sendDraft } from "@/lib/ai-drafts.functions";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

export type DraftRow = {
  id: string;
  kind: "weekly_report" | "vendor_followup" | "delay_notice" | "holding" | "event_notification";
  recipient_kind: "client" | "vendor";
  recipient_name: string | null;
  recipient_phone: string | null;
  subject: string | null;
  body: string;
  project_id: string | null;
  status: "pending" | "sent" | "discarded";
  created_at: string;
};

const kindMeta: Record<DraftRow["kind"], { label: string; icon: typeof Send; color: string }> = {
  weekly_report: { label: "Weekly Report", icon: FileText, color: "#7a9e8a" },
  vendor_followup: { label: "Vendor Follow-up", icon: Clock, color: "#d4882a" },
  delay_notice: { label: "Delay Notice", icon: AlertTriangle, color: "#c4685a" },
  holding: { label: "Holding Reply", icon: MessageSquare, color: "#c17f5a" },
  event_notification: { label: "WhatsApp Push", icon: Bell, color: "#25D366" },
};

export function DraftCard({ draft, projectName }: { draft: DraftRow; projectName?: string }) {
  const qc = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [body, setBody] = useState(draft.body);
  const sendDraftFn = useServerFn(sendDraft);
  const meta = kindMeta[draft.kind];

  const persistEdit = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("ai_drafts").update({ body }).eq("id", draft.id);
      if (error) throw error;
    },
  });

  const send = useMutation({
    mutationFn: async () => {
      if (editing && body !== draft.body) await persistEdit.mutateAsync();
      return sendDraftFn({ data: { id: draft.id } });
    },
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ["ai_drafts"] });
      qc.invalidateQueries({ queryKey: ["messages"] });
      toast.success(`Message sent to ${res?.recipient ?? draft.recipient_name ?? "recipient"}`);
      if (draft.kind === "event_notification" && res?.phone) {
        const url = `https://wa.me/${res.phone.replace(/[^0-9]/g, "")}?text=${encodeURIComponent(body)}`;
        window.open(url, "_blank");
      }
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed to send"),
  });

  const discard = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("ai_drafts").update({ status: "discarded" }).eq("id", draft.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ai_drafts"] });
      toast.success("Draft discarded");
    },
  });

  const Icon = meta.icon;

  return (
    <article className="rounded-[12px] border border-border bg-card p-4 md:p-5">
      <header className="flex items-center gap-2 flex-wrap mb-3">
        <span
          className="inline-flex items-center gap-1.5 text-[10px] uppercase tracking-[0.16em] px-2 py-1 rounded-[6px] font-medium"
          style={{ background: `${meta.color}18`, color: meta.color }}
        >
          <Icon className="h-3 w-3" /> {meta.label}
        </span>
        <span className="text-xs text-muted-foreground">
          → {draft.recipient_name ?? "Recipient"}
          {projectName && <span className="text-muted-foreground/60"> · {projectName}</span>}
        </span>
        {draft.status === "sent" && (
          <span className="ml-auto inline-flex items-center gap-1 text-[10px] uppercase tracking-wider px-2 py-1 rounded-[6px] bg-[#7a9e8a]/15 text-[#5b7d6e]">
            <Check className="h-3 w-3" /> Sent
          </span>
        )}
      </header>

      {draft.subject && (
        <div className="text-sm font-medium mb-2">{draft.subject}</div>
      )}

      {editing ? (
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={Math.min(12, Math.max(4, body.split("\n").length + 1))}
          className="w-full text-sm p-3 rounded-[8px] border border-border bg-background focus:outline-none focus:ring-2 focus:ring-ring/30 font-mono"
        />
      ) : (
        <p className="text-sm whitespace-pre-wrap text-foreground/90 leading-relaxed">{body}</p>
      )}

      {draft.status === "pending" && (
        <div className="flex items-center gap-2 mt-4 flex-wrap">
          {editing ? (
            <>
              <button
                onClick={() => send.mutate()}
                disabled={send.isPending}
                className="h-9 px-3.5 rounded-[6px] bg-primary text-primary-foreground text-xs font-medium inline-flex items-center gap-1.5 hover:brightness-95 disabled:opacity-60"
              >
                {send.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                Send Edited Message
              </button>
              <button
                onClick={() => { setEditing(false); setBody(draft.body); }}
                className="h-9 px-3 rounded-[6px] border border-border text-xs font-medium inline-flex items-center gap-1.5 hover:bg-muted"
              >
                <X className="h-3.5 w-3.5" /> Cancel
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => send.mutate()}
                disabled={send.isPending}
                className="h-9 px-3.5 rounded-[6px] bg-primary text-primary-foreground text-xs font-medium inline-flex items-center gap-1.5 hover:brightness-95 disabled:opacity-60"
              >
                {send.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                Send Now
              </button>
              <button
                onClick={() => setEditing(true)}
                className="h-9 px-3 rounded-[6px] border border-border text-xs font-medium inline-flex items-center gap-1.5 hover:bg-muted"
              >
                <Pencil className="h-3.5 w-3.5" /> Edit
              </button>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <button className="h-9 px-3 rounded-[6px] border border-border text-xs font-medium inline-flex items-center gap-1.5 hover:bg-muted text-muted-foreground">
                    <Trash2 className="h-3.5 w-3.5" /> Discard
                  </button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Discard this draft?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Are you sure you want to discard this message? This cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={() => discard.mutate()}>Confirm</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </>
          )}
        </div>
      )}
    </article>
  );
}
