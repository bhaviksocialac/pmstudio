CREATE OR REPLACE FUNCTION public.sync_task_work_types_to_master()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  raw_name text;
  normalized_name text;
  default_names constant text[] := ARRAY[
    'survey','design','procurement','flooring','tiling','civil','electrical','painting',
    'false ceiling','carpentry','plumbing','hvac','finishing','snags','handover','other'
  ];
BEGIN
  IF NEW.user_id IS NULL THEN
    RETURN NEW;
  END IF;

  FOR raw_name IN
    SELECT NEW.work_type
    UNION ALL
    SELECT jsonb_array_elements_text(
      CASE
        WHEN jsonb_typeof(NEW.work_types) = 'array' THEN NEW.work_types
        ELSE '[]'::jsonb
      END
    )
  LOOP
    normalized_name := trim(raw_name);
    IF normalized_name IS NOT NULL
      AND length(normalized_name) > 0
      AND lower(normalized_name) <> ALL(default_names)
    THEN
      INSERT INTO public.work_types (user_id, name, is_default_hidden)
      VALUES (NEW.user_id, normalized_name, false)
      ON CONFLICT DO NOTHING;
    END IF;
  END LOOP;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tasks_sync_work_types_to_master ON public.tasks;
CREATE TRIGGER tasks_sync_work_types_to_master
AFTER INSERT OR UPDATE OF work_type, work_types, user_id ON public.tasks
FOR EACH ROW
EXECUTE FUNCTION public.sync_task_work_types_to_master();

INSERT INTO public.work_types (user_id, name, is_default_hidden)
SELECT DISTINCT t.user_id, trim(w.name), false
FROM public.tasks t
CROSS JOIN LATERAL (
  SELECT t.work_type AS name
  UNION ALL
  SELECT jsonb_array_elements_text(
    CASE
      WHEN jsonb_typeof(t.work_types) = 'array' THEN t.work_types
      ELSE '[]'::jsonb
    END
  )
) AS w
WHERE t.user_id IS NOT NULL
  AND w.name IS NOT NULL
  AND length(trim(w.name)) > 0
  AND lower(trim(w.name)) NOT IN (
    'survey','design','procurement','flooring','tiling','civil','electrical','painting',
    'false ceiling','carpentry','plumbing','hvac','finishing','snags','handover','other'
  )
ON CONFLICT DO NOTHING;