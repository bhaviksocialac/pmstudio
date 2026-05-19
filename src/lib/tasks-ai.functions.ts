import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const PHASES = ["Survey", "Design", "Procurement", "Execution", "Finishing", "Handover"] as const;

const inputSchema = z.object({
  phase: z.enum(PHASES),
  projectName: z.string().min(1).max(160),
});

export const suggestPhaseTasks = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => inputSchema.parse(input))
  .handler(async ({ data }): Promise<{ tasks: string[] }> => {
    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-lite",
        messages: [
          {
            role: "system",
            content:
              "You suggest practical tasks for interior design project phases. Return only JSON.",
          },
          {
            role: "user",
            content: `Suggest 4 short concrete tasks (each under 8 words) for the ${data.phase} phase of "${data.projectName}". Return JSON: {"tasks": ["task1", "task2", "task3", "task4"]}`,
          },
        ],
        response_format: { type: "json_object" },
      }),
    });
    if (!res.ok) {
      return { tasks: defaultsFor(data.phase) };
    }
    const json = await res.json();
    try {
      const parsed = JSON.parse(json.choices?.[0]?.message?.content ?? "{}");
      const tasks = Array.isArray(parsed.tasks)
        ? parsed.tasks.map((t: unknown) => String(t).slice(0, 120)).filter(Boolean).slice(0, 4)
        : [];
      return { tasks: tasks.length ? tasks : defaultsFor(data.phase) };
    } catch {
      return { tasks: defaultsFor(data.phase) };
    }
  });

function defaultsFor(phase: (typeof PHASES)[number]): string[] {
  const map: Record<string, string[]> = {
    Survey: ["Site measurement visit", "Photograph existing condition", "Confirm scope with client", "Document utility locations"],
    Design: ["Prepare floor plan v1", "Share mood board with client", "Get design approval", "Finalize material palette"],
    Procurement: ["Follow up with tile vendor", "Confirm electrical fittings delivery", "Get 3 quotes for flooring", "Place furniture order"],
    Execution: ["Site inspection this week", "Coordinate plumber visit", "Check civil work quality", "Update client on progress"],
    Finishing: ["Schedule polish work", "Final paint touch-ups", "Install light fixtures", "Coordinate deep cleaning"],
    Handover: ["Prepare handover document", "Final walkthrough with client", "Submit warranty papers", "Collect final payment"],
  };
  return map[phase] ?? [];
}
