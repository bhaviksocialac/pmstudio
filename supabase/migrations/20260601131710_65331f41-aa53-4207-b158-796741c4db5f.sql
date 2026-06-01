
-- vendors master extensions
ALTER TABLE public.vendors
  ADD COLUMN IF NOT EXISTS vendor_type TEXT NOT NULL DEFAULT 'company',
  ADD COLUMN IF NOT EXISTS whatsapp TEXT,
  ADD COLUMN IF NOT EXISTS designation TEXT,
  ADD COLUMN IF NOT EXISTS bank_name TEXT,
  ADD COLUMN IF NOT EXISTS work_categories TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS payment_terms TEXT;

-- per-user saved custom categories
CREATE TABLE IF NOT EXISTS public.vendor_custom_categories (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, name)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.vendor_custom_categories TO authenticated;
GRANT ALL ON public.vendor_custom_categories TO service_role;
ALTER TABLE public.vendor_custom_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY vcc_select_own ON public.vendor_custom_categories FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY vcc_insert_own ON public.vendor_custom_categories FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY vcc_delete_own ON public.vendor_custom_categories FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- project_vendors extensions
ALTER TABLE public.project_vendors
  ADD COLUMN IF NOT EXISTS scope_categories TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS contract_type TEXT NOT NULL DEFAULT 'lump_sum',
  ADD COLUMN IF NOT EXISTS quotation_storage_path TEXT,
  ADD COLUMN IF NOT EXISTS quotation_url TEXT,
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- project vendor line items
CREATE TABLE IF NOT EXISTS public.project_vendor_line_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  project_vendor_id UUID NOT NULL,
  category TEXT NOT NULL DEFAULT 'Other',
  description TEXT NOT NULL,
  scope_tag TEXT NOT NULL DEFAULT 'supply_fix',
  rate_type TEXT NOT NULL DEFAULT 'lump_sum',
  quantity NUMERIC,
  unit TEXT,
  rate NUMERIC,
  amount NUMERIC NOT NULL DEFAULT 0,
  invoiced_amount NUMERIC NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending',
  order_index INT NOT NULL DEFAULT 0,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_pvli_pv ON public.project_vendor_line_items(project_vendor_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.project_vendor_line_items TO authenticated;
GRANT ALL ON public.project_vendor_line_items TO service_role;
ALTER TABLE public.project_vendor_line_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY pvli_select_own ON public.project_vendor_line_items FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY pvli_insert_own ON public.project_vendor_line_items FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY pvli_update_own ON public.project_vendor_line_items FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY pvli_delete_own ON public.project_vendor_line_items FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE TRIGGER set_pvli_updated_at BEFORE UPDATE ON public.project_vendor_line_items FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- project vendor milestones
CREATE TABLE IF NOT EXISTS public.project_vendor_milestones (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  project_vendor_id UUID NOT NULL,
  name TEXT NOT NULL,
  trigger TEXT NOT NULL DEFAULT 'custom',
  trigger_note TEXT,
  percentage NUMERIC,
  amount NUMERIC NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending',
  paid_at TIMESTAMPTZ,
  order_index INT NOT NULL DEFAULT 0,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_pvm_pv ON public.project_vendor_milestones(project_vendor_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.project_vendor_milestones TO authenticated;
GRANT ALL ON public.project_vendor_milestones TO service_role;
ALTER TABLE public.project_vendor_milestones ENABLE ROW LEVEL SECURITY;
CREATE POLICY pvm_select_own ON public.project_vendor_milestones FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY pvm_insert_own ON public.project_vendor_milestones FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY pvm_update_own ON public.project_vendor_milestones FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY pvm_delete_own ON public.project_vendor_milestones FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE TRIGGER set_pvm_updated_at BEFORE UPDATE ON public.project_vendor_milestones FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
