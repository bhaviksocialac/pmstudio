import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const AI_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
const MODEL = "google/gemini-2.5-pro";

const inputSchema = z.object({
  fileName: z.string().max(255),
  mimeType: z.string().max(120),
  base64: z.string().min(100).max(15_000_000),
  selectedCategories: z.array(z.string().max(80)).max(40).default([]),
});

export type QuotationLine = {
  description: string;
  scope_tag: "supply_fix" | "supply_only" | "labour_only" | "provisional" | "excluded";
  rate_type: "lump_sum" | "rate_based";
  quantity: number | null;
  unit: string | null;
  rate: number | null;
  amount: number;
};
export type QuotationCategory = { name: string; lines: QuotationLine[] };
export type QuotationExtract = { categories: QuotationCategory[]; vendor_name: string | null; total_amount: number | null };

const SCOPE_TAGS = ["supply_fix", "supply_only", "labour_only", "provisional", "excluded"] as const;

export const extractVendorQuotation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => inputSchema.parse(input))
  .handler(async ({ data }): Promise<{ ok: boolean; data?: QuotationExtract; error?: string }> => {
    const dataUri = `data:${data.mimeType};base64,${data.base64}`;
    const catHint = data.selectedCategories.length
      ? `Organize lines under these work categories where possible: ${data.selectedCategories.join(", ")}. If a line doesn't fit, use the most appropriate category name.`
      : `Group line items by their natural work category (Civil, Carpentry, Electrical, Plumbing, Flooring, Painting, etc).`;

    const system = `You read vendor quotations / BOQs / estimates for an Indian interior design studio.
Extract EVERY line item and organize them by work category. Numbers must be plain numbers (no commas, no ₹). Use the tool to return data.
${catHint}

For each line:
- rate_type = "rate_based" if the doc shows a unit+qty+rate, otherwise "lump_sum"
- scope_tag: pick best fit from supply_fix, supply_only, labour_only, provisional, excluded (default supply_fix)
- amount: line total in rupees

vendor_name should be the SUPPLIER / contractor issuing the quotation, NEVER the architect/designer/client. Look at "From:", letterhead, or GSTIN owner.`;

    const tool = {
      type: "function" as const,
      function: {
        name: "save_quotation",
        description: "Save extracted quotation organised by category.",
        parameters: {
          type: "object",
          properties: {
            vendor_name: { type: ["string", "null"] },
            total_amount: { type: ["number", "null"] },
            categories: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  name: { type: "string" },
                  lines: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        description: { type: "string" },
                        scope_tag: { type: "string", enum: SCOPE_TAGS as unknown as string[] },
                        rate_type: { type: "string", enum: ["lump_sum", "rate_based"] },
                        quantity: { type: ["number", "null"] },
                        unit: { type: ["string", "null"] },
                        rate: { type: ["number", "null"] },
                        amount: { type: "number" },
                      },
                      required: ["description", "scope_tag", "rate_type", "quantity", "unit", "rate", "amount"],
                      additionalProperties: false,
                    },
                  },
                },
                required: ["name", "lines"],
                additionalProperties: false,
              },
            },
          },
          required: ["vendor_name", "total_amount", "categories"],
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
              { type: "text", text: `Extract every line item from this quotation: ${data.fileName}` },
              { type: "image_url", image_url: { url: dataUri } },
            ],
          },
        ],
        tools: [tool],
        tool_choice: { type: "function", function: { name: "save_quotation" } },
      }),
    });
    if (!res.ok) {
      if (res.status === 429) return { ok: false, error: "Rate limit. Try again in a moment." };
      if (res.status === 402) return { ok: false, error: "AI credits exhausted." };
      const t = await res.text().catch(() => "");
      return { ok: false, error: `AI error (${res.status}): ${t.slice(0, 200)}` };
    }
    const json = await res.json();
    const call = json.choices?.[0]?.message?.tool_calls?.[0];
    if (!call) return { ok: false, error: "AI returned no structured data." };
    try {
      const parsed = JSON.parse(call.function.arguments) as QuotationExtract;
      if (!Array.isArray(parsed.categories)) parsed.categories = [];
      return { ok: true, data: parsed };
    } catch {
      return { ok: false, error: "Couldn't parse AI response." };
    }
  });
