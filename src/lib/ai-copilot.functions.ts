import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const AI_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
const MODEL = "google/gemini-2.5-flash";

const messageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().min(1).max(4000),
});

const inputSchema = z.object({
  messages: z.array(messageSchema).min(1).max(20),
});

type Action =
  | { kind: "answer" }
  | { kind: "create_task"; title: string; project_name?: string; due_date?: string; assignee?: string; priority?: "High" | "Medium" | "Low" }
  | { kind: "draft_message"; recipient: string; channel: "whatsapp" | "email"; body: string }
  | { kind: "update_status"; entity: "project" | "vendor_delivery" | "task"; target: string; status: string };

export const askCopilot = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => inputSchema.parse(input))
  .handler(async ({ data, context }): Promise<{ reply: string; action: Action }> => {
    const { supabase } = context;

    // Gather lightweight context for the model
    const [{ data: projects }, { data: tasks }, { data: vendors }, { data: invoices }] = await Promise.all([
      supabase.from("projects").select("id,name,phase,health,budget,spent,completion,expected_handover,start_date,location").limit(50),
      supabase.from("tasks").select("id,title,project_id,assignee,due_date,done").eq("done", false).limit(60),
      supabase.from("vendors").select("id,name,category,phone").limit(60),
      supabase.from("invoices").select("id,project_id,amount,status,milestone").limit(40),
    ]);

    const ctx = {
      today: new Date().toISOString().slice(0, 10),
      projects: projects ?? [],
      open_tasks: tasks ?? [],
      vendors: vendors ?? [],
      invoices: invoices ?? [],
    };

    const system = `You are PMStudio Copilot, an AI assistant for an interior design studio owner in India.
You help with project management. The user may write in English or Hindi (reply in the same language).
You have read-only access to their data which is provided in the system context as JSON.

You MUST respond with a single JSON object of the form:
{
  "reply": "A natural-language answer to the user (1-3 short paragraphs, plain text, no markdown).",
  "action": { "kind": "answer" }
}

OR if the user is asking you to take an action, propose it via "action" — the UI will show a confirm prompt before saving. Valid actions:
- { "kind": "create_task", "title": "...", "project_name": "...", "due_date": "YYYY-MM-DD", "assignee": "...", "priority": "High|Medium|Low" }
- { "kind": "draft_message", "recipient": "name", "channel": "whatsapp|email", "body": "..." }
- { "kind": "update_status", "entity": "project|vendor_delivery|task", "target": "id or name", "status": "..." }

Always include "reply" describing what you're proposing. Be concise and specific. Reference project names, vendor names, and concrete numbers from the context. Currency is INR; format as ₹X L (lakhs) when appropriate.

CONTEXT:
${JSON.stringify(ctx).slice(0, 12000)}`;

    const res = await fetch(AI_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [{ role: "system", content: system }, ...data.messages],
        response_format: { type: "json_object" },
      }),
    });

    if (!res.ok) {
      if (res.status === 429) return { reply: "I'm being rate-limited right now. Try again in a moment.", action: { kind: "answer" } };
      if (res.status === 402) return { reply: "AI credits exhausted — top up in Settings → Workspace → Usage.", action: { kind: "answer" } };
      return { reply: `AI gateway error (${res.status}). Try again.`, action: { kind: "answer" } };
    }

    const json = await res.json();
    const raw = json.choices?.[0]?.message?.content?.toString() ?? "{}";
    try {
      const parsed = JSON.parse(raw);
      const reply = typeof parsed.reply === "string" ? parsed.reply : "Done.";
      const action = parsed.action && typeof parsed.action === "object" ? parsed.action : { kind: "answer" };
      return { reply, action };
    } catch {
      return { reply: raw.slice(0, 1500), action: { kind: "answer" } };
    }
  });
