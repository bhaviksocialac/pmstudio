import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const AI_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
const MODEL = "google/gemini-2.5-flash-lite";

const inputSchema = z.object({
  subcategoryName: z.string().min(1).max(120),
  phase: z.string().min(1).max(40),
  projectType: z.string().max(60).optional(),
});

export const generateSubcategoryChecklist = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => inputSchema.parse(input))
  .handler(async ({ data }): Promise<{ items: string[] }> => {
    const prompt = `Generate a checklist of 5-8 concrete, ordered work items for "${data.subcategoryName}" under the ${data.phase} phase of an Indian interior design project${data.projectType ? ` (${data.projectType})` : ""}.
Each item is one short imperative sentence (max 70 chars). Return JSON: {"items": ["...", "..."]}.`;

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
    const raw = json.choices?.[0]?.message?.content ?? "{}";
    try {
      const parsed = JSON.parse(raw);
      const items = Array.isArray(parsed.items) ? parsed.items.map((s: unknown) => String(s).slice(0, 120)).filter(Boolean).slice(0, 12) : [];
      return { items };
    } catch {
      return { items: [] };
    }
  });
