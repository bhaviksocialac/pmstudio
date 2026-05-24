import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { generateAndStoreReport } from "@/lib/daily-reports.server";

export const Route = createFileRoute("/api/public/hooks/daily-reports-cron")({
  server: {
    handlers: {
      POST: async () => {
        const dateISO = new Date().toISOString().slice(0, 10);
        const { data: projects } = await supabaseAdmin
          .from("projects")
          .select("id")
          .neq("phase", "Handover");
        const results: { id: string; ok: boolean; skipped?: string; error?: string }[] = [];
        for (const p of projects ?? []) {
          try {
            const r = await generateAndStoreReport(p.id, dateISO);
            results.push({
              id: p.id,
              ok: r.ok,
              skipped: "skipped" in r ? r.skipped : undefined,
              error: "error" in r ? r.error : undefined,
            });
          } catch (e) {
            results.push({ id: p.id, ok: false, error: e instanceof Error ? e.message : String(e) });
          }
        }
        return new Response(
          JSON.stringify({ ok: true, date: dateISO, count: results.length, results }),
          { headers: { "Content-Type": "application/json" } },
        );
      },
    },
  },
});
