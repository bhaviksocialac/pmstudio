
CREATE TABLE public.project_vendors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  project_id uuid NOT NULL,
  vendor_id uuid NOT NULL,
  scope text,
  po_amount numeric NOT NULL DEFAULT 0,
  expected_delivery date,
  status text NOT NULL DEFAULT 'pending',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (project_id, vendor_id)
);

CREATE INDEX idx_project_vendors_project ON public.project_vendors(project_id);
CREATE INDEX idx_project_vendors_vendor ON public.project_vendors(vendor_id);

ALTER TABLE public.project_vendors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "project_vendors_select_own" ON public.project_vendors
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "project_vendors_insert_own" ON public.project_vendors
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "project_vendors_update_own" ON public.project_vendors
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "project_vendors_delete_own" ON public.project_vendors
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE TRIGGER project_vendors_set_updated_at
  BEFORE UPDATE ON public.project_vendors
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
