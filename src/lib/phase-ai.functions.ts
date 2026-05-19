import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const AI_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
const MODEL = "google/gemini-2.5-flash";

const inputSchema = z.object({
  projectId: z.string().uuid(),
  message: z.string().min(1).max(2000),
});

type Update = {
  phase?: string;
  phase_status?: "planned" | "active" | "done";
  phase_completion?: number;
  subcategory?: { phase: "Procurement" | "Execution"; name: string; status?: string; contractor_name?: string; start_date?: string; end_date?: string };
};

export const parsePhaseUpdate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => inputSchema.parse(input))
  .handler(async ({ data, context }): Promise<{ reply: string; applied: string[] }> => {
    const { supabase } = context;

    // Fetch project context
    const [{ data: project }, { data: phaseRows }, { data: subs }] = await Promise.all([
      supabase.from("projects").select("id,name,phase,completion").eq("id", data.projectId).maybeSingle(),
      supabase.from("project_phases").select("phase,status,completion").eq("project_id", data.projectId),
      supabase.from("phase_subcategories").select("id,phase,name,status,contractor_name").eq("project_id", data.projectId),
    ]);

    const ctx = { project, phaseRows: phaseRows ?? [], subcategories: subs ?? [] };

    const system = `You are a site-update parser for an interior design project manager.
The designer dictates what happened on site. Identify which phase or subcategory to update.

PHASES: Survey, Design, Procurement, Execution, Finishing, Handover.
Procurement and Execution have SUBCATEGORIES (see context).

Respond with a single JSON object:
{
  "reply": "Short confirmation in plain English (1 sentence).",
  "updates": [
    { "kind": "phase", "phase": "Execution", "status": "active" | "done" | "planned", "completion": 0-100 },
    { "kind": "subcategory", "parent_phase": "Procurement" | "Execution", "name": "exact name from context OR new", "status": "planned|in_progress|done|delayed", "contractor_name": "optional", "start_date": "YYYY-MM-DD optional", "end_date": "YYYY-MM-DD optional" }
  ]
}

Rules:
- "started" / "begun" / "rough-in" → status: in_progress (sub) or active (phase) + today as start_date.
- "completed" / "done" / "finished" → status: done + today as end_date + completion 100.
- If user mentions tile/civil/electrical/etc work, prefer subcategory under Execution.
- If user mentions procurement / delivery / vendor / material → subcategory under Procurement.
- Match subcategory names case-insensitively to context. If no match, create a new one with a sensible name.
- Today is ${new Date().toISOString().slice(0, 10)}.

CONTEXT: ${JSON.stringify(ctx).slice(0, 6000)}`;

    const res = await fetch(AI_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: MODEL,
        messages: [{ role: "system", content: system }, { role: "user", content: data.message }],
        response_format: { type: "json_object" },
      }),
    });

    if (!res.ok) {
      if (res.status === 429) return { reply: "Rate-limited. Try again in a moment.", applied: [] };
      if (res.status === 402) return { reply: "AI credits exhausted.", applied: [] };
      return { reply: `AI error (${res.status}).`, applied: [] };
    }

    const json = await res.json();
    const raw = json.choices?.[0]?.message?.content ?? "{}";
    let parsed: { reply?: string; updates?: any[] };
    try { parsed = JSON.parse(raw); } catch { return { reply: "Couldn't parse AI response.", applied: [] }; }

    const applied: string[] = [];
    const today = new Date().toISOString().slice(0, 10);

    for (const u of parsed.updates ?? []) {
      try {
        if (u.kind === "phase" && u.phase) {
          const patch: Record<string, any> = {};
          if (u.status) patch.status = u.status;
          if (typeof u.completion === "number") patch.completion = Math.max(0, Math.min(100, u.completion));
          if (u.status === "active" && !patch.start_date) patch.start_date = today;
          if (u.status === "done") { patch.end_date = today; patch.completion = 100; }
          await supabase.from("project_phases").update(patch).eq("project_id", data.projectId).eq("phase", u.phase);
          // Bump project.phase if going active
          if (u.status === "active") await supabase.from("projects").update({ phase: u.phase }).eq("id", data.projectId);
          applied.push(`Phase "${u.phase}" → ${u.status ?? "updated"}`);
        } else if (u.kind === "subcategory" && u.parent_phase && u.name) {
          // Find existing
          const { data: existing } = await supabase
            .from("phase_subcategories")
            .select("id")
            .eq("project_id", data.projectId)
            .eq("phase", u.parent_phase)
            .ilike("name", u.name)
            .maybeSingle();
          const patch: Record<string, any> = {};
          if (u.status) patch.status = u.status;
          if (u.contractor_name) patch.contractor_name = u.contractor_name;
          if (u.start_date) patch.start_date = u.start_date;
          if (u.end_date) patch.end_date = u.end_date;
          if (u.status === "in_progress" && !patch.start_date) patch.start_date = today;
          if (u.status === "done" && !patch.end_date) patch.end_date = today;

          if (existing) {
            await supabase.from("phase_subcategories").update(patch).eq("id", existing.id);
            applied.push(`${u.parent_phase} → ${u.name}: ${u.status ?? "updated"}`);
          } else {
            await supabase.from("phase_subcategories").insert({
              user_id: context.userId,
              project_id: data.projectId,
              phase: u.parent_phase,
              name: u.name,
              status: u.status ?? "planned",
              contractor_name: u.contractor_name ?? null,
              start_date: u.start_date ?? null,
              end_date: u.end_date ?? null,
              order_index: 99,
            });
            applied.push(`Added "${u.name}" under ${u.parent_phase}`);
          }
        }
      } catch (e) {
        // skip individual failures
      }
    }

    return {
      reply: parsed.reply || (applied.length ? `Got it. Updated: ${applied.join("; ")}.` : "Noted, but I couldn't find anything to update."),
      applied,
    };
  });
