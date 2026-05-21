import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const AI_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
const MODEL = "google/gemini-2.5-flash";

const inputSchema = z.object({
  projectId: z.string().uuid(),
  fileBase64: z.string().min(1),
  filename: z.string().min(1).max(255),
  mime: z.string().min(1).max(120),
});

type LineItem = {
  phase: "Procurement" | "Execution" | "Finishing" | "Design" | "Survey" | "Handover";
  subcategory: string;
  title: string;
  room?: string | null;
  amount?: number | null;
};

const SYSTEM = `You read interior design BOQ (Bill of Quantities) and split each line into an actionable task under a phase and subcategory. Always reply with JSON only.`;

function buildPrompt(text: string | null) {
  return `Extract every BOQ line. For each line, return:
- phase: one of Procurement, Execution, Finishing, Design, Survey, Handover
- subcategory: short title under that phase (e.g. "False Ceiling", "Civil Materials", "Flooring Work", "Electrical Work", "Painting", "Carpentry", "Tiling", "Plumbing")
- title: the task description (e.g. "False ceiling — Living Room")
- room: room name if mentioned, else null
- amount: amount in INR (number) if specified, else null

Rules:
- Material purchases → Procurement.
- On-site work (civil, plumbing, electrical, tiling, carpentry installation) → Execution.
- Final finishing (paint, polish, false ceiling, wallpaper) → Finishing.
- Keep titles concise (<80 chars). Include room if known.
- Cap output at 60 items.

Return ONLY: {"items":[{"phase":"...","subcategory":"...","title":"...","room":null,"amount":null}]}

${text ? `Document text:\n${text}` : "Document is attached."}`;
}

async function callGateway(messages: unknown[]): Promise<LineItem[]> {
  const res = await fetch(AI_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.LOVABLE_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: MODEL, messages, response_format: { type: "json_object" } }),
  });
  if (!res.ok) {
    if (res.status === 429) throw new Error("Rate-limited, try again.");
    if (res.status === 402) throw new Error("AI credits exhausted.");
    throw new Error(`AI gateway error ${res.status}`);
  }
  const json = await res.json();
  const raw = json.choices?.[0]?.message?.content ?? "{}";
  const parsed = JSON.parse(raw);
  const items = Array.isArray(parsed.items) ? parsed.items : [];
  const allowed = new Set(["Procurement", "Execution", "Finishing", "Design", "Survey", "Handover"]);
  return items.slice(0, 60).map((i: any) => ({
    phase: allowed.has(i.phase) ? i.phase : "Execution",
    subcategory: String(i.subcategory ?? "Other").slice(0, 80),
    title: String(i.title ?? "Untitled").slice(0, 120),
    room: i.room ? String(i.room).slice(0, 60) : null,
    amount: typeof i.amount === "number" ? i.amount : null,
  })) as LineItem[];
}

export const parseBoqChecklist = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => inputSchema.parse(input))
  .handler(async ({ data, context }): Promise<{ created: number; subcategoriesAdded: number }> => {
    const { supabase, userId } = context;
    const { fileBase64, filename, mime, projectId } = data;
    const isPdf = mime.includes("pdf") || filename.toLowerCase().endsWith(".pdf");
    const isExcel =
      mime.includes("spreadsheet") || mime.includes("excel") ||
      filename.toLowerCase().endsWith(".xlsx") || filename.toLowerCase().endsWith(".xls");

    let items: LineItem[] = [];
    if (isExcel) {
      const XLSX = await import("xlsx");
      const buf = Buffer.from(fileBase64, "base64");
      const wb = XLSX.read(buf, { type: "buffer" });
      let text = "";
      for (const name of wb.SheetNames) {
        text += `=== Sheet: ${name} ===\n` + XLSX.utils.sheet_to_csv(wb.Sheets[name]) + "\n";
      }
      text = text.slice(0, 60000);
      items = await callGateway([
        { role: "system", content: SYSTEM },
        { role: "user", content: buildPrompt(text) },
      ]);
    } else if (isPdf) {
      items = await callGateway([
        { role: "system", content: SYSTEM },
        {
          role: "user",
          content: [
            { type: "text", text: buildPrompt(null) },
            { type: "image_url", image_url: { url: `data:application/pdf;base64,${fileBase64}` } },
          ],
        },
      ]);
    } else {
      throw new Error("Upload PDF or Excel.");
    }

    // Ensure subcategories exist for Procurement / Execution items
    const { data: existingSubs } = await supabase
      .from("phase_subcategories")
      .select("id,phase,name")
      .eq("project_id", projectId);
    const existingKey = new Set((existingSubs ?? []).map((s: any) => `${s.phase}::${s.name.toLowerCase()}`));

    const toCreate: Array<{ user_id: string; project_id: string; phase: string; name: string; status: string; order_index: number }> = [];
    for (const it of items) {
      if (it.phase === "Procurement" || it.phase === "Execution") {
        const k = `${it.phase}::${it.subcategory.toLowerCase()}`;
        if (!existingKey.has(k)) {
          existingKey.add(k);
          toCreate.push({
            user_id: userId, project_id: projectId, phase: it.phase, name: it.subcategory,
            status: "planned", order_index: 50,
          });
        }
      }
    }
    let subcategoriesAdded = 0;
    if (toCreate.length) {
      const { error } = await supabase.from("phase_subcategories").insert(toCreate);
      if (!error) subcategoriesAdded = toCreate.length;
    }

    // Create tasks. Encode "[Priority] [Subcategory] title" so PhaseSubcategoriesPanel can group them.
    const taskRows = items.map((it) => ({
      user_id: userId,
      project_id: projectId,
      title: `[Medium] [${it.subcategory}] ${it.title}`,
      description: it.amount ? `BOQ amount: ₹${it.amount.toLocaleString("en-IN")}` : null,
      status: "todo",
      priority: "Medium",
      area: it.room ?? null,
      done: false,
    }));
    let created = 0;
    if (taskRows.length) {
      const { error } = await supabase.from("tasks").insert(taskRows);
      if (!error) created = taskRows.length;
    }

    return { created, subcategoriesAdded };
  });
