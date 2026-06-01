import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const AI_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
const MODEL = "google/gemini-2.5-flash";

const inputSchema = z.object({
  fileName: z.string().max(255),
  mimeType: z.string().max(120),
  base64: z.string().min(100).max(15_000_000), // ~10MB cap
});

export type VendorExtract = {
  company_name?: string;
  contact_person?: string;
  candidate_names?: string[];
  phone?: string;
  email?: string;
  gst?: string;
  pan?: string;
  ifsc?: string;
  bank_account?: string;
  flat_number?: string;
  street?: string;
  city?: string;
  state?: string;
  country?: string;
  pincode?: string;
  items?: { description: string; qty?: string; rate?: string; amount?: string }[];
  notes?: string;
};

export const extractVendorFromDocument = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => inputSchema.parse(input))
  .handler(async ({ data }): Promise<{ ok: boolean; data?: VendorExtract; error?: string }> => {
    const dataUri = `data:${data.mimeType};base64,${data.base64}`;

    const system = `You read invoices, quotations and Bills of Quantities (BOQ) for an interior design studio in India.

CRITICAL — WHOSE NAME TO EXTRACT as "company_name":
Extract the SUPPLIER / VENDOR / contractor — the company or person SUPPLYING the goods or services (and who will be PAID).
- DO take names from labels like: "From:", "Supplier:", "Vendor:", "Sold By:", "Bill From:", "Seller:", "Contractor:", letterhead at the very top of an invoice, or the GSTIN/PAN owner who is ISSUING the document.
- DO NOT use names near: "Prepared by:", "Issued to:", "Bill To:", "Client:", "Customer:", "Architect:", "Designer:", "Consultant:", "Project Manager:", "For:", "Attention:". These are NEVER the vendor.
- On a BOQ, the architect/designer who "prepared" the document is NOT the vendor. The vendor is the supplier the BOQ is addressed to or who quoted the rates.
- If you cannot confidently pick one supplier from multiple companies on the page, put your best guess in "company_name" AND list every distinct company/person name found on the document in "candidate_names" so the user can choose.

Return ONE JSON object with these optional keys:
{
  "company_name": string,        // SUPPLIER company name
  "contact_person": string,      // supplier-side contact
  "candidate_names": string[],   // every plausible vendor name on the doc; include company_name; omit if certain
  "phone": string,
  "email": string,
  "gst": string,                 // 15-char GSTIN of the supplier
  "pan": string,                 // 10-char PAN
  "ifsc": string,
  "bank_account": string,
  "flat_number": string,
  "street": string,
  "city": string,
  "state": string,
  "country": string,
  "pincode": string,             // 6-digit Indian PIN
  "items": [{ "description": string, "qty": string, "rate": string, "amount": string }],
  "notes": string
}
Omit keys you can't find. Do not invent values.`;

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
              { type: "text", text: `Extract vendor data from this document: ${data.fileName}` },
              { type: "image_url", image_url: { url: dataUri } },
            ],
          },
        ],
        response_format: { type: "json_object" },
      }),
    });

    if (!res.ok) {
      if (res.status === 429) return { ok: false, error: "Rate limit. Try again in a moment." };
      if (res.status === 402) return { ok: false, error: "AI credits exhausted." };
      const t = await res.text().catch(() => "");
      return { ok: false, error: `AI error (${res.status}): ${t.slice(0, 200)}` };
    }
    const json = await res.json();
    const raw = json.choices?.[0]?.message?.content ?? "{}";
    try {
      return { ok: true, data: JSON.parse(raw) as VendorExtract };
    } catch {
      return { ok: false, error: "Couldn't parse AI response." };
    }
  });
