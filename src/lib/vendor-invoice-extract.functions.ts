import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const AI_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
const MODEL = "google/gemini-2.5-pro";

const inputSchema = z.object({
  fileName: z.string().max(255),
  mimeType: z.string().max(120),
  base64: z.string().min(100).max(15_000_000),
});

export type InvoiceLineExtract = {
  description: string | null;
  quantity: number | null;
  unit: string | null;
  rate: number | null;
  amount: number | null;
};

export type InvoiceExtract = {
  company_name: string | null;
  invoice_number: string | null;
  invoice_date: string | null; // ISO yyyy-mm-dd
  due_date: string | null;
  subtotal: number | null;
  gst_percent: number | null;
  gst_amount: number | null;
  total_amount: number | null;
  bank_account: string | null;
  ifsc: string | null;
  bank_name: string | null;
  gst: string | null;
  notes: string | null;
  terms: string | null;
  lines: InvoiceLineExtract[];
};

const EMPTY: InvoiceExtract = {
  company_name: null, invoice_number: null, invoice_date: null, due_date: null,
  subtotal: null, gst_percent: null, gst_amount: null, total_amount: null,
  bank_account: null, ifsc: null, bank_name: null, gst: null,
  notes: null, terms: null, lines: [],
};

export const extractInvoiceFromDocument = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => inputSchema.parse(input))
  .handler(async ({ data }): Promise<{ ok: boolean; data?: InvoiceExtract; missingFields?: string[]; error?: string }> => {
    const dataUri = `data:${data.mimeType};base64,${data.base64}`;

    const system = `You are reading a vendor invoice for an Indian interior design studio.
Extract every field accurately using the provided tool. Dates MUST be ISO yyyy-mm-dd.
Numbers must be plain numbers (no commas, no ₹ symbol). If a field is not present, return null.
Extract every line item as a separate row.`;

    const tool = {
      type: "function" as const,
      function: {
        name: "save_invoice",
        description: "Save all extracted invoice fields.",
        parameters: {
          type: "object",
          properties: {
            company_name: { type: ["string", "null"] },
            invoice_number: { type: ["string", "null"] },
            invoice_date: { type: ["string", "null"], description: "ISO yyyy-mm-dd" },
            due_date: { type: ["string", "null"], description: "ISO yyyy-mm-dd" },
            subtotal: { type: ["number", "null"] },
            gst_percent: { type: ["number", "null"] },
            gst_amount: { type: ["number", "null"] },
            total_amount: { type: ["number", "null"] },
            bank_account: { type: ["string", "null"] },
            ifsc: { type: ["string", "null"] },
            bank_name: { type: ["string", "null"] },
            gst: { type: ["string", "null"], description: "15-char GSTIN" },
            notes: { type: ["string", "null"] },
            terms: { type: ["string", "null"] },
            lines: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  description: { type: ["string", "null"] },
                  quantity: { type: ["number", "null"] },
                  unit: { type: ["string", "null"] },
                  rate: { type: ["number", "null"] },
                  amount: { type: ["number", "null"] },
                },
                required: ["description", "quantity", "unit", "rate", "amount"],
                additionalProperties: false,
              },
            },
          },
          required: [
            "company_name","invoice_number","invoice_date","due_date",
            "subtotal","gst_percent","gst_amount","total_amount",
            "bank_account","ifsc","bank_name","gst","notes","terms","lines",
          ],
          additionalProperties: false,
        },
      },
    };

    const res = await fetch(AI_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: "system", content: system },
          {
            role: "user",
            content: [
              { type: "text", text: `Extract every field from this invoice: ${data.fileName}` },
              { type: "image_url", image_url: { url: dataUri } },
            ],
          },
        ],
        tools: [tool],
        tool_choice: { type: "function", function: { name: "save_invoice" } },
      }),
    });

    if (!res.ok) {
      if (res.status === 429) return { ok: false, error: "Rate limit. Try again in a moment." };
      if (res.status === 402) return { ok: false, error: "AI credits exhausted. Add credits to continue." };
      const t = await res.text().catch(() => "");
      return { ok: false, error: `AI error (${res.status}): ${t.slice(0, 200)}` };
    }
    const json = await res.json();
    const call = json.choices?.[0]?.message?.tool_calls?.[0];
    if (!call) return { ok: true, data: EMPTY, missingFields: Object.keys(EMPTY).filter((k) => k !== "lines") };
    let parsed: InvoiceExtract;
    try {
      parsed = JSON.parse(call.function.arguments) as InvoiceExtract;
    } catch {
      return { ok: false, error: "Couldn't parse AI response." };
    }
    if (!Array.isArray(parsed.lines)) parsed.lines = [];
    const missingFields = Object.entries(parsed)
      .filter(([k, v]) => k !== "lines" && (v === null || v === undefined || v === ""))
      .map(([k]) => k);
    return { ok: true, data: parsed, missingFields };
  });
