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
  if (!res.ok) throw new Error(`AI gateway ${res.status}`);
  const json = await res.json();
  return json.choices?.[0]?.message?.content?.toString() ?? "";
}

/* --- Suggest message routing --- */
export const suggestRoute = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ messageBody: z.string().min(1).max(2000) }).parse(input),
  )
  .handler(async ({ data }) => {
    const system =
      `You classify a project-management message into ONE of: client, design, execution, accounts, dm. ` +
      `Financial / invoice / payment → accounts. ` +
      `Site / construction / vendor delivery updates → execution. ` +
      `Mood-boards / drawings / 3D renders → design. ` +
      `Direct client question or status update → client. ` +
      `Private 1:1 → dm. ` +
      `Return JSON: {"kind":"...","reason":"short reason"} only.`;
    try {
      const out = await callAI(system, data.messageBody);
      const m = out.match(/\{[\s\S]*\}/);
      if (!m) return { kind: "client" as const, reason: "Default" };
      const parsed = JSON.parse(m[0]);
      const allowed = ["client", "design", "execution", "accounts", "dm"];
      const kind = allowed.includes(parsed.kind) ? parsed.kind : "client";
      return { kind, reason: String(parsed.reason ?? "").slice(0, 160) };
    } catch {
      return { kind: "client" as const, reason: "Default" };
    }
  });

/* --- Translate text to Hindi --- */
export const translateToHindi = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ text: z.string().min(1).max(3000) }).parse(input),
  )
  .handler(async ({ data }) => {
    const system =
      "Translate the user's message to natural conversational Hindi (Devanagari script). " +
      "Keep brand names, numbers and dates as-is. Return ONLY the translation, no preamble.";
    try {
      const out = await callAI(system, data.text);
      return { translated: out.trim() };
    } catch (e) {
      return { translated: "", error: e instanceof Error ? e.message : "Translation failed" };
    }
  });

/* --- Flag overdue tasks + create delay drafts --- */
export const flagOverdueTasks = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const todayStr = new Date().toISOString().slice(0, 10);
    const { data: tasks } = await supabase
      .from("tasks")
      .select("id, title, project_id, due_date, delayed")
      .eq("done", false)
      .lt("due_date", todayStr);
    if (!tasks || tasks.length === 0) return { flagged: 0, drafted: 0 };

    const ids = tasks.filter((t) => !t.delayed).map((t) => t.id);
    if (ids.length) {
      await supabase.from("tasks").update({ delayed: true }).in("id", ids);
    }

    let drafted = 0;
    for (const t of tasks) {
      if (!t.project_id) continue;
      // dedupe: existing pending/sent delay draft for this task?
      const { data: existing } = await supabase
        .from("ai_drafts")
        .select("id")
        .eq("kind", "delay_notice")
        .contains("meta", { taskId: t.id })
        .maybeSingle();
      if (existing) continue;
      const { data: project } = await supabase
        .from("projects")
        .select("client_id, clients(name, phone)")
        .eq("id", t.project_id)
        .maybeSingle();
      if (!project) continue;
      const client = (project as { clients?: { name?: string; phone?: string } | null }).clients;
      const daysLate = Math.max(
        1,
        Math.round((Date.now() - new Date(t.due_date!).getTime()) / 86400000),
      );
      const newDate = new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10);
      await supabase.from("ai_drafts").insert({
        user_id: userId,
        project_id: t.project_id,
        kind: "delay_notice",
        recipient_kind: "client",
        recipient_id: project.client_id,
        recipient_name: client?.name ?? null,
        recipient_phone: client?.phone ?? null,
        body: `Hi ${client?.name ?? "there"}, I wanted to update you that "${t.title}" has been delayed by ${daysLate} day${daysLate === 1 ? "" : "s"}. New expected date is ${newDate}. This will not affect the overall handover timeline. — Bhavik`,
        meta: { taskId: t.id, delayDays: daysLate },
      });
      drafted++;
    }
    return { flagged: ids.length, drafted };
  });
