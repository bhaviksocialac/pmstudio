import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const AI_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
const MODEL = "google/gemini-2.5-flash-lite";

// ---------- Interpret free-text site update -> task status change ----------

const interpretSchema = z.object({
  projectId: z.string().uuid(),
  text: z.string().min(2).max(500),
});

export const interpretTaskUpdate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => interpretSchema.parse(input))
  .handler(async ({ data, context }): Promise<{
    matched: boolean;
    taskId?: string;
    newStatus?: string;
    reply: string;
    clarification?: { question: string; candidates: { id: string; label: string }[] };
  }> => {
    const { supabase } = context;
    const { data: tasks } = await supabase
      .from("tasks")
      .select("id,title,area,work_type,status,contractor")
      .eq("project_id", data.projectId)
      .neq("status", "done")
      .limit(120);

    if (!tasks || tasks.length === 0) {
      return { matched: false, reply: "No active tasks in this project to update." };
    }

    const list = tasks.map((t, i) => {
      const parts = [t.work_type, t.area, t.contractor].filter(Boolean).join(" · ");
      return `${i}. [${t.id}] ${t.title}${parts ? ` (${parts})` : ""} — status: ${t.status}`;
    }).join("\n");

    const prompt = `You are interpreting a designer's site update for an interior project.
Match the message to ONE existing task and pick the most likely new status from this list:
not_started, selection_pending, approval_pending, quotation_pending, order_placed, payment_pending, material_ordered, material_delivered, wip, done.

Tasks:
${list}

Message: "${data.text}"

Return JSON:
{"task_id":"<uuid or empty>","new_status":"<status or empty>","confidence":0..1,"summary":"<one sentence>","clarification":"<empty or question if ambiguous>","candidate_ids":["<uuid>",...]}`;

    const res = await fetch(AI_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: MODEL,
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" },
      }),
    });
    if (!res.ok) {
      if (res.status === 429) throw new Error("Rate-limited, try again.");
      if (res.status === 402) throw new Error("AI credits exhausted.");
      throw new Error(`AI error ${res.status}`);
    }
    const json = await res.json();
    const parsed = JSON.parse(json.choices?.[0]?.message?.content ?? "{}");

    if (parsed.clarification && parsed.candidate_ids?.length) {
      const candidates = (parsed.candidate_ids as string[])
        .map((id) => tasks.find((t) => t.id === id))
        .filter(Boolean)
        .map((t) => ({ id: t!.id, label: `${t!.title}${t!.area ? ` — ${t!.area}` : ""}` }));
      return { matched: false, reply: parsed.clarification, clarification: { question: parsed.clarification, candidates } };
    }

    if (!parsed.task_id || !parsed.new_status || (parsed.confidence ?? 0) < 0.55) {
      return { matched: false, reply: "I couldn't match that to a specific task. Try mentioning the room or work type." };
    }

    const { error } = await supabase
      .from("tasks")
      .update({
        status: parsed.new_status,
        done: parsed.new_status === "done",
        updated_at: new Date().toISOString(),
      })
      .eq("id", parsed.task_id);
    if (error) throw new Error(error.message);

    // Run cascade for unblocked dependents
    let cascadeNote = "";
    if (parsed.new_status === "done" || parsed.new_status === "material_delivered") {
      const { data: dependents } = await supabase
        .from("tasks")
        .select("id,title,area,depends_on,status")
        .eq("project_id", data.projectId);
      const unblocked = (dependents ?? []).filter((d) => {
        const dep = Array.isArray(d.depends_on) ? (d.depends_on as string[]) : [];
        return dep.includes(parsed.task_id) &&
          (d.status === "not_started" || d.status === "todo" || d.status === "blocked");
      });
      if (unblocked.length) {
        const nextStatus = parsed.new_status === "material_delivered" ? "wip" : "selection_pending";
        await supabase.from("tasks")
          .update({ status: nextStatus })
          .in("id", unblocked.map((u) => u.id));
        cascadeNote = ` ${unblocked.length} dependent task${unblocked.length === 1 ? "" : "s"} can now begin.`;
      }
    }

    return {
      matched: true,
      taskId: parsed.task_id,
      newStatus: parsed.new_status,
      reply: (parsed.summary || "Updated.") + cascadeNote,
    };
  });

// ---------- Manual cascade trigger (when status flipped via UI) ----------

const cascadeSchema = z.object({ taskId: z.string().uuid(), projectId: z.string().uuid() });

export const cascadeDependents = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => cascadeSchema.parse(input))
  .handler(async ({ data, context }): Promise<{ unblocked: number }> => {
    const { supabase } = context;
    const { data: source } = await supabase.from("tasks").select("status").eq("id", data.taskId).maybeSingle();
    if (!source) return { unblocked: 0 };
    const isFinished = source.status === "done" || source.status === "material_delivered";
    if (!isFinished) return { unblocked: 0 };

    const { data: dependents } = await supabase
      .from("tasks")
      .select("id,depends_on,status")
      .eq("project_id", data.projectId);
    const targets = (dependents ?? []).filter((d) => {
      const dep = Array.isArray(d.depends_on) ? (d.depends_on as string[]) : [];
      return dep.includes(data.taskId) &&
        (d.status === "not_started" || d.status === "todo" || d.status === "blocked");
    });
    if (!targets.length) return { unblocked: 0 };
    const nextStatus = source.status === "material_delivered" ? "wip" : "selection_pending";
    await supabase.from("tasks").update({ status: nextStatus }).in("id", targets.map((t) => t.id));
    return { unblocked: targets.length };
  });

// ---------- Split a task with area="All" into one task per project room ----------

const splitSchema = z.object({ taskId: z.string().uuid() });

export const splitTaskPerRoom = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => splitSchema.parse(input))
  .handler(async ({ data, context }): Promise<{ created: number }> => {
    const { supabase, userId } = context;
    const { data: task } = await supabase
      .from("tasks").select("*").eq("id", data.taskId).maybeSingle();
    if (!task || !task.project_id) throw new Error("Task not found");

    const { data: rooms } = await supabase
      .from("project_rooms").select("name")
      .eq("project_id", task.project_id).order("order_index");
    const roomNames = (rooms ?? []).map((r) => r.name);
    if (!roomNames.length) throw new Error("No rooms defined for this project");

    const rows = roomNames.map((rn) => ({
      user_id: userId,
      project_id: task.project_id,
      title: task.title,
      description: task.description,
      status: task.status ?? "not_started",
      priority: task.priority ?? "Medium",
      area: rn,
      contractor: task.contractor,
      work_type: task.work_type,
      vendor_id: task.vendor_id,
      start_date: task.start_date,
      due_date: task.due_date,
      depends_on: task.depends_on ?? [],
      done: false,
    }));
    const { error } = await supabase.from("tasks").insert(rows);
    if (error) throw new Error(error.message);
    await supabase.from("tasks").delete().eq("id", task.id);
    return { created: rows.length };
  });
