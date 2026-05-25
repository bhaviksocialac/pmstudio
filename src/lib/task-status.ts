import { supabase } from "@/integrations/supabase/client";

export type ChangeStatusInput = {
  taskId: string;
  newStatus: string;
  effectiveDate: string; // YYYY-MM-DD
  note?: string;
  changedByName?: string;
};

/**
 * Call the SECURITY DEFINER `change_task_status` SQL function. The DB trigger
 * writes a row into `task_status_history` and stamps the matching timestamp
 * column on `tasks` (started_at, completed_at, response_at, ifa_date).
 */
export async function changeTaskStatus(input: ChangeStatusInput): Promise<void> {
  // `rpc` is typed against generated types; cast to any for the new function
  // until types regenerate.
  const { error } = await (supabase.rpc as unknown as (fn: string, args: Record<string, unknown>) => Promise<{ error: { message: string } | null }>)(
    "change_task_status",
    {
      p_task_id: input.taskId,
      p_status: input.newStatus,
      p_effective_date: input.effectiveDate,
      p_note: input.note ?? null,
      p_changed_by_name: input.changedByName ?? null,
    },
  );
  if (error) throw new Error(error.message);
}
