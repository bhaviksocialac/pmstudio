import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { generateAndStoreReport } from "./daily-reports.server";

/** Manually (re)generate a daily report. Idempotent — skips if PDF exists. */
export const generateDailyReport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z
      .object({
        projectId: z.string().uuid(),
        date: z
          .string()
          .regex(/^\d{4}-\d{2}-\d{2}$/)
          .optional(),
      })
      .parse(i),
  )
  .handler(async ({ data }) => {
    const date = data.date ?? new Date().toISOString().slice(0, 10);
    return generateAndStoreReport(data.projectId, date);
  });

/** Email + WhatsApp the report PDF to the project's client. */
export const sendReportToClient = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ reportId: z.string().uuid() }).parse(i))
  .handler(async ({ data }) => {
    const { data: report } = await supabaseAdmin
      .from("site_reports")
      .select("id, user_id, project_id, report_date, pdf_url")
      .eq("id", data.reportId)
      .maybeSingle();
    if (!report) return { ok: false, error: "Report not found" };
    if (!report.pdf_url) return { ok: false, error: "PDF not generated yet" };

    const { data: project } = await supabaseAdmin
      .from("projects")
      .select("id, name, client_id, clients(name, email, phone, whatsapp)")
      .eq("id", report.project_id)
      .maybeSingle();
    if (!project) return { ok: false, error: "Project not found" };

    const client = (project as { clients?: { name?: string; email?: string; phone?: string; whatsapp?: string } | null }).clients;
    const dateLabel = new Date(report.report_date).toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
    const subject = `Daily site report — ${project.name} (${dateLabel})`;
    const html = `
      <p>Hi ${client?.name ?? "there"},</p>
      <p>Here is today's site report for <b>${project.name}</b>.</p>
      <p><a href="${report.pdf_url}" style="display:inline-block;background:#c17f5a;color:#fff;text-decoration:none;padding:11px 18px;border-radius:8px;font-weight:600">View report PDF</a></p>
      <p style="color:#8a7f74;font-size:12px">— Sent from PMStudio</p>
    `;

    let emailSent = false;
    let emailError: string | null = null;
    if (client?.email) {
      const lovableKey = process.env.LOVABLE_API_KEY;
      const resendKey = process.env.RESEND_API_KEY;
      if (lovableKey && resendKey) {
        const res = await fetch("https://connector-gateway.lovable.dev/resend/emails", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${lovableKey}`,
            "X-Connection-Api-Key": resendKey,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: "PMStudio <hello@pmstudio.com>",
            to: [client.email],
            subject,
            html,
          }),
        });
        const out = await res.json().catch(() => ({}));
        emailSent = res.ok;
        if (!res.ok) emailError = `Resend ${res.status}: ${JSON.stringify(out)}`;
        await supabaseAdmin.from("email_log").insert({
          user_id: report.user_id,
          project_id: report.project_id,
          client_id: project.client_id,
          kind: "daily_report",
          recipient_email: client.email,
          recipient_name: client.name ?? null,
          subject,
          status: res.ok ? "sent" : "failed",
          provider_id: out?.id ?? null,
          error: emailError,
          meta: { reportId: report.id, date: report.report_date },
        });
      } else {
        emailError = "Email service not configured";
      }
    }

    await supabaseAdmin
      .from("site_reports")
      .update({ sent_to_client_at: new Date().toISOString() })
      .eq("id", report.id);

    const waPhone = (client?.whatsapp || client?.phone || "").replace(/[^0-9]/g, "");
    const waText = `Hi ${client?.name ?? "there"}, today's site report for ${project.name} (${dateLabel}): ${report.pdf_url}`;
    const whatsappUrl = waPhone
      ? `https://wa.me/${waPhone}?text=${encodeURIComponent(waText)}`
      : `https://wa.me/?text=${encodeURIComponent(waText)}`;

    return {
      ok: true,
      emailSent,
      emailError,
      whatsappUrl,
      pdf_url: report.pdf_url,
    };
  });
