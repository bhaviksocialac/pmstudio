import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const LOVABLE_AI_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
const MODEL = "google/gemini-3-flash-preview";

async function callAI(system: string, user: string): Promise<string> {
  const key = process.env.LOVABLE_API_KEY;
  if (!key) throw new Error("LOVABLE_API_KEY not configured");
  const res = await fetch(LOVABLE_AI_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: MODEL,
      messages: [{ role: "system", content: system }, { role: "user", content: user }],
    }),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`AI gateway error ${res.status}: ${t.slice(0, 200)}`);
  }
  const json = await res.json();
  return json.choices?.[0]?.message?.content?.toString() ?? "";
}

// ---------- Smart replies (no DB write) ----------
export const generateSmartReplies = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({
      messageBody: z.string().min(1).max(2000),
      messageKind: z.enum(["client", "vendor"]),
      projectName: z.string().max(200).optional(),
      projectPhase: z.string().max(50).optional(),
    }).parse(input),
  )
  .handler(async ({ data }) => {
    const ctx = data.projectName
      ? `Project: ${data.projectName}${data.projectPhase ? ` (${data.projectPhase} phase)` : ""}`
      : "No specific project context.";
    const system = `You are an interior designer's assistant. Draft 3 short professional reply options (max 25 words each) to a ${data.messageKind}. Warm, action-oriented tone. Return as a JSON array of 3 strings only, no prose.`;
    const user = `${ctx}\n\nIncoming message:\n"${data.messageBody}"\n\nReturn JSON array.`;
    try {
      const out = await callAI(system, user);
      const match = out.match(/\[[\s\S]*\]/);
      if (!match) return { suggestions: [] as string[] };
      const arr = JSON.parse(match[0]);
      return {
        suggestions: (Array.isArray(arr) ? arr : [])
          .filter((s) => typeof s === "string")
          .slice(0, 3) as string[],
      };
    } catch (e) {
      console.error("smart reply error", e);
      return { suggestions: [] as string[] };
    }
  });

// ---------- Weekly report ----------
export const generateWeeklyReport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ projectId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: project } = await supabase.from("projects").select("*, clients(name, phone)").eq("id", data.projectId).maybeSingle();
    if (!project) throw new Error("Project not found");

    const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString();
    const weekAhead = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);

    const [{ data: doneTasks }, { data: nextTasks }, { data: overdue }, { data: photos }] = await Promise.all([
      supabase.from("tasks").select("title, updated_at").eq("project_id", data.projectId).eq("done", true).gte("updated_at", weekAgo),
      supabase.from("tasks").select("title, due_date").eq("project_id", data.projectId).eq("done", false).lte("due_date", weekAhead).order("due_date"),
      supabase.from("tasks").select("title, due_date").eq("project_id", data.projectId).eq("done", false).lt("due_date", new Date().toISOString().slice(0, 10)),
      supabase.from("photos").select("id, caption, room").eq("project_id", data.projectId).order("created_at", { ascending: false }).limit(3),
    ]);

    const client = (project as { clients?: { name?: string; phone?: string } | null }).clients;
    const body = [
      `Hi ${client?.name ?? "there"},`,
      ``,
      `Weekly update on ${project.name} — currently ${project.completion}% complete (${project.phase} phase).`,
      ``,
      `✅ Completed this week:`,
      ...((doneTasks ?? []).slice(0, 5).map((t) => `• ${t.title}`)),
      (doneTasks?.length ?? 0) === 0 ? "• Site coordination and vendor follow-ups" : "",
      ``,
      `📅 Planned next week:`,
      ...((nextTasks ?? []).slice(0, 5).map((t) => `• ${t.title}${t.due_date ? ` (${t.due_date})` : ""}`)),
      (nextTasks?.length ?? 0) === 0 ? "• Continuing planned activities" : "",
      ``,
      ...(overdue && overdue.length > 0
        ? [`⚠️ Delays: ${overdue.length} task(s) are running behind. We're catching up this week.`, ``]
        : [`✨ All on schedule.`, ``]),
      `Photos and full progress: your portal link.`,
      ``,
      `— Bhavik`,
    ].filter(Boolean).join("\n");

    const { data: inserted, error } = await supabase.from("ai_drafts").insert({
      user_id: userId,
      project_id: data.projectId,
      kind: "weekly_report",
      recipient_kind: "client",
      recipient_id: project.client_id,
      recipient_name: client?.name ?? null,
      recipient_phone: client?.phone ?? null,
      subject: `Weekly update — ${project.name}`,
      body,
      meta: { photoIds: (photos ?? []).map((p) => p.id), completion: project.completion },
    }).select("id").single();
    if (error) throw error;
    return { id: inserted.id };
  });

// ---------- Vendor follow-up ----------
export const generateVendorFollowup = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ deliveryId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: d } = await supabase.from("vendor_deliveries").select("*, vendors(name, phone), projects(name)").eq("id", data.deliveryId).maybeSingle();
    if (!d) throw new Error("Delivery not found");
    const v = (d as { vendors?: { name?: string; phone?: string } | null }).vendors;
    const p = (d as { projects?: { name?: string } | null }).projects;
    const body = `Hi ${v?.name ?? "there"}, just confirming delivery of ${d.item} for ${p?.name ?? "the project"} is on track for ${d.expected_date}. Please confirm.`;
    const { data: inserted, error } = await supabase.from("ai_drafts").insert({
      user_id: userId,
      project_id: d.project_id,
      kind: "vendor_followup",
      recipient_kind: "vendor",
      recipient_id: d.vendor_id,
      recipient_name: v?.name ?? null,
      recipient_phone: v?.phone ?? null,
      body,
      meta: { deliveryId: d.id, expected_date: d.expected_date },
    }).select("id").single();
    if (error) throw error;
    return { id: inserted.id };
  });

// ---------- Delay notice ----------
export const generateDelayNotice = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({
      projectId: z.string().uuid(),
      item: z.string().min(1).max(300),
      delayDays: z.number().int().min(1).max(365),
      newDate: z.string().min(1).max(50),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: project } = await supabase.from("projects").select("*, clients(name, phone)").eq("id", data.projectId).maybeSingle();
    if (!project) throw new Error("Project not found");
    const client = (project as { clients?: { name?: string; phone?: string } | null }).clients;
    const body = `Hi ${client?.name ?? "there"}, I wanted to update you that ${data.item} has been delayed by ${data.delayDays} day${data.delayDays === 1 ? "" : "s"}. New expected date is ${data.newDate}. This will not affect the overall handover timeline. — Bhavik`;
    const { data: inserted, error } = await supabase.from("ai_drafts").insert({
      user_id: userId,
      project_id: data.projectId,
      kind: "delay_notice",
      recipient_kind: "client",
      recipient_id: project.client_id,
      recipient_name: client?.name ?? null,
      recipient_phone: client?.phone ?? null,
      body,
      meta: { item: data.item, delayDays: data.delayDays },
    }).select("id").single();
    if (error) throw error;
    return { id: inserted.id };
  });

// ---------- Holding message ----------
export const generateHoldingMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ clientId: z.string().uuid(), projectId: z.string().uuid().optional() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: client } = await supabase.from("clients").select("*").eq("id", data.clientId).maybeSingle();
    if (!client) throw new Error("Client not found");
    const body = `Hi ${client.name}, thank you for your message. Bhavik will get back to you shortly.`;
    const { data: inserted, error } = await supabase.from("ai_drafts").insert({
      user_id: userId,
      project_id: data.projectId ?? null,
      kind: "holding",
      recipient_kind: "client",
      recipient_id: data.clientId,
      recipient_name: client.name,
      recipient_phone: client.phone,
      body,
      meta: {},
    }).select("id").single();
    if (error) throw error;
    return { id: inserted.id };
  });

// ---------- Event notification (WhatsApp push) ----------
export const generateEventNotification = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({
      projectId: z.string().uuid(),
      eventKind: z.enum(["photo_uploaded", "approval_needed", "invoice_sent", "milestone_completed"]),
      detail: z.string().max(300).optional(),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: project } = await supabase.from("projects").select("*, clients(name, phone)").eq("id", data.projectId).maybeSingle();
    if (!project) throw new Error("Project not found");
    const client = (project as { clients?: { name?: string; phone?: string } | null }).clients;
    const templates: Record<string, string> = {
      photo_uploaded: `Hi ${client?.name ?? "there"}, new progress photos from ${project.name} are now on your portal. Take a look!`,
      approval_needed: `Hi ${client?.name ?? "there"}, a quick approval is needed for ${project.name}${data.detail ? ` (${data.detail})` : ""}. Please review on the portal.`,
      invoice_sent: `Hi ${client?.name ?? "there"}, invoice ${data.detail ?? ""} for ${project.name} has been sent. You'll find it on your portal.`,
      milestone_completed: `Hi ${client?.name ?? "there"}, we just completed ${data.detail ?? "a key milestone"} on ${project.name}. On to the next.`,
    };
    const body = templates[data.eventKind];
    const { data: inserted, error } = await supabase.from("ai_drafts").insert({
      user_id: userId,
      project_id: data.projectId,
      kind: "event_notification",
      recipient_kind: "client",
      recipient_id: project.client_id,
      recipient_name: client?.name ?? null,
      recipient_phone: client?.phone ?? null,
      body,
      meta: { eventKind: data.eventKind, detail: data.detail ?? null },
    }).select("id").single();
    if (error) throw error;
    return { id: inserted.id };
  });

// ---------- Send draft (also writes to messages) ----------
export const sendDraft = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: draft } = await supabase.from("ai_drafts").select("*").eq("id", data.id).maybeSingle();
    if (!draft) throw new Error("Draft not found");
    if (draft.status !== "pending") throw new Error("Already actioned");

    const { error: msgErr } = await supabase.from("messages").insert({
      user_id: userId,
      body: draft.body,
      from_me: true,
      kind: draft.recipient_kind === "vendor" ? "vendor" : "client",
      thread_with: draft.recipient_id ?? null,
    });
    if (msgErr) throw msgErr;

    const { error } = await supabase.from("ai_drafts").update({ status: "sent", sent_at: new Date().toISOString() }).eq("id", data.id);
    if (error) throw error;
    return { ok: true, recipient: draft.recipient_name, phone: draft.recipient_phone };
  });
