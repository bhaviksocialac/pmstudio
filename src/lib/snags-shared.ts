// Shared helpers for snag-aware milestone blocking + open-snag detection.
import type { SupabaseClient } from "@supabase/supabase-js";

// Open statuses (not yet resolved/closed/verified)
export const OPEN_SNAG_STATUSES = ["open", "in_progress", "reopened"] as const;

// Returns count of open snags for a project (server or client supabase ok).
export async function countOpenSnags(supabase: SupabaseClient<any, "public", any>, projectId: string): Promise<number> {
  const { count } = await supabase
    .from("snags")
    .select("id", { count: "exact", head: true })
    .eq("project_id", projectId)
    .in("status", OPEN_SNAG_STATUSES as unknown as string[]);
  return count ?? 0;
}

// A milestone is "blocking" if it concerns Finishing or Handover work.
export function milestoneBlocksOnSnags(m: { name: string; kind: string; trigger: { phase?: string; work_type?: string } }): boolean {
  const blob = `${m.name} ${m.trigger.phase ?? ""} ${m.trigger.work_type ?? ""}`.toLowerCase();
  return /finish|handover|snag/.test(blob);
}

// Keyword-based snag detection in free-text narrative.
const SNAG_RE = /\b(missing|broken|wrong|not done|incomplete|peeling|cracked|crack|uneven|damaged|leaking|leak|chipped|stain|patchy|short|not aligned|not align|poor quality|defect|defective|loose|gap|gaps)\b/i;

export function looksLikeSnag(text: string): boolean {
  return SNAG_RE.test(text);
}
