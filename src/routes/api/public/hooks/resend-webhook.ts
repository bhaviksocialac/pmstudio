import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

/**
 * Resend webhook receiver.
 * Configure in Resend dashboard: POST {site}/api/public/hooks/resend-webhook
 * Events handled: email.delivered, email.bounced, email.complained, email.delivery_delayed
 *
 * On bounce/complaint we mark the email_log row and create a WhatsApp fallback
 * draft (ai_drafts kind=holding) so the studio can reach the client by phone.
 */
export const Route = createFileRoute("/api/public/hooks/resend-webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let payload: any;
        try {
          payload = await request.json();
        } catch {
          return new Response("invalid json", { status: 400 });
        }
        const type: string | undefined = payload?.type;
        const data = payload?.data ?? {};
        const providerId: string | undefined = data.email_id ?? data.id;
        const recipient: string | undefined =
          (Array.isArray(data.to) ? data.to[0] : data.to) ?? undefined;

        if (!type || !providerId) {
          return new Response(JSON.stringify({ ok: true, ignored: true }), {
            headers: { "Content-Type": "application/json" },
          });
        }

        const { data: log } = await supabaseAdmin
          .from("email_log")
          .select("id, user_id, project_id, client_id, kind, recipient_email, recipient_name, subject")
          .eq("provider_id", providerId)
          .maybeSingle();

        // Map provider event → status
        let newStatus: "delivered" | "bounced" | "complained" | "failed" | null = null;
        if (type === "email.delivered") newStatus = "delivered";
        else if (type === "email.bounced") newStatus = "bounced";
        else if (type === "email.complained") newStatus = "complained";
        else if (type === "email.delivery_delayed") newStatus = null;

        if (log && newStatus) {
          await supabaseAdmin
            .from("email_log")
            .update({
              status: newStatus,
              error: newStatus === "bounced" || newStatus === "complained"
                ? JSON.stringify(data?.bounce ?? data?.reason ?? type)
                : null,
              meta: { ...(data ?? {}), event: type },
            })
            .eq("id", log.id);
        }

        // WhatsApp fallback on hard bounce / complaint
        if (log && (newStatus === "bounced" || newStatus === "complained") && log.client_id) {
          const { data: client } = await supabaseAdmin
            .from("clients")
            .select("name, phone")
            .eq("id", log.client_id)
            .maybeSingle();

          if (client?.phone) {
            // Dedupe: don't create a second fallback for same provider event
            const { data: existing } = await supabaseAdmin
              .from("ai_drafts")
              .select("id")
              .eq("kind", "holding")
              .contains("meta", { bounceProviderId: providerId })
              .maybeSingle();
            if (!existing) {
              const reason = newStatus === "bounced" ? "bounced" : "was marked as spam";
              const subjectHint = log.subject ? ` regarding "${log.subject}"` : "";
              await supabaseAdmin.from("ai_drafts").insert({
                user_id: log.user_id,
                project_id: log.project_id,
                kind: "holding",
                recipient_kind: "client",
                recipient_id: log.client_id,
                recipient_name: client.name ?? log.recipient_name,
                recipient_phone: client.phone,
                subject: `WhatsApp fallback — email ${reason}`,
                body: `Hi ${client.name ?? "there"}, just checking in over WhatsApp — our email${subjectHint} ${reason} and may not have reached you. Let me know if you'd like me to resend or share it here. — Bhavik`,
                meta: {
                  fallbackFor: "email",
                  bounceProviderId: providerId,
                  emailLogId: log.id,
                  emailKind: log.kind,
                },
              });
            }
          }
        }

        return new Response(JSON.stringify({ ok: true, status: newStatus }), {
          headers: { "Content-Type": "application/json" },
        });
      },
    },
  },
});
