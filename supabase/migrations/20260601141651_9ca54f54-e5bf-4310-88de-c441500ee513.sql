
-- Extension for fuzzy matching
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Tasks: budget + provenance columns
ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS boq_amount numeric,
  ADD COLUMN IF NOT EXISTS quoted_amount numeric,
  ADD COLUMN IF NOT EXISTS invoiced_amount numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS auto_assigned boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS manual_overrides jsonb NOT NULL DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS idx_tasks_title_trgm
  ON public.tasks USING gin (title gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_tasks_project_work_type
  ON public.tasks (project_id, work_type);

-- Projects: rollup columns
ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS boq_total numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS quoted_total numeric NOT NULL DEFAULT 0;

-- Alerts table
CREATE TABLE IF NOT EXISTS public.project_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  project_id uuid NOT NULL,
  kind text NOT NULL,
  severity text NOT NULL DEFAULT 'info',
  title text NOT NULL,
  body text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  dismissed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.project_alerts TO authenticated;
GRANT ALL ON public.project_alerts TO service_role;

ALTER TABLE public.project_alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "project_alerts_select_own" ON public.project_alerts
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "project_alerts_insert_own" ON public.project_alerts
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "project_alerts_update_own" ON public.project_alerts
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "project_alerts_delete_own" ON public.project_alerts
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_project_alerts_project
  ON public.project_alerts (project_id, dismissed_at, created_at DESC);

CREATE TRIGGER project_alerts_set_updated_at
  BEFORE UPDATE ON public.project_alerts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Rollup trigger: keep projects.boq_total / quoted_total / spent in sync
CREATE OR REPLACE FUNCTION public.recompute_project_budget_rollups()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_project_id uuid;
BEGIN
  v_project_id := COALESCE(NEW.project_id, OLD.project_id);
  IF v_project_id IS NULL THEN
    RETURN NULL;
  END IF;

  UPDATE public.projects p
  SET
    boq_total    = COALESCE((SELECT SUM(boq_amount)      FROM public.tasks WHERE project_id = v_project_id AND deleted_at IS NULL), 0),
    quoted_total = COALESCE((SELECT SUM(quoted_amount)   FROM public.tasks WHERE project_id = v_project_id AND deleted_at IS NULL), 0),
    spent        = COALESCE((SELECT SUM(invoiced_amount) FROM public.tasks WHERE project_id = v_project_id AND deleted_at IS NULL), 0),
    updated_at   = now()
  WHERE p.id = v_project_id;

  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS tasks_recompute_budget_rollups ON public.tasks;
CREATE TRIGGER tasks_recompute_budget_rollups
  AFTER INSERT OR UPDATE OF boq_amount, quoted_amount, invoiced_amount, deleted_at, project_id
       OR DELETE
  ON public.tasks
  FOR EACH ROW EXECUTE FUNCTION public.recompute_project_budget_rollups();

-- Budget rollup view (per project + work_type)
CREATE OR REPLACE VIEW public.v_project_budget_rollup AS
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
