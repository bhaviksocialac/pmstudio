import { useState } from "react";
import { AlertTriangle, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useQueryClient } from "@tanstack/react-query";

// Order matters — wipe child/dependent tables first.
const TABLES = [
  "task_status_history",
  "tasks",
  "snags",
  "site_reports",
  "site_attendance",
  "room_scope_items",
  "project_rooms",
  "project_contractors",
  "project_vendors",
  "project_documents",
  "project_phases",
  "phase_subcategory_vendors",
  "phase_subcategories",
  "milestones",
  "approvals",
  "change_orders",
  "budget_lines",
  "invoices",
  "payment_requests",
  "meetings",
  "messages",
  "photos",
  "ai_drafts",
  "client_contacts",
  "projects",
  "clients",
] as const;

export function ClearTestDataPanel() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);

  const run = async () => {
    if (!user) return;
    if (confirm !== "DELETE") {
      toast.error('Type DELETE to confirm');
      return;
    }
    setBusy(true);
    const errors: string[] = [];
    for (const t of TABLES) {
      const { error } = await (supabase as any).from(t).delete().eq("user_id", user.id);
      if (error) errors.push(`${t}: ${error.message}`);
    }
    setBusy(false);
    setConfirm("");
    if (errors.length) {
      toast.error(`Some tables failed (${errors.length}). Check console.`);
      console.error("Clear test data errors:", errors);
    } else {
      toast.success("All test data cleared. Start fresh.");
    }
    qc.invalidateQueries();
  };

  return (
    <section className="rounded-[16px] border-2 border-[#c4685a]/40 bg-[#fff5f2] p-5 md:p-6">
      <div className="flex items-start gap-3 mb-4">
        <div className="h-9 w-9 rounded-[10px] bg-[#c4685a] text-white flex items-center justify-center shrink-0">
          <AlertTriangle className="h-4 w-4" />
        </div>
        <div>
          <h2 className="font-display text-xl text-[#1a1612]">Clear Test Data</h2>
          <p className="text-xs text-[#7a3a30] mt-1 max-w-lg">
            Permanently deletes every project, client, vendor link, task, snag, invoice,
            milestone, message, meeting, photo, and document on your account. Your login,
            profile, studio settings, and vendor directory stay intact. This cannot be undone.
          </p>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
        <input
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          placeholder='Type DELETE to confirm'
          className="h-10 px-3 rounded-[8px] border border-[#c4685a]/40 bg-white text-sm flex-1"
        />
        <button
          onClick={run}
          disabled={busy || confirm !== "DELETE"}
          className="h-10 px-4 rounded-[8px] bg-[#c4685a] text-white text-sm font-medium inline-flex items-center gap-2 disabled:opacity-40"
        >
          <Trash2 className="h-4 w-4" />
          {busy ? "Clearing…" : "Clear all test data"}
        </button>
      </div>
    </section>
  );
}
