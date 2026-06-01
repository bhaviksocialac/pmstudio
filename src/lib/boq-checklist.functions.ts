import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { WORK_TYPE_PHASE } from "@/lib/task-flow";

const AI_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
const MODEL = "google/gemini-2.5-pro";

const parseInputSchema = z.object({
  projectId: z.string().uuid(),
  fileBase64: z.string().min(1),
  filename: z.string().min(1).max(255),
  mime: z.string().min(1).max(120),
});

export type BoqPreviewItem = {
  phase: "Procurement" | "Execution" | "Finishing" | "Design" | "Survey" | "Handover";
  subcategory: string;
  title: string;
  room: string | null;
  amount: number | null;
  work_type: string;
  initial_status: string;
};

export type BoqPreview = {
  items: BoqPreviewItem[];
  totalsByWorkType: Record<string, number>;
  total: number;
};

const SYSTEM = `You read interior design BOQ (Bill of Quantities) documents and split each line into an actionable task. Reply with JSON only.`;

const ALLOWED_WORK_TYPES = [
  "Flooring","Tiling","Civil","Electrical","Painting","False Ceiling","Carpentry",
  "Plumbing","HVAC","Furniture","Lighting","Hardware","Windows","Other",
];
const ALLOWED_STATUSES = [
  "not_started","selection_pending","approval_pending","quotation_pending",
  "order_placed","payment_pending","material_ordered","material_delivered","wip","done",
];

function buildPrompt(text: string | null) {
  return `Extract EVERY BOQ line. For each line, return:
- phase: one of Procurement, Execution, Finishing, Design, Survey, Handover
- subcategory: short title under that phase (e.g. "False Ceiling", "Flooring Work")
- title: a concise task description (e.g. "Vitrified tiles — Living Room")
- room: specific room name if mentioned; "All" if it says "all rooms"; otherwise null
- amount: line item amount in INR (number) if specified, else null. NO commas.
- work_type: one of ${ALLOWED_WORK_TYPES.join(", ")}. Categorise by keywords:
  demolish/break/plaster/brickwork/waterproof → Civil
  wire/conduit/DB/switch/socket → Electrical
  wardrobe/cabinet/ceiling framework → Carpentry
  tile/flooring/skirting/vitrified/marble → Flooring (or Tiling if tile)
  paint/putty/primer/texture → Painting
  pipe/fitting/sanitary/drain → Plumbing
  AC/HVAC/duct/ventilation → HVAC
  window/glazing/glass shutter → Windows
  door/hardware/handle/lock/hinge → Hardware
  light/fixture/chandelier/spotlight → Lighting
  sofa/bed/dining/chair → Furniture
  unknown → Other
- initial_status: "selection_pending" for materials, "quotation_pending" for labour, else "not_started"

Rules:
- Material purchases → Procurement. On-site work → Execution. Final finishing → Finishing.
- Skip header rows, subtotal rows, grand totals, and pure notes.
- Every distinct line item becomes ONE task. Do not merge lines.
- Cap output at 150 items.

Return ONLY: {"items":[{"phase":"...","subcategory":"...","title":"...","room":null,"amount":null,"work_type":"...","initial_status":"..."}]}

${text ? `Document text:\n${text}` : "Document is attached."}`;
}

async function callGateway(messages: unknown[]): Promise<BoqPreviewItem[]> {
  const apiKey = process.env.LOVABLE_API_KEY;
  if (!apiKey) throw new Error("AI is not configured (missing LOVABLE_API_KEY).");
  const res = await fetch(AI_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: MODEL, messages, response_format: { type: "json_object" } }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    if (res.status === 429) throw new Error("Rate-limited by AI gateway. Wait a moment and try again.");
    if (res.status === 402) throw new Error("AI credits exhausted. Add credits in Workspace → Usage.");
    throw new Error(`AI gateway error ${res.status}: ${body.slice(0, 200)}`);
  }
  const json = await res.json();
  const raw = json.choices?.[0]?.message?.content ?? "{}";
  let parsed: { items?: unknown };
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("AI returned malformed JSON. Try uploading again.");
  }
  const items = Array.isArray(parsed.items) ? parsed.items : [];
  const phaseSet = new Set(["Procurement","Execution","Finishing","Design","Survey","Handover"]);
  const wtSet = new Set(ALLOWED_WORK_TYPES);
  const stSet = new Set(ALLOWED_STATUSES);
  return items.slice(0, 150).map((i: Record<string, unknown>): BoqPreviewItem => {
    const wt = typeof i.work_type === "string" && wtSet.has(i.work_type) ? i.work_type : "Other";
    return {
      phase: (typeof i.phase === "string" && phaseSet.has(i.phase) ? i.phase : "Execution") as BoqPreviewItem["phase"],
      subcategory: String(i.subcategory ?? "Other").slice(0, 80),
      title: String(i.title ?? "Untitled").slice(0, 120),
      room: i.room ? String(i.room).slice(0, 60) : null,
      amount: typeof i.amount === "number" && isFinite(i.amount) ? i.amount : null,
      work_type: wt,
      initial_status: typeof i.initial_status === "string" && stSet.has(i.initial_status) ? i.initial_status : "not_started",
    };
  });
}

async function extractPdfText(fileBase64: string): Promise<string> {
  const { extractText, getDocumentProxy } = await import("unpdf");
  const buf = Uint8Array.from(atob(fileBase64), (c) => c.charCodeAt(0));
  const pdf = await getDocumentProxy(buf);
  const { text } = await extractText(pdf, { mergePages: true });
  const joined = Array.isArray(text) ? text.join("\n") : String(text ?? "");
  return joined.trim();
}

/**
 * Reads a BOQ PDF/Excel and returns the proposed tasks for designer review.
 * Does NOT insert anything — call `saveBoqTasks` after the designer confirms.
 */
export const parseBoqChecklist = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => parseInputSchema.parse(input))
  .handler(async ({ data }): Promise<BoqPreview> => {
    const { fileBase64, filename, mime } = data;
    const isPdf = mime.includes("pdf") || filename.toLowerCase().endsWith(".pdf");
    const isExcel =
      mime.includes("spreadsheet") || mime.includes("excel") ||
      filename.toLowerCase().endsWith(".xlsx") || filename.toLowerCase().endsWith(".xls");

    let items: BoqPreviewItem[];
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
      let pdfText = "";
      try {
        pdfText = await extractPdfText(fileBase64);
      } catch (err) {
        throw new Error(`Could not read PDF: ${err instanceof Error ? err.message : "unknown error"}`);
      }
      if (pdfText.length < 30) {
        throw new Error("This PDF appears to be scanned (no extractable text). Please upload an Excel BOQ or a text-based PDF.");
      }
      pdfText = pdfText.slice(0, 80000);
      items = await callGateway([
        { role: "system", content: SYSTEM },
        { role: "user", content: buildPrompt(pdfText) },
      ]);
    } else {
      throw new Error("Upload a PDF or Excel (.xlsx, .xls) BOQ file.");
    }

    const totalsByWorkType: Record<string, number> = {};
    let total = 0;
    for (const it of items) {
      const a = it.amount ?? 0;
      total += a;
      totalsByWorkType[it.work_type] = (totalsByWorkType[it.work_type] ?? 0) + a;
    }

    return { items, totalsByWorkType, total };
  });

const saveItemSchema = z.object({
  phase: z.string().max(40),
  subcategory: z.string().max(80),
  title: z.string().min(1).max(160),
  room: z.string().max(60).nullable(),
  amount: z.number().nullable(),
  work_type: z.string().max(40),
  initial_status: z.string().max(40),
});

const saveInputSchema = z.object({
  projectId: z.string().uuid(),
  items: z.array(saveItemSchema).min(1).max(200),
});

/**
 * Persists the reviewed BOQ tasks. Each task gets boq_amount, source='boq',
 * inferred phase, and creates any missing phase subcategories.
 */
export const saveBoqTasks = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => saveInputSchema.parse(input))
  .handler(async ({ data, context }): Promise<{ created: number; subcategoriesAdded: number; total: number }> => {
    const { supabase, userId } = context;
    const { projectId, items } = data;

    // 1) Ensure subcategories exist
    const { data: existingSubs } = await supabase
      .from("phase_subcategories")
      .select("id,phase,name")
      .eq("project_id", projectId);
    const existingKey = new Set((existingSubs ?? []).map((s) => `${s.phase}::${s.name.toLowerCase()}`));

    const subRows: Array<{ user_id: string; project_id: string; phase: string; name: string; status: string; order_index: number }> = [];
    for (const it of items) {
      if (it.phase === "Procurement" || it.phase === "Execution" || it.phase === "Finishing") {
        const k = `${it.phase}::${it.subcategory.toLowerCase()}`;
        if (!existingKey.has(k)) {
          existingKey.add(k);
          subRows.push({
            user_id: userId, project_id: projectId, phase: it.phase, name: it.subcategory,
            status: "planned", order_index: 50,
          });
        }
      }
    }
    let subcategoriesAdded = 0;
    if (subRows.length) {
      const { error } = await supabase.from("phase_subcategories").insert(subRows);
      if (!error) subcategoriesAdded = subRows.length;
    }

    // 2) Insert tasks with boq_amount + phase
    const taskRows = items.map((it) => ({
      user_id: userId,
      project_id: projectId,
      title: it.title,
      description: it.amount ? `BOQ amount: ₹${Math.round(it.amount).toLocaleString("en-IN")}` : null,
      status: it.initial_status,
      priority: "Medium",
      area: it.room,
      room: it.room,
      work_type: it.work_type,
      phase: WORK_TYPE_PHASE[it.work_type] ?? it.phase ?? "Execution",
      boq_amount: it.amount,
      source: "boq",
      done: false,
    }));

    let created = 0;
    if (taskRows.length) {
      const { error } = await supabase.from("tasks").insert(taskRows);
      if (error) throw new Error(error.message);
      created = taskRows.length;
    }

    const total = items.reduce((s, it) => s + (it.amount ?? 0), 0);
    return { created, subcategoriesAdded, total };
  });
