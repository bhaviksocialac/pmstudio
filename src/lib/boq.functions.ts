import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const inputSchema = z.object({
  fileBase64: z.string().min(1),
  filename: z.string().min(1).max(255),
  mime: z.string().min(1).max(120),
});

type BoqResult = {
  total_budget_lakhs: number;
  breakdown: { category: string; percentage: number; amount: number }[];
  rooms: string[];
};

const SYSTEM = `You read interior design BOQ (Bill of Quantities) or quotation documents and extract structured data. Always respond with JSON only.`;

function buildPrompt(text: string | null) {
  return `Extract from this BOQ/quotation:
1. total_budget_lakhs: total project budget in INR lakhs (1 lakh = 100,000)
2. breakdown: array of {category, percentage, amount in lakhs} covering categories like Civil, Electrical, Flooring, Furniture, Painting, Plumbing, Miscellaneous. Percentages sum to 100.
3. rooms: list of room names mentioned (e.g. "Living Room", "Master Bedroom", "Kitchen").

Return ONLY this JSON: {"total_budget_lakhs": number, "breakdown": [{"category": string, "percentage": number, "amount": number}], "rooms": [string]}.

${text ? `Document text:\n${text}` : "Document is attached."}`;
}

async function callGateway(messages: unknown[]): Promise<BoqResult> {
  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.LOVABLE_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages,
      response_format: { type: "json_object" },
    }),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`AI gateway error ${res.status}: ${t.slice(0, 200)}`);
  }
  const json = await res.json();
  const content = json.choices?.[0]?.message?.content ?? "{}";
  const parsed = JSON.parse(content);
  return {
    total_budget_lakhs: Number(parsed.total_budget_lakhs) || 0,
    breakdown: Array.isArray(parsed.breakdown)
      ? parsed.breakdown.map((b: { category?: string; percentage?: number; amount?: number }) => ({
          category: String(b.category ?? "").slice(0, 60),
          percentage: Number(b.percentage) || 0,
          amount: Number(b.amount) || 0,
        }))
      : [],
    rooms: Array.isArray(parsed.rooms)
      ? parsed.rooms.map((r: unknown) => String(r).slice(0, 80)).filter(Boolean)
      : [],
  };
}

export const parseBoq = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => inputSchema.parse(input))
  .handler(async ({ data }): Promise<BoqResult> => {
    const { fileBase64, filename, mime } = data;
    const isPdf = mime.includes("pdf") || filename.toLowerCase().endsWith(".pdf");
    const isExcel =
      mime.includes("spreadsheet") ||
      mime.includes("excel") ||
      filename.toLowerCase().endsWith(".xlsx") ||
      filename.toLowerCase().endsWith(".xls");

    if (isExcel) {
      // Convert excel to CSV text on the server, then send as text prompt
      const XLSX = await import("xlsx");
      const buf = Buffer.from(fileBase64, "base64");
      const wb = XLSX.read(buf, { type: "buffer" });
      let text = "";
      for (const name of wb.SheetNames) {
        text += `=== Sheet: ${name} ===\n`;
        text += XLSX.utils.sheet_to_csv(wb.Sheets[name]);
        text += "\n";
      }
      // Truncate to avoid huge prompts
      text = text.slice(0, 60000);
      return callGateway([
        { role: "system", content: SYSTEM },
        { role: "user", content: buildPrompt(text) },
      ]);
    }

    if (isPdf) {
      return callGateway([
        { role: "system", content: SYSTEM },
        {
          role: "user",
          content: [
            { type: "text", text: buildPrompt(null) },
            {
              type: "image_url",
              image_url: { url: `data:application/pdf;base64,${fileBase64}` },
            },
          ],
        },
      ]);
    }

    throw new Error("Unsupported file type. Upload PDF or Excel.");
  });
