import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { WORK_TYPE_PHASE } from "@/lib/task-flow";

const AI_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
const MODEL = "google/gemini-2.5-pro";

const ALLOWED_WORK_TYPES = [
  "Flooring", "Tiling", "Civil", "Electrical", "Painting", "False Ceiling",
  "Carpentry", "Plumbing", "HVAC", "Furniture", "Lighting", "Hardware", "Windows", "Other",
];

export type VendorLineItem = {
  description: string;
  quantity: number | null;
  unit: string | null;
  rate: number | null;
  amount: number;
  work_type: string;
  phase: "Procurement" | "Execution" | "Finishing";
};

const SYSTEM = `You read vendor quotations / BOQs for an Indian interior design studio. Extract EVERY line item. Reply with JSON only.`;

function prompt(text: string | null) {
  return `For each line item, return: description, quantity (number or null), unit (string or null), rate (number or null), amount (number, line total in INR — no commas, no symbols), work_type (one of ${ALLOWED_WORK_TYPES.join(", ")}), phase ("Procurement" for supply-only material, "Execution" for site work, "Finishing" for final polish).

Work-type rules by keywords in description:
- plaster, cement, brickwork, demolish, waterproof, RCC, masonry → Civil
- wire, conduit, switch, socket, DB, MCB, light point → Electrical
- wardrobe, cabinet, ceiling framework, plywood, laminate, modular → Carpentry
- tile, vitrified, marble, skirting → Tiling
- flooring, wooden floor, vinyl → Flooring
- paint, putty, primer, texture, polish → Painting
- pipe, sanitary, plumbing, drain, faucet, CP fitting → Plumbing
- AC, HVAC, duct, ventilation → HVAC
- window, glazing, glass shutter → Windows
- door, handle, lock, hinge, hardware → Hardware
- light, fixture, chandelier, spotlight, LED panel → Lighting
- sofa, bed, dining, chair, table → Furniture
- false ceiling, gypsum, POP → False Ceiling
- anything else → Other

Skip headers, subtotals, grand totals, and notes. Cap at 200 items.
Return ONLY: {"items":[{"description":"...","quantity":null,"unit":null,"rate":null,"amount":0,"work_type":"...","phase":"..."}]}

${text ? `Document text:\n${text}` : "Document is attached."}`;
}

async function callAi(messages: unknown[]): Promise<VendorLineItem[]> {
  const apiKey = process.env.LOVABLE_API_KEY;
  if (!apiKey) throw new Error("AI not configured (LOVABLE_API_KEY missing).");
  const res = await fetch(AI_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: MODEL, messages, response_format: { type: "json_object" } }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    if (res.status === 429) throw new Error("Rate-limited. Try again in a moment.");
    if (res.status === 402) throw new Error("AI credits exhausted. Add credits in Workspace → Usage.");
    throw new Error(`AI error ${res.status}: ${body.slice(0, 200)}`);
  }
  const json = await res.json();
  const raw = json.choices?.[0]?.message?.content ?? "{}";
  let parsed: { items?: unknown };
  try { parsed = JSON.parse(raw); } catch { throw new Error("AI returned malformed JSON."); }
  const items = Array.isArray(parsed.items) ? parsed.items : [];
  const wtSet = new Set(ALLOWED_WORK_TYPES);
  const phaseSet = new Set(["Procurement", "Execution", "Finishing"]);
  return items.slice(0, 200).map((i: Record<string, unknown>): VendorLineItem => {
    const wt = typeof i.work_type === "string" && wtSet.has(i.work_type) ? i.work_type : "Other";
    return {
      description: String(i.description ?? "Untitled").slice(0, 200),
      quantity: typeof i.quantity === "number" && isFinite(i.quantity) ? i.quantity : null,
      unit: i.unit ? String(i.unit).slice(0, 20) : null,
      rate: typeof i.rate === "number" && isFinite(i.rate) ? i.rate : null,
      amount: typeof i.amount === "number" && isFinite(i.amount) ? i.amount : 0,
      work_type: wt,
      phase: (typeof i.phase === "string" && phaseSet.has(i.phase) ? i.phase : "Execution") as VendorLineItem["phase"],
    };
  });
}

async function extractPdfText(b64: string): Promise<string> {
  const { extractText, getDocumentProxy } = await import("unpdf");
  const buf = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
  const pdf = await getDocumentProxy(buf);
  const { text } = await extractText(pdf, { mergePages: true });
  return (Array.isArray(text) ? text.join("\n") : String(text ?? "")).trim();
}

// =================== Parse + match ===================

const parseInputSchema = z.object({
  projectId: z.string().uuid(),
  vendorName: z.string().max(160),
  fileBase64: z.string().min(1),
  filename: z.string().min(1).max(255),
  mime: z.string().min(1).max(120),
});

export type VendorTaskMatch = {
  kind: "update" | "create";
  item: VendorLineItem;
  existingTask?: {
    id: string;
    title: string;
    work_type: string | null;
    contractor: string | null;
    boq_amount: number | null;
  };
};

export type VendorParseResult = {
  filename: string;
  items: VendorLineItem[];
  matches: VendorTaskMatch[];
  total: number;
};

/** Fuzzy-match each line to an existing project task and classify update vs create. */
function matchItems(
  items: VendorLineItem[],
  existing: Array<{ id: string; title: string; work_type: string | null; contractor: string | null; boq_amount: number | null }>,
): VendorTaskMatch[] {
  const used = new Set<string>();
  const norm = (s: string) =>
    s.toLowerCase().replace(/[^a-z0-9 ]+/g, " ").replace(/\s+/g, " ").trim();
  const tokens = (s: string) => new Set(norm(s).split(" ").filter((w) => w.length > 2));
  const jaccard = (a: Set<string>, b: Set<string>) => {
    if (!a.size || !b.size) return 0;
    let inter = 0;
    for (const t of a) if (b.has(t)) inter++;
    return inter / (a.size + b.size - inter);
  };
  return items.map((it): VendorTaskMatch => {
    const itTokens = tokens(it.description);
    let best: { row: typeof existing[number]; score: number } | null = null;
    for (const row of existing) {
      if (used.has(row.id)) continue;
      if (row.work_type && row.work_type !== it.work_type) continue;
      const score = jaccard(itTokens, tokens(row.title));
      if (score >= 0.45 && (!best || score > best.score)) best = { row, score };
    }
    if (best) {
      used.add(best.row.id);
      return { kind: "update", item: it, existingTask: best.row };
    }
    return { kind: "create", item: it };
  });
}

export const parseVendorQuotation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => parseInputSchema.parse(input))
  .handler(async ({ data, context }): Promise<VendorParseResult> => {
    const { supabase } = context;
    const { projectId, fileBase64, filename, mime } = data;
    const lower = filename.toLowerCase();
    const isPdf = mime.includes("pdf") || lower.endsWith(".pdf");
    const isExcel = mime.includes("spreadsheet") || mime.includes("excel") ||
      lower.endsWith(".xlsx") || lower.endsWith(".xls") || lower.endsWith(".csv");
    const isImage = mime.startsWith("image/") || /\.(jpe?g|png)$/i.test(lower);

    let items: VendorLineItem[];
    if (isExcel) {
      const XLSX = await import("xlsx");
      const buf = Buffer.from(fileBase64, "base64");
      const wb = XLSX.read(buf, { type: "buffer" });
      let text = "";
      for (const n of wb.SheetNames) {
        text += `=== Sheet: ${n} ===\n` + XLSX.utils.sheet_to_csv(wb.Sheets[n]) + "\n";
      }
      items = await callAi([
        { role: "system", content: SYSTEM },
        { role: "user", content: prompt(text.slice(0, 60000)) },
      ]);
    } else if (isPdf) {
      let text = "";
      try { text = await extractPdfText(fileBase64); } catch (e) {
        throw new Error(`Could not read PDF: ${e instanceof Error ? e.message : "unknown"}`);
      }
      if (text.length < 30) {
        // Fall back to image-style upload for scanned PDFs
        items = await callAi([
          { role: "system", content: SYSTEM },
          {
            role: "user",
            content: [
              { type: "text", text: prompt(null) },
              { type: "image_url", image_url: { url: `data:application/pdf;base64,${fileBase64}` } },
            ],
          },
        ]);
      } else {
        items = await callAi([
          { role: "system", content: SYSTEM },
          { role: "user", content: prompt(text.slice(0, 80000)) },
        ]);
      }
    } else if (isImage) {
      items = await callAi([
        { role: "system", content: SYSTEM },
        {
          role: "user",
          content: [
            { type: "text", text: prompt(null) },
            { type: "image_url", image_url: { url: `data:${mime || "image/jpeg"};base64,${fileBase64}` } },
          ],
        },
      ]);
    } else {
      throw new Error("Unsupported file type.");
    }

    const { data: existing } = await supabase
      .from("tasks")
      .select("id,title,work_type,contractor,boq_amount")
      .eq("project_id", projectId)
      .is("deleted_at", null);

    const matches = matchItems(items, existing ?? []);
    const total = items.reduce((s, it) => s + (it.amount || 0), 0);
    return { filename, items, matches, total };
  });

// =================== Confirm & save ===================

const confirmItemSchema = z.object({
  kind: z.enum(["update", "create"]),
  existing_task_id: z.string().uuid().nullable(),
  description: z.string().min(1).max(200),
  work_type: z.string().max(40),
  phase: z.string().max(40),
  amount: z.number(),
  room: z.string().max(60).nullable().optional(),
});

const confirmInputSchema = z.object({
  projectId: z.string().uuid(),
  projectVendorId: z.string().uuid(),
  vendorId: z.string().uuid(),
  vendorName: z.string().max(160),
  items: z.array(confirmItemSchema).min(1).max(200),
});

export type ConfirmResult = {
  updated: number;
  created: number;
  total: number;
  vendorName: string;
};

export const confirmVendorTasks = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => confirmInputSchema.parse(input))
  .handler(async ({ data, context }): Promise<ConfirmResult> => {
    const { supabase, userId } = context;
    const { projectId, projectVendorId, vendorId, vendorName, items } = data;

    let updated = 0;
    let created = 0;
    let total = 0;

    for (const it of items) {
      total += it.amount;
      if (it.kind === "update" && it.existing_task_id) {
        const { error } = await supabase
          .from("tasks")
          .update({
            vendor_id: vendorId,
            contractor: vendorName,
            agency: vendorName,
            boq_amount: it.amount,
            work_type: it.work_type,
          })
          .eq("id", it.existing_task_id);
        if (error) throw new Error(`Update failed: ${error.message}`);
        updated++;
      } else {
        const phase = WORK_TYPE_PHASE[it.work_type] ?? it.phase ?? "Execution";
        const { error } = await supabase.from("tasks").insert({
          user_id: userId,
          project_id: projectId,
          title: it.description,
          status: "not_started",
          priority: "Medium",
          work_type: it.work_type,
          phase,
          vendor_id: vendorId,
          contractor: vendorName,
          agency: vendorName,
          boq_amount: it.amount,
          source: "vendor",
          room: it.room ?? null,
          area: it.room ?? null,
        });
        if (error) throw new Error(`Create failed: ${error.message}`);
        created++;
      }
    }

    // Bump project_vendors PO amount with the new total
    await supabase.from("project_vendors").update({ po_amount: total }).eq("id", projectVendorId);

    return { updated, created, total, vendorName };
  });
