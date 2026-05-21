import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const GATEWAY_URL = "https://connector-gateway.lovable.dev/resend";
const FROM = "PMStudio <hello@pmstudio.com>";

type SendArgs = {
  to: string;
  subject: string;
  html: string;
  text?: string;
  tags?: { name: string; value: string }[];
};

async function resendSend(args: SendArgs): Promise<{ id?: string; error?: string }> {
  const lovableKey = process.env.LOVABLE_API_KEY;
  const resendKey = process.env.RESEND_API_KEY;
  if (!lovableKey) return { error: "LOVABLE_API_KEY not configured" };
  if (!resendKey) return { error: "RESEND_API_KEY not configured" };

  const res = await fetch(`${GATEWAY_URL}/emails`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${lovableKey}`,
      "X-Connection-Api-Key": resendKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: FROM,
      to: [args.to],
      subject: args.subject,
      html: args.html,
      text: args.text,
      tags: args.tags,
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) return { error: `Resend ${res.status}: ${JSON.stringify(data)}` };
  return { id: data.id };
}

/* ---------- Templates ---------- */

const wrap = (title: string, body: string) => `<!doctype html>
<html><body style="margin:0;padding:0;background:#f7f4ef;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#2b2622">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f7f4ef;padding:32px 0">
<tr><td align="center">
<table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:14px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.06)">
<tr><td style="padding:28px 32px 12px 32px;border-bottom:1px solid #efe9e1">
<div style="font-family:Georgia,serif;font-size:22px;letter-spacing:-.01em;color:#3d3530">PMStudio</div>
</td></tr>
<tr><td style="padding:28px 32px">
<h1 style="margin:0 0 16px 0;font-family:Georgia,serif;font-size:24px;line-height:1.25;color:#2b2622">${title}</h1>
${body}
</td></tr>
<tr><td style="padding:18px 32px 28px 32px;border-top:1px solid #efe9e1;color:#8a7f74;font-size:12px">
Sent by PMStudio · hello@pmstudio.com
</td></tr>
</table>
</td></tr></table></body></html>`;

const btn = (href: string, label: string) =>
  `<a href="${href}" style="display:inline-block;background:#c17f5a;color:#fff;text-decoration:none;padding:11px 18px;border-radius:8px;font-weight:600;font-size:14px">${label}</a>`;

const p = (s: string) => `<p style="margin:0 0 14px 0;font-size:15px;line-height:1.55;color:#3d3530">${s}</p>`;

function welcomeTemplate(opts: { clientName: string; projectName: string; portalUrl: string }) {
  return {
    subject: `Welcome — your ${opts.projectName} project is live`,
    html: wrap(
      `Welcome to PMStudio, ${opts.clientName}`,
      [
        p(`We've set up <b>${opts.projectName}</b> on your private portal.`),
        p(`You can track progress, approve designs, view photos and message us anytime.`),
        `<p style="margin:22px 0">${btn(opts.portalUrl, "Open your portal")}</p>`,
        p(`Looking forward to building this with you.<br/>— Bhavik`),
      ].join(""),
    ),
  };
}

function invoiceTemplate(opts: {
  clientName: string;
  projectName: string;
  milestone: string;
  amount: number;
  payUrl: string;
}) {
  const amountStr = `₹${(opts.amount / 100000).toFixed(2)}L`;
  return {
    subject: `Invoice — ${opts.milestone} (${opts.projectName})`,
    html: wrap(
      `Invoice for ${opts.milestone}`,
      [
        p(`Hi ${opts.clientName},`),
        p(`Here's the invoice for the recent milestone on <b>${opts.projectName}</b>.`),
        `<table cellpadding="0" cellspacing="0" style="margin:18px 0;width:100%;border:1px solid #efe9e1;border-radius:10px">
          <tr><td style="padding:14px 18px;border-bottom:1px solid #efe9e1"><b>Milestone</b></td><td style="padding:14px 18px;border-bottom:1px solid #efe9e1;text-align:right">${opts.milestone}</td></tr>
          <tr><td style="padding:14px 18px"><b>Amount due</b></td><td style="padding:14px 18px;text-align:right;font-size:18px;color:#c17f5a"><b>${amountStr}</b></td></tr>
        </table>`,
        `<p style="margin:22px 0">${btn(opts.payUrl, "View & pay invoice")}</p>`,
        p(`Thanks,<br/>— Bhavik`),
      ].join(""),
    ),
  };
}

function milestoneTemplate(opts: {
  clientName: string;
  projectName: string;
  milestone: string;
  portalUrl: string;
  completion: number;
}) {
  return {
    subject: `🎉 ${opts.milestone} — ${opts.projectName}`,
    html: wrap(
      `${opts.milestone} complete`,
      [
        p(`Hi ${opts.clientName},`),
        p(`Great news — we've just wrapped <b>${opts.milestone}</b> on <b>${opts.projectName}</b>. Your project is now <b>${opts.completion}% complete</b>.`),
        `<p style="margin:22px 0">${btn(opts.portalUrl, "See the latest photos")}</p>`,
        p(`Onward to the next phase.<br/>— Bhavik`),
      ].join(""),
    ),
  };
}

function weeklySummaryTemplate(opts: {
  clientName: string;
  projectName: string;
  completion: number;
  phase: string;
  portalUrl: string;
}) {
  return {
    subject: `Weekly update — ${opts.projectName}`,
    html: wrap(
      `This week on ${opts.projectName}`,
      [
        p(`Hi ${opts.clientName},`),
        p(`Quick weekly recap — currently <b>${opts.completion}%</b> complete, in the <b>${opts.phase}</b> phase.`),
        `<p style="margin:22px 0">${btn(opts.portalUrl, "View full progress")}</p>`,
        p(`Have a great Sunday.<br/>— Bhavik`),
      ].join(""),
    ),
  };
}

/* ---------- Internal sender (admin) ---------- */

async function logAndSend(opts: {
  userId: string;
  projectId: string | null;
  clientId: string | null;
  kind: "welcome" | "invoice" | "milestone" | "weekly_summary";
  to: string;
  recipientName: string | null;
  subject: string;
  html: string;
  meta?: Record<string, unknown>;
}) {
  const { data: row, error: insErr } = await supabaseAdmin
    .from("email_log")
    .insert({
      user_id: opts.userId,
      project_id: opts.projectId,
      client_id: opts.clientId,
      kind: opts.kind,
      recipient_email: opts.to,
      recipient_name: opts.recipientName,
      subject: opts.subject,
      status: "queued",
      meta: opts.meta ?? {},
    })
    .select("id")
    .single();
  if (insErr || !row) throw new Error(insErr?.message ?? "Failed to log email");

  const result = await resendSend({
    to: opts.to,
    subject: opts.subject,
    html: opts.html,
    tags: [
      { name: "kind", value: opts.kind },
      { name: "log_id", value: row.id },
    ],
  });

  if (result.error) {
    await supabaseAdmin
      .from("email_log")
      .update({ status: "failed", error: result.error })
      .eq("id", row.id);
    return { ok: false, error: result.error, logId: row.id };
  }
  await supabaseAdmin
    .from("email_log")
    .update({ status: "sent", provider_id: result.id ?? null })
    .eq("id", row.id);
  return { ok: true, logId: row.id, providerId: result.id };
}

/* ---------- Server functions ---------- */

const baseInput = z.object({ projectId: z.string().uuid() });

async function loadContext(projectId: string) {
  const { data: project, error } = await supabaseAdmin
    .from("projects")
    .select("id, user_id, name, completion, phase, client_id, clients(name, email)")
    .eq("id", projectId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!project) throw new Error("Project not found");
  const client = (project as any).clients as { name?: string; email?: string } | null;
  if (!client?.email) return { project, client, skip: "no_client_email" as const };
  const portalUrl = `https://id-preview--ff13a51f-390e-4223-a80c-46ac10e1b243.lovable.app/portal/${project.id}`;
  return { project, client, portalUrl, skip: null };
}

export const sendWelcomeEmail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => baseInput.parse(i))
  .handler(async ({ data }) => {
    const ctx = await loadContext(data.projectId);
    if (ctx.skip) return { skipped: ctx.skip };
    const t = welcomeTemplate({
      clientName: ctx.client!.name ?? "there",
      projectName: ctx.project.name,
      portalUrl: ctx.portalUrl!,
    });
    return logAndSend({
      userId: ctx.project.user_id,
      projectId: ctx.project.id,
      clientId: ctx.project.client_id,
      kind: "welcome",
      to: ctx.client!.email!,
      recipientName: ctx.client!.name ?? null,
      subject: t.subject,
      html: t.html,
    });
  });

export const sendInvoiceEmail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z.object({
      projectId: z.string().uuid(),
      milestone: z.string().min(1).max(200),
      amount: z.number().min(0),
    }).parse(i),
  )
  .handler(async ({ data }) => {
    const ctx = await loadContext(data.projectId);
    if (ctx.skip) return { skipped: ctx.skip };
    const t = invoiceTemplate({
      clientName: ctx.client!.name ?? "there",
      projectName: ctx.project.name,
      milestone: data.milestone,
      amount: data.amount,
      payUrl: `${ctx.portalUrl}#invoices`,
    });
    return logAndSend({
      userId: ctx.project.user_id,
      projectId: ctx.project.id,
      clientId: ctx.project.client_id,
      kind: "invoice",
      to: ctx.client!.email!,
      recipientName: ctx.client!.name ?? null,
      subject: t.subject,
      html: t.html,
      meta: { milestone: data.milestone, amount: data.amount },
    });
  });

export const sendMilestoneEmail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z.object({
      projectId: z.string().uuid(),
      milestone: z.string().min(1).max(200),
    }).parse(i),
  )
  .handler(async ({ data }) => {
    const ctx = await loadContext(data.projectId);
    if (ctx.skip) return { skipped: ctx.skip };
    const t = milestoneTemplate({
      clientName: ctx.client!.name ?? "there",
      projectName: ctx.project.name,
      milestone: data.milestone,
      portalUrl: ctx.portalUrl!,
      completion: ctx.project.completion ?? 0,
    });
    return logAndSend({
      userId: ctx.project.user_id,
      projectId: ctx.project.id,
      clientId: ctx.project.client_id,
      kind: "milestone",
      to: ctx.client!.email!,
      recipientName: ctx.client!.name ?? null,
      subject: t.subject,
      html: t.html,
      meta: { milestone: data.milestone },
    });
  });

/** Called from cron — uses admin context, no auth middleware. */
export async function sendWeeklySummaryAdmin(projectId: string) {
  const ctx = await loadContext(projectId);
  if (ctx.skip) return { skipped: ctx.skip };
  const t = weeklySummaryTemplate({
    clientName: ctx.client!.name ?? "there",
    projectName: ctx.project.name,
    completion: ctx.project.completion ?? 0,
    phase: ctx.project.phase ?? "in progress",
    portalUrl: ctx.portalUrl!,
  });
  return logAndSend({
    userId: ctx.project.user_id,
    projectId: ctx.project.id,
    clientId: ctx.project.client_id,
    kind: "weekly_summary",
    to: ctx.client!.email!,
    recipientName: ctx.client!.name ?? null,
    subject: t.subject,
    html: t.html,
  });
}
