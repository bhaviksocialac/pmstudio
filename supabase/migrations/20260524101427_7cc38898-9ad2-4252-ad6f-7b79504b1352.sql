CREATE TABLE public.project_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  project_id uuid NOT NULL,
  name text NOT NULL,
  category text NOT NULL DEFAULT 'Other',
  file_url text NOT NULL,
  storage_path text NOT NULL,
  mime_type text,
  file_size bigint,
  uploaded_by_name text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.project_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "project_documents_select_own" ON public.project_documents
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "project_documents_insert_own" ON public.project_documents
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "project_documents_update_own" ON public.project_documents
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "project_documents_delete_own" ON public.project_documents
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE INDEX project_documents_project_idx ON public.project_documents(project_id);

CREATE TRIGGER project_documents_set_updated_at
  BEFORE UPDATE ON public.project_documents
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

INSERT INTO storage.buckets (id, name, public)
VALUES ('project-documents', 'project-documents', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "project_documents_bucket_read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'project-documents');

CREATE POLICY "project_documents_bucket_insert"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'project-documents');

CREATE POLICY "project_documents_bucket_update"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'project-documents');

CREATE POLICY "project_documents_bucket_delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'project-documents');