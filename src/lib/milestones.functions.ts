import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { tasksForMilestone, triggerLatestDoneDate, milestoneProgress, type MilestoneKind, type MilestoneStatus, type MilestoneTrigger } from "@/lib/milestone-eval";
import type { TaskLite } from "@/lib/phase-sync";

const AI_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";

const triggerSchema = z.object({
  room: z.string().optional(),
  phase: z.string().optional(),
  work_type: z.string().optional(),
  task_ids: z.array(z.string()).optional(),
});

const milestoneInput = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(2000).optional().nullable(),
  kind: z.enum(["room", "phase", "work_type", "custom"]),
  trigger: triggerSchema,
  invoice_amount: z.number().min(0),
  client_message_template: z.string().max(4000).optional().nullable(),
});

export type MilestoneRow = {
  id: string;
  project_id: string;
  name: string;
  description: string | null;
  kind: MilestoneKind;
  trigger: MilestoneTrigger;
  invoice_amount: number;
  client_message_template: string | null;
  status: MilestoneStatus;
  triggered_at: string | null;
  triggered_on_time: boolean | null;
  invoice_id: string | null;
  approval_id: string | null;
  order_index: number;
};

export type MilestoneWithProgress = MilestoneRow & {
  progress: { done: number; total: number; pct: number; complete: boolean; delayed: boolean };
};

// ---------- list ----------

export const listMilestones = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ projectId: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }): Promise<MilestoneWithProgress[]> => {
    const { supabase } = context;
    const [{ data: ms }, { data: tasks }] = await Promise.all([
      supabase.from("milestones").select("*").eq("project_id", data.projectId).order("order_index"),
      supabase.from("tasks").select("id,status,done,work_type,work_types,areas,area,room,completion_pct,phase,ifr_date,ifa_date,ifc_date,planned_end,due_date,actual_end").eq("project_id", data.projectId),
    ]);
    const allTasks = (tasks ?? []) as TaskLite[];
    return ((ms ?? []) as MilestoneRow[]).map((m) => ({
      ...m,
      progress: (() => {
        const p = milestoneProgress({ kind: m.kind, trigger: m.trigger }, allTasks);
        return { done: p.done, total: p.total, pct: p.pct, complete: p.complete, delayed: p.delayed };
      })(),
    }));
  });

// ---------- create / update / delete ----------

export const createMilestones = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({
    projectId: z.string().uuid(),
    milestones: z.array(milestoneInput).min(1).max(50),
  }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: existing } = await supabase
      .from("milestones").select("order_index").eq("project_id", data.projectId)
      .order("order_index", { ascending: false }).limit(1);
    let next = (existing?.[0]?.order_index ?? -1) + 1;
    const rows = data.milestones.map((m) => ({
      user_id: userId,
      project_id: data.projectId,
      name: m.name,
      description: m.description ?? null,
      kind: m.kind,
      trigger: m.trigger,
      invoice_amount: m.invoice_amount,
      client_message_template: m.client_message_template ?? null,
      order_index: next++,
    }));
    const { error, data: ins } = await supabase.from("milestones").insert(rows).select("id");
    if (error) throw new Error(error.message);
    return { created: ins?.length ?? 0 };
  });

export const updateMilestone = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({
    id: z.string().uuid(),
    patch: milestoneInput.partial(),
  }).parse(i))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("milestones").update(data.patch).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteMilestone = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("milestones").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---------- evaluate (auto-fire) ----------

export type FiredMilestone = {
  id: string;
  name: string;
  invoice_amount: number;
  invoice_id: string | null;
  approval_id: string | null;
  triggered_at: string;
};

export const evaluateMilestones = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ projectId: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }): Promise<{ fired: FiredMilestone[] }> => {
    const { supabase, userId } = context;
    const [{ data: ms }, { data: tasks }, { data: project }] = await Promise.all([
      supabase.from("milestones").select("*").eq("project_id", data.projectId).eq("status", "pending"),
      supabase.from("tasks").select("id,status,done,work_type,work_types,areas,area,room,completion_pct,phase,ifr_date,ifa_date,ifc_date,planned_end,due_date,actual_end").eq("project_id", data.projectId),
      supabase.from("projects").select("name,client_id").eq("id", data.projectId).maybeSingle(),
    ]);

    const allTasks = (tasks ?? []) as TaskLite[];
    const fired: FiredMilestone[] = [];

    for (const m of (ms ?? []) as MilestoneRow[]) {
      const set = tasksForMilestone({ kind: m.kind, trigger: m.trigger }, allTasks);
      if (!set.length) continue;
      const allDone = set.every((t) => t.status === "done" || !!t.done);
      if (!allDone) continue;

      const triggeredAt = triggerLatestDoneDate({ kind: m.kind, trigger: m.trigger }, allTasks) ?? new Date().toISOString().slice(0, 10);
      const today = new Date().toISOString().slice(0, 10);
      const onTime = triggeredAt <= today;

      // 1. Create invoice draft
      const dueAt = new Date(triggeredAt);
      dueAt.setDate(dueAt.getDate() + 7);
      const invoiceNumber = `INV-${Date.now().toString(36).toUpperCase()}`;
      const { data: invIns } = await supabase.from("invoices").insert({
        user_id: userId,
        project_id: data.projectId,
        client_id: project?.client_id ?? null,
        number: invoiceNumber,
        milestone: m.name,
        amount: m.invoice_amount,
        status: "draft",
        sent_at: null,
        due_at: dueAt.toISOString().slice(0, 10),
      }).select("id").single();

      // 2. Create client update draft
      const template = m.client_message_template ?? defaultClientMessage(m.name, project?.name ?? "your project", m.invoice_amount, invoiceNumber);
      const { data: draftIns } = await supabase.from("ai_drafts").insert({
        user_id: userId,
        project_id: data.projectId,
        recipient_kind: "client",
        recipient_id: project?.client_id ?? null,
        kind: "event_notification",
        subject: `${m.name} — milestone complete`,
        body: template,
        status: "pending",
        meta: { milestone_id: m.id, milestone_name: m.name, invoice_id: invIns?.id ?? null, invoice_amount: m.invoice_amount },
      }).select("id").single();

      // 3. Mark milestone triggered
      await supabase.from("milestones").update({
        status: "triggered",
        triggered_at: new Date(triggeredAt).toISOString(),
        triggered_on_time: onTime,
        invoice_id: invIns?.id ?? null,
        approval_id: draftIns?.id ?? null,
      }).eq("id", m.id);

      fired.push({
        id: m.id,
        name: m.name,
        invoice_amount: m.invoice_amount,
        invoice_id: invIns?.id ?? null,
        approval_id: draftIns?.id ?? null,
        triggered_at: triggeredAt,
      });
    }

    return { fired };
  });

function defaultClientMessage(name: string, projectName: string, amount: number, invNo: string): string {
  const amt = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(amount);
  return `Hi,\n\nGreat news — "${name}" is now complete on ${projectName}. Photos from the site will follow shortly.\n\nAs per our schedule, the linked invoice (${invNo}) for ${amt} is attached. Payment is due within 7 days.\n\nPlease let me know if you'd like to do a site walkthrough.\n\nThank you!`;
}

// ---------- AI-suggest milestones ----------

const SuggestSchema = z.object({
  milestones: z.array(z.object({
    name: z.string(),
    description: z.string().optional(),
    kind: z.enum(["room", "phase", "work_type", "custom"]),
    trigger: triggerSchema,
    invoice_amount: z.number().min(0),
  })),
});

export type SuggestedMilestone = z.infer<typeof SuggestSchema>["milestones"][number];

export const suggestMilestones = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ projectId: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }): Promise<{ suggestions: SuggestedMilestone[] }> => {
    const { supabase } = context;
    const [{ data: project }, { data: rooms }, { data: budget }, { data: tasks }] = await Promise.all([
      supabase.from("projects").select("name,budget").eq("id", data.projectId).maybeSingle(),
      supabase.from("project_rooms").select("name").eq("project_id", data.projectId),
      supabase.from("budget_lines").select("category,amount").eq("project_id", data.projectId),
      supabase.from("tasks").select("work_type,work_types,room,areas,phase,status").eq("project_id", data.projectId).limit(200),
    ]);

    const ctx = {
      project: project?.name ?? "",
      total_budget: Number(project?.budget ?? 0),
      rooms: (rooms ?? []).map((r) => r.name),
      budget_lines: (budget ?? []).map((b) => ({ category: b.category, amount: Number(b.amount) })),
      work_types_in_use: Array.from(new Set((tasks ?? []).flatMap((t) => {
        const wts = Array.isArray(t.work_types) ? (t.work_types as string[]) : [];
        return [...wts, t.work_type].filter(Boolean) as string[];
      }))),
      phases_in_use: Array.from(new Set((tasks ?? []).map((t) => t.phase).filter(Boolean))),
    };

    const prompt = `You are an interior project billing planner. Suggest 3-6 high-value milestones that bill the client as work completes.
RULES:
- Each milestone fires when ALL its trigger tasks are Done. Designer never marks it manually.
- kind="room": fires when all tasks tagged to that room are done. trigger.room = room name.
- kind="phase": fires when all tasks in that lifecycle phase are done. trigger.phase = Survey|Design|Procurement|Execution|Finishing|Handover.
- kind="work_type": fires when all tasks of that work type are done across all rooms. trigger.work_type = e.g. Flooring, Tiling, Civil, Painting.
- Set invoice_amount sensibly from budget_lines (sum matching category). For a Handover/final milestone use a meaningful tail.
- Name is short and client-facing, e.g. "Flooring Complete", "Procurement Done", "Living Room Handover".
PROJECT CONTEXT (JSON):
${JSON.stringify(ctx)}`;

    const res = await fetch(AI_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [{ role: "user", content: prompt }],
        tools: [{
          type: "function",
          function: {
            name: "propose_milestones",
            description: "Return suggested milestones.",
            parameters: {
              type: "object",
              properties: {
                milestones: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      name: { type: "string" },
                      description: { type: "string" },
                      kind: { type: "string", enum: ["room", "phase", "work_type", "custom"] },
                      trigger: {
                        type: "object",
                        properties: {
                          room: { type: "string" },
                          phase: { type: "string" },
                          work_type: { type: "string" },
                        },
                      },
                      invoice_amount: { type: "number" },
                    },
                    required: ["name", "kind", "trigger", "invoice_amount"],
                  },
                },
              },
              required: ["milestones"],
            },
          },
        }],
        tool_choice: { type: "function", function: { name: "propose_milestones" } },
      }),
    });

    if (!res.ok) {
      if (res.status === 429) throw new Error("Rate limit hit. Try again in a moment.");
      if (res.status === 402) throw new Error("AI credits exhausted.");
      throw new Error(`AI error ${res.status}`);
    }
    const json = await res.json();
    const tc = json.choices?.[0]?.message?.tool_calls?.[0];
    const args = tc?.function?.arguments ? JSON.parse(tc.function.arguments) : { milestones: [] };
    const parsed = SuggestSchema.safeParse(args);
    return { suggestions: parsed.success ? parsed.data.milestones : [] };
  });
