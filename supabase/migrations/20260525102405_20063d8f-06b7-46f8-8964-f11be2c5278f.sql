
ALTER TABLE public.project_documents
  ADD COLUMN IF NOT EXISTS folder_path text NOT NULL DEFAULT '';

-- Backfill folder_path from category for existing rows
UPDATE public.project_documents SET folder_path = CASE
  WHEN category = 'Contracts'    THEN 'Contracts'
  WHEN category = 'Floor Plans'  THEN 'Floor Plans'
  WHEN category = 'Invoices'     THEN 'Invoices'
  WHEN category = 'Drawings'     THEN 'Drawings'
  WHEN category = 'Site Reports' THEN 'Site Reports'
  WHEN category = 'Warranties'   THEN 'Warranties'
  WHEN category = 'BOQ'          THEN 'BOQ'
  ELSE 'Other'
END
WHERE folder_path = '' OR folder_path IS NULL;

CREATE INDEX IF NOT EXISTS idx_project_documents_folder
  ON public.project_documents(project_id, folder_path);

CREATE TABLE IF NOT EXISTS public.document_folders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  project_id uuid NOT NULL,
  path text NOT NULL,
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (project_id, path)
);

ALTER TABLE public.document_folders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "document_folders_select_own" ON public.document_folders
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "document_folders_insert_own" ON public.document_folders
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "document_folders_update_own" ON public.document_folders
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "document_folders_delete_own" ON public.document_folders
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE TRIGGER document_folders_updated_at
  BEFORE UPDATE ON public.document_folders
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
