import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export const Route = createFileRoute("/api/public/hooks/ai-drafts-cron")({
  server: {
    handlers: {
      POST: async () => {
        const admin = supabaseAdmin;
        const now = new Date();
        const todayStr = now.toISOString().slice(0, 10);
        const threeDaysOut = new Date(now.getTime() + 3 * 86400000).toISOString().slice(0, 10);
        const sixHoursAgo = new Date(now.getTime() - 6 * 3600 * 1000).toISOString();
        const isSunday9am = now.getUTCDay() === 0 && now.getUTCHours() === 9;
        const stats = { weekly: 0, followup: 0, delay: 0, holding: 0 };

        // ---- Weekly reports (Sunday 09:00 UTC) ----
        if (isSunday9am) {
          const { data: projects } = await admin.from("projects").select("id, user_id, name, completion, phase, client_id, clients(name, phone)");
          for (const p of projects ?? []) {
            const exists = await admin.from("ai_drafts").select("id")
              .eq("project_id", p.id).eq("kind", "weekly_report")
              .gte("created_at", new Date(now.getTime() - 6 * 86400000).toISOString())
              .maybeSingle();
            if (exists.data) continue;
            const client = (p as { clients?: { name?: string; phone?: string } | null }).clients;
            const body = `Hi ${client?.name ?? "there"},\n\nWeekly update on ${p.name} — currently ${p.completion}% complete (${p.phase} phase).\n\nFull progress and recent photos on your portal.\n\n— Bhavik`;
            await admin.from("ai_drafts").insert({
              user_id: p.user_id, project_id: p.id, kind: "weekly_report",
              recipient_kind: "client", recipient_id: p.client_id,
              recipient_name: client?.name ?? null, recipient_phone: client?.phone ?? null,
              subject: `Weekly update — ${p.name}`, body, meta: { auto: true },
            });
            stats.weekly++;
          }
        }

        // ---- Vendor follow-ups (3 days before delivery) ----
        const { data: deliveries } = await admin.from("vendor_deliveries")
          .select("*, vendors(name, phone), projects(name)")
          .eq("status", "pending").eq("expected_date", threeDaysOut);
        for (const d of deliveries ?? []) {
          const existing = await admin.from("ai_drafts").select("id")
            .eq("kind", "vendor_followup").contains("meta", { deliveryId: d.id }).maybeSingle();
          if (existing.data) continue;
          const v = (d as { vendors?: { name?: string; phone?: string } | null }).vendors;
          const p = (d as { projects?: { name?: string } | null }).projects;
          await admin.from("ai_drafts").insert({
            user_id: d.user_id, project_id: d.project_id, kind: "vendor_followup",
            recipient_kind: "vendor", recipient_id: d.vendor_id,
            recipient_name: v?.name ?? null, recipient_phone: v?.phone ?? null,
            body: `Hi ${v?.name ?? "there"}, just confirming delivery of ${d.item} for ${p?.name ?? "the project"} is on track for ${d.expected_date}. Please confirm.`,
            meta: { deliveryId: d.id, expected_date: d.expected_date },
          });
          stats.followup++;
        }

        // ---- Delay notices (overdue tasks) ----
        const { data: overdue } = await admin.from("tasks")
          .select("*, projects(id, user_id, name, client_id, clients(name, phone))")
          .eq("done", false).lt("due_date", todayStr).limit(50);
        for (const t of overdue ?? []) {
          const p = (t as { projects?: { id?: string; user_id?: string; name?: string; client_id?: string; clients?: { name?: string; phone?: string } | null } | null }).projects;
          if (!p?.id || !p?.user_id) continue;
          const existing = await admin.from("ai_drafts").select("id")
            .eq("kind", "delay_notice").contains("meta", { taskId: t.id }).maybeSingle();
          if (existing.data) continue;
          if (!t.due_date) continue;
          const daysLate = Math.max(1, Math.round((Date.now() - new Date(t.due_date).getTime()) / 86400000));
          const newDate = new Date(now.getTime() + 3 * 86400000).toISOString().slice(0, 10);
          await admin.from("ai_drafts").insert({
            user_id: p.user_id, project_id: p.id, kind: "delay_notice",
            recipient_kind: "client", recipient_id: p.client_id ?? null,
            recipient_name: p.clients?.name ?? null, recipient_phone: p.clients?.phone ?? null,
            body: `Hi ${p.clients?.name ?? "there"}, I wanted to update you that ${t.title} has been delayed by ${daysLate} day${daysLate === 1 ? "" : "s"}. New expected date is ${newDate}. This will not affect the overall handover timeline. — Bhavik`,
            meta: { taskId: t.id, delayDays: daysLate },
          });
          stats.delay++;
        }

        // ---- Holding messages (client message > 6h unanswered) ----
        const { data: inbound } = await admin.from("messages")
          .select("*").eq("from_me", false).eq("kind", "client")
          .lt("sent_at", sixHoursAgo)
          .gte("sent_at", new Date(now.getTime() - 7 * 86400000).toISOString())
          .order("sent_at", { ascending: false }).limit(100);
        for (const m of inbound ?? []) {
          if (!m.thread_with) continue;
          // any reply after this message?
          const reply = await admin.from("messages").select("id")
            .eq("user_id", m.user_id).eq("thread_with", m.thread_with).eq("from_me", true)
            .gte("sent_at", m.sent_at).maybeSingle();
          if (reply.data) continue;
          // any pending holding draft for this client already?
          const existing = await admin.from("ai_drafts").select("id")
            .eq("kind", "holding").eq("recipient_id", m.thread_with).eq("status", "pending").maybeSingle();
          if (existing.data) continue;
          const { data: client } = await admin.from("clients").select("name, phone").eq("id", m.thread_with).maybeSingle();
          if (!client) continue;
          await admin.from("ai_drafts").insert({
            user_id: m.user_id, project_id: null, kind: "holding",
            recipient_kind: "client", recipient_id: m.thread_with,
            recipient_name: client.name, recipient_phone: client.phone,
            body: `Hi ${client.name}, thank you for your message. Bhavik will get back to you shortly.`,
            meta: { triggerMessageId: m.id },
          });
          stats.holding++;
        }

        return new Response(JSON.stringify({ ok: true, stats }), {
          headers: { "Content-Type": "application/json" },
        });
      },
    },
  },
});
