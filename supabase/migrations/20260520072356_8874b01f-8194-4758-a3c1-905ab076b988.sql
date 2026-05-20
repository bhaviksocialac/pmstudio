
-- Site reports
CREATE TABLE public.site_reports (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  project_id UUID NOT NULL,
  report_date DATE NOT NULL DEFAULT CURRENT_DATE,
  location TEXT,
  work_done TEXT,
  workers_present INTEGER DEFAULT 0,
  issues TEXT,
  photo_urls JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.site_reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY site_reports_select_own ON public.site_reports FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY site_reports_insert_own ON public.site_reports FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY site_reports_update_own ON public.site_reports FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY site_reports_delete_own ON public.site_reports FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE INDEX idx_site_reports_project ON public.site_reports(project_id, report_date DESC);
CREATE TRIGGER set_site_reports_updated BEFORE UPDATE ON public.site_reports FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Snags
CREATE TYPE public.snag_status AS ENUM ('open', 'in_progress', 'resolved');
CREATE TABLE public.snags (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  project_id UUID NOT NULL,
  description TEXT NOT NULL,
  photo_url TEXT,
  contractor_name TEXT,
  deadline DATE,
  status public.snag_status NOT NULL DEFAULT 'open',
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.snags ENABLE ROW LEVEL SECURITY;
CREATE POLICY snags_select_own ON public.snags FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY snags_insert_own ON public.snags FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY snags_update_own ON public.snags FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY snags_delete_own ON public.snags FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE INDEX idx_snags_project ON public.snags(project_id, status);
CREATE TRIGGER set_snags_updated BEFORE UPDATE ON public.snags FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Change orders
CREATE TYPE public.change_order_status AS ENUM ('draft', 'pending_client', 'approved', 'rejected', 'active');
CREATE TABLE public.change_orders (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  project_id UUID NOT NULL,
  description TEXT NOT NULL,
  reason TEXT,
  additional_cost NUMERIC NOT NULL DEFAULT 0,
  status public.change_order_status NOT NULL DEFAULT 'draft',
  requested_at TIMESTAMPTZ,
  decided_at TIMESTAMPTZ,
  client_note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.change_orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY change_orders_select_own ON public.change_orders FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY change_orders_insert_own ON public.change_orders FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY change_orders_update_own ON public.change_orders FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY change_orders_delete_own ON public.change_orders FOR DELETE TO authenticated USING (auth.uid() = user_id);
-- Public read by project_id for client portal (anonymous access ok since portal is via shareable link)
CREATE POLICY change_orders_select_portal ON public.change_orders FOR SELECT TO anon USING (true);
CREATE POLICY change_orders_update_portal_decision ON public.change_orders FOR UPDATE TO anon USING (status = 'pending_client') WITH CHECK (status IN ('approved', 'rejected'));
CREATE INDEX idx_change_orders_project ON public.change_orders(project_id, status);
CREATE TRIGGER set_change_orders_updated BEFORE UPDATE ON public.change_orders FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Phase subcategory checklists + sign-off
ALTER TABLE public.phase_subcategories
  ADD COLUMN IF NOT EXISTS checklist JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS signed_off_at TIMESTAMPTZ;
