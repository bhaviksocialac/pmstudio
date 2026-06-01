
-- Recreate view with security_invoker so RLS on tasks applies to the caller
DROP VIEW IF EXISTS public.v_project_budget_rollup;
CREATE VIEW public.v_project_budget_rollup
WITH (security_invoker = true) AS
SELECT
  t.project_id,
  COALESCE(NULLIF(t.work_type, ''), 'Other') AS work_type,
  COALESCE(SUM(t.boq_amount),      0) AS boq_amount,
  COALESCE(SUM(t.quoted_amount),   0) AS quoted_amount,
  COALESCE(SUM(t.invoiced_amount), 0) AS invoiced_amount,
  COUNT(*) FILTER (WHERE t.vendor_id IS NULL) AS tasks_without_vendor,
  COUNT(*) AS task_count
FROM public.tasks t
WHERE t.deleted_at IS NULL
GROUP BY t.project_id, COALESCE(NULLIF(t.work_type, ''), 'Other');

GRANT SELECT ON public.v_project_budget_rollup TO authenticated;

-- Revoke direct execution of the trigger function from user roles
REVOKE EXECUTE ON FUNCTION public.recompute_project_budget_rollups() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.recompute_project_budget_rollups() TO service_role;
