
CREATE TABLE public.work_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL,
  is_default_hidden boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX work_types_user_name_lower_idx
  ON public.work_types (user_id, lower(name));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.work_types TO authenticated;
GRANT ALL ON public.work_types TO service_role;

ALTER TABLE public.work_types ENABLE ROW LEVEL SECURITY;

CREATE POLICY work_types_select_own ON public.work_types
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY work_types_insert_own ON public.work_types
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY work_types_update_own ON public.work_types
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY work_types_delete_own ON public.work_types
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE TRIGGER work_types_set_updated_at
  BEFORE UPDATE ON public.work_types
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Backfill: insert distinct non-default work types currently used in tasks
INSERT INTO public.work_types (user_id, name)
SELECT DISTINCT t.user_id, trim(t.work_type)
FROM public.tasks t
WHERE t.work_type IS NOT NULL
  AND length(trim(t.work_type)) > 0
  AND lower(trim(t.work_type)) NOT IN (
    'civil','electrical','plumbing','carpentry','painting','flooring',
    'false ceiling','hvac','tiling','polishing','glass','metal','other'
  )
ON CONFLICT DO NOTHING;
