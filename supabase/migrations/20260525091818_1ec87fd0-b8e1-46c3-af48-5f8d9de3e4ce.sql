-- 1) Add audit timestamp columns to tasks
ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS assigned_at  timestamptz,
  ADD COLUMN IF NOT EXISTS response_at  timestamptz,
  ADD COLUMN IF NOT EXISTS started_at   timestamptz,
  ADD COLUMN IF NOT EXISTS completed_at timestamptz;

-- 2) Audit-log table
CREATE TABLE IF NOT EXISTS public.task_status_history (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL,
  task_id         uuid NOT NULL,
  project_id      uuid,
  from_status     text,
  to_status       text NOT NULL,
  changed_at      timestamptz NOT NULL DEFAULT now(),
  effective_date  date NOT NULL DEFAULT CURRENT_DATE,
  changed_by_name text,
  note            text,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS task_status_history_task_idx    ON public.task_status_history (task_id, changed_at);
CREATE INDEX IF NOT EXISTS task_status_history_project_idx ON public.task_status_history (project_id, changed_at);

ALTER TABLE public.task_status_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS task_status_history_select_own ON public.task_status_history;
CREATE POLICY task_status_history_select_own ON public.task_status_history
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS task_status_history_insert_own ON public.task_status_history;
CREATE POLICY task_status_history_insert_own ON public.task_status_history
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS task_status_history_update_own ON public.task_status_history;
CREATE POLICY task_status_history_update_own ON public.task_status_history
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS task_status_history_delete_own ON public.task_status_history;
CREATE POLICY task_status_history_delete_own ON public.task_status_history
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- 3) Trigger: on status change, log history + stamp matching column
CREATE OR REPLACE FUNCTION public.tasks_audit_status_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_effective date;
  v_changed_at timestamptz;
  v_note text;
  v_name text;
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status THEN
    -- Allow caller to pass effective date / note via GUC (set_config) before UPDATE.
    BEGIN v_effective := current_setting('app.status_effective_date', true)::date; EXCEPTION WHEN OTHERS THEN v_effective := NULL; END;
    BEGIN v_note      := current_setting('app.status_change_note', true);          EXCEPTION WHEN OTHERS THEN v_note := NULL; END;
    BEGIN v_name      := current_setting('app.status_changed_by_name', true);      EXCEPTION WHEN OTHERS THEN v_name := NULL; END;

    IF v_effective IS NULL THEN v_effective := CURRENT_DATE; END IF;
    v_changed_at := (v_effective::timestamp AT TIME ZONE 'UTC');

    -- Stamp matching timestamp columns (only set if not already set, except WIP/done overwrite)
    IF NEW.status = 'wip' OR NEW.status = 'in_progress' THEN
      NEW.started_at := v_changed_at;
      IF NEW.actual_start IS NULL THEN NEW.actual_start := v_effective; END IF;
    ELSIF NEW.status = 'done' THEN
      NEW.completed_at := v_changed_at;
      IF NEW.actual_end IS NULL THEN NEW.actual_end := v_effective; END IF;
      NEW.done := true;
    ELSIF NEW.status = 'approval_pending' THEN
      IF NEW.ifa_date IS NULL THEN NEW.ifa_date := v_effective; END IF;
    ELSIF NEW.status = 'order_placed' OR NEW.status = 'material_ordered' OR NEW.status = 'material_delivered' THEN
      NEW.response_at := COALESCE(NEW.response_at, v_changed_at);
    END IF;

    INSERT INTO public.task_status_history (
      user_id, task_id, project_id, from_status, to_status,
      changed_at, effective_date, changed_by_name, note
    ) VALUES (
      NEW.user_id, NEW.id, NEW.project_id, OLD.status, NEW.status,
      v_changed_at, v_effective, v_name, NULLIF(v_note, '')
    );
  END IF;

  -- Stamp assigned_at when contractor/vendor/assignee first set
  IF TG_OP = 'UPDATE' AND NEW.assigned_at IS NULL
     AND ( (NEW.contractor IS NOT NULL AND OLD.contractor IS NULL)
        OR (NEW.vendor_id  IS NOT NULL AND OLD.vendor_id  IS NULL)
        OR (NEW.assignee   IS NOT NULL AND OLD.assignee   IS NULL) ) THEN
    NEW.assigned_at := now();
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_tasks_audit_status_change ON public.tasks;
CREATE TRIGGER trg_tasks_audit_status_change
  BEFORE UPDATE ON public.tasks
  FOR EACH ROW EXECUTE FUNCTION public.tasks_audit_status_change();