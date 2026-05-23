// Server-only inline milestone evaluator. Not exposed as a serverFn — call directly from other
// server handlers that already have an authenticated supabase client.
import type { SupabaseClient } from "@supabase/supabase-js";
import { tasksForMilestone, triggerLatestDoneDate, type MilestoneKind, type MilestoneTrigger } from "@/lib/milestone-eval";
import type { TaskLite } from "@/lib/phase-sync";

type MilestoneRow = {
  id: string;
  name: string;
  kind: MilestoneKind;
  trigger: MilestoneTrigger;
  invoice_amount: number;
  client_message_template: string | null;
  status: string;
};

export type FiredMilestoneLite = { id: string; name: string; invoice_amount: number };

export async function evaluateMilestonesInline(
  // SupabaseClient is generic; we don't need its full type here.
  supabase: SupabaseClient<any, "public", any>,
  userId: string,
  projectId: string,
): Promise<FiredMilestoneLite[]> {
  const [{ data: ms }, { data: tasks }, { data: project }] = await Promise.all([
    supabase.from("milestones").select("id,name,kind,trigger,invoice_amount,client_message_template,status")
      .eq("project_id", projectId).eq("status", "pending"),
    supabase.from("tasks")
      .select("id,status,done,work_type,work_types,areas,area,room,completion_pct,phase,ifr_date,ifa_date,ifc_date,planned_end,due_date,actual_end")
      .eq("project_id", projectId),
    supabase.from("projects").select("name,client_id").eq("id", projectId).maybeSingle(),
  ]);

  const allTasks = (tasks ?? []) as TaskLite[];
  const fired: FiredMilestoneLite[] = [];

  for (const m of (ms ?? []) as MilestoneRow[]) {
    const set = tasksForMilestone({ kind: m.kind, trigger: m.trigger }, allTasks);
    if (!set.length) continue;
    const allDone = set.every((t) => t.status === "done" || !!t.done);
    if (!allDone) continue;

    const triggeredAt = triggerLatestDoneDate({ kind: m.kind, trigger: m.trigger }, allTasks)
      ?? new Date().toISOString().slice(0, 10);
    const today = new Date().toISOString().slice(0, 10);
    const onTime = triggeredAt <= today;

    const dueAt = new Date(triggeredAt);
    dueAt.setDate(dueAt.getDate() + 7);
    const invoiceNumber = `INV-${Date.now().toString(36).toUpperCase()}`;
    const { data: invIns } = await supabase.from("invoices").insert({
      user_id: userId,
      project_id: projectId,
      client_id: project?.client_id ?? null,
      number: invoiceNumber,
      milestone: m.name,
      amount: m.invoice_amount,
      status: "draft",
      due_at: dueAt.toISOString().slice(0, 10),
    }).select("id").single();

    const template = m.client_message_template ?? defaultClientMessage(m.name, project?.name ?? "your project", m.invoice_amount, invoiceNumber);
    const { data: draftIns } = await supabase.from("ai_drafts").insert({
      user_id: userId,
      project_id: projectId,
      recipient_kind: "client",
      recipient_id: project?.client_id ?? null,
      kind: "event_notification",
      subject: `${m.name} — milestone complete`,
      body: template,
      status: "pending",
      meta: { milestone_id: m.id, milestone_name: m.name, invoice_id: invIns?.id ?? null, invoice_amount: m.invoice_amount },
    }).select("id").single();

    await supabase.from("milestones").update({
      status: "triggered",
      triggered_at: new Date(triggeredAt).toISOString(),
      triggered_on_time: onTime,
      invoice_id: invIns?.id ?? null,
      approval_id: draftIns?.id ?? null,
    }).eq("id", m.id);

    fired.push({ id: m.id, name: m.name, invoice_amount: m.invoice_amount });
  }

  return fired;
}

function defaultClientMessage(name: string, projectName: string, amount: number, invNo: string): string {
  const amt = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(amount);
  return `Hi,\n\nGreat news — "${name}" is now complete on ${projectName}. Photos from the site will follow shortly.\n\nAs per our schedule, the linked invoice (${invNo}) for ${amt} is attached. Payment is due within 7 days.\n\nPlease let me know if you'd like to do a site walkthrough.\n\nThank you!`;
}
