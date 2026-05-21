
CREATE TABLE public.phase_subcategory_vendors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  subcategory_id uuid NOT NULL,
  vendor_id uuid NOT NULL,
  scope text,
  amount numeric NOT NULL DEFAULT 0,
  order_index integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_psv_sub ON public.phase_subcategory_vendors(subcategory_id);
CREATE INDEX idx_psv_user ON public.phase_subcategory_vendors(user_id);

ALTER TABLE public.phase_subcategory_vendors ENABLE ROW LEVEL SECURITY;

CREATE POLICY psv_select_own ON public.phase_subcategory_vendors FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY psv_insert_own ON public.phase_subcategory_vendors FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY psv_update_own ON public.phase_subcategory_vendors FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY psv_delete_own ON public.phase_subcategory_vendors FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE TRIGGER psv_updated_at BEFORE UPDATE ON public.phase_subcategory_vendors
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
