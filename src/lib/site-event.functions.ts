import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const AI_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
const MODEL = "google/gemini-2.5-flash";

const inputSchema = z.object({
  projectId: z.string().uuid(),
  message: z.string().min(1).max(2000),
});

export const parseSiteEvent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => inputSchema.parse(input))
  .handler(async ({ data, context }): Promise<{ reply: string; applied: string[] }> => {
    const { supabase, userId } = context;

    const [{ data: vendors }, { data: subs }] = await Promise.all([
      supabase.from("vendors").select("id,name").eq("user_id", userId),
      supabase.from("phase_subcategories").select("id,name,phase").eq("project_id", data.projectId),
    ]);

    const today = new Date().toISOString().slice(0, 10);
    const system = `You are an event parser for an interior design site log.
Classify the designer's note into ONE of: payment, delivery, approval, none.

Return JSON:
{
  "reply": "1-sentence confirmation in plain English",
  "events": [
    { "kind": "payment", "vendor_name": "...", "amount": number, "scope": "optional" },
    { "kind": "delivery", "vendor_name": "optional", "item": "...", "expected_date": "YYYY-MM-DD", "status": "pending|delivered|delayed" },
    { "kind": "approval", "title": "what was approved", "status": "pending|approved|rejected" }
  ]
}

Rules:
- Payment: words like "paid", "payment", "advance", "transferred", "₹", "lakh".
- Delivery: "delivered", "arrived", "shipped", "delayed", "pending material".
- Approval: "approved by client", "client signed off", "rejected", "pending approval".
- Match vendor names case-insensitively against context. Omit unknowns.
- Today: ${today}.

CONTEXT vendors: ${JSON.stringify(vendors ?? [])}
subcategories: ${JSON.stringify(subs ?? [])}`;

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
      if (res.status === 429) return { reply: "Rate-limited.", applied: [] };
      if (res.status === 402) return { reply: "AI credits exhausted.", applied: [] };
      return { reply: `AI error (${res.status}).`, applied: [] };
    }

    const json = await res.json();
    const raw = json.choices?.[0]?.message?.content ?? "{}";
    let parsed: { reply?: string; events?: any[] };
    try { parsed = JSON.parse(raw); } catch { return { reply: "Couldn't parse AI response.", applied: [] }; }

    const findVendorId = (name?: string) => {
      if (!name) return null;
      const v = (vendors ?? []).find((x) => x.name.toLowerCase() === name.toLowerCase()) ||
                (vendors ?? []).find((x) => x.name.toLowerCase().includes(name.toLowerCase()));
      return v?.id ?? null;
    };

    const applied: string[] = [];
    for (const e of parsed.events ?? []) {
      try {
        if (e.kind === "payment" && typeof e.amount === "number") {
          await supabase.from("payment_requests").insert({
            user_id: userId,
            project_id: data.projectId,
            vendor_id: findVendorId(e.vendor_name),
            amount: e.amount,
            scope: e.scope ?? null,
            status: "pending",
          });
          applied.push(`Payment ₹${e.amount}${e.vendor_name ? ` to ${e.vendor_name}` : ""}`);
        } else if (e.kind === "delivery" && e.item) {
          await supabase.from("vendor_deliveries").insert({
            user_id: userId,
            project_id: data.projectId,
            vendor_id: findVendorId(e.vendor_name),
            item: e.item,
            expected_date: e.expected_date ?? today,
            status: e.status === "delivered" ? "delivered" : e.status === "delayed" ? "delayed" : "pending",
          });
          applied.push(`Delivery: ${e.item}`);
        } else if (e.kind === "approval" && e.title) {
          await supabase.from("approvals").insert({
            user_id: userId,
            project_id: data.projectId,
            title: e.title,
            status: e.status === "approved" ? "approved" : e.status === "rejected" ? "rejected" : "pending",
            approved_at: e.status === "approved" ? new Date().toISOString() : null,
          });
          applied.push(`Approval: ${e.title}`);
        }
      } catch { /* skip */ }
    }

    return {
      reply: parsed.reply || (applied.length ? `Logged: ${applied.join("; ")}.` : "No events detected."),
      applied,
    };
  });
