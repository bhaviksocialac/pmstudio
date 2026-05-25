CREATE OR REPLACE FUNCTION public.change_task_status(
  p_task_id uuid,
  p_status text,
  p_effective_date date DEFAULT CURRENT_DATE,
  p_note text DEFAULT NULL,
  p_changed_by_name text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_owner uuid;
BEGIN
  SELECT user_id INTO v_owner FROM public.tasks WHERE id = p_task_id;
  IF v_owner IS NULL THEN RAISE EXCEPTION 'Task not found'; END IF;
  IF v_owner <> auth.uid() THEN RAISE EXCEPTION 'Forbidden'; END IF;

  PERFORM set_config('app.status_effective_date', p_effective_date::text, true);
  PERFORM set_config('app.status_change_note',     COALESCE(p_note, ''),   true);
  PERFORM set_config('app.status_changed_by_name', COALESCE(p_changed_by_name, ''), true);

  UPDATE public.tasks
     SET status = p_status,
         updated_at = now()
   WHERE id = p_task_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.change_task_status(uuid, text, date, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.change_task_status(uuid, text, date, text, text) TO authenticated;