
-- Vendor documents (project-scoped, per-vendor files with version history)
CREATE TABLE IF NOT EXISTS public.vendor_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  project_id uuid NOT NULL,
  vendor_id uuid NOT NULL,
  project_vendor_id uuid,
  name text NOT NULL,
  category text NOT NULL DEFAULT 'quotation',
  notes text,
  storage_path text NOT NULL,
  file_url text NOT NULL,
  mime_type text,
  file_size bigint,
  current_version_no integer NOT NULL DEFAULT 1,
  linked_document_id uuid,
  deleted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_vendor_documents_project_vendor ON public.vendor_documents (project_id, vendor_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_vendor_documents_project_vendor_id ON public.vendor_documents (project_vendor_id) WHERE deleted_at IS NULL;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.vendor_documents TO authenticated;
GRANT ALL ON public.vendor_documents TO service_role;

ALTER TABLE public.vendor_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY vendor_documents_select_own ON public.vendor_documents
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY vendor_documents_insert_own ON public.vendor_documents
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY vendor_documents_update_own ON public.vendor_documents
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY vendor_documents_delete_own ON public.vendor_documents
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE TRIGGER vendor_documents_set_updated_at
  BEFORE UPDATE ON public.vendor_documents
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Version history for vendor documents
CREATE TABLE IF NOT EXISTS public.vendor_document_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  vendor_document_id uuid NOT NULL REFERENCES public.vendor_documents(id) ON DELETE CASCADE,
  version_no integer NOT NULL,
  storage_path text NOT NULL,
  file_url text NOT NULL,
  mime_type text,
  file_size bigint,
  uploaded_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_vendor_document_versions_doc ON public.vendor_document_versions (vendor_document_id, version_no DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.vendor_document_versions TO authenticated;
GRANT ALL ON public.vendor_document_versions TO service_role;

ALTER TABLE public.vendor_document_versions ENABLE ROW LEVEL SECURITY;

CREATE POLICY vendor_document_versions_select_own ON public.vendor_document_versions
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY vendor_document_versions_insert_own ON public.vendor_document_versions
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY vendor_document_versions_update_own ON public.vendor_document_versions
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY vendor_document_versions_delete_own ON public.vendor_document_versions
  FOR DELETE TO authenticated USING (auth.uid() = user_id);
