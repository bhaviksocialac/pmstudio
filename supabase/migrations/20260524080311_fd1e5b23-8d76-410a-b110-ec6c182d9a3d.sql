
CREATE TABLE public.vendor_invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  project_id uuid NOT NULL,
  vendor_id uuid NOT NULL,
  invoice_number text,
  invoice_date date,
  due_date date,
  subtotal numeric NOT NULL DEFAULT 0,
  gst_percent numeric NOT NULL DEFAULT 0,
  gst_amount numeric NOT NULL DEFAULT 0,
  total_amount numeric NOT NULL DEFAULT 0,
  amount_paid numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'unpaid',
  company_name_snapshot text,
  gst_snapshot text,
  bank_account_snapshot text,
  ifsc_snapshot text,
  bank_name_snapshot text,
  notes text,
  terms text,
  pdf_url text,
  pdf_storage_path text,
  original_filename text,
  mime_type text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.vendor_invoices ENABLE ROW LEVEL SECURITY;
CREATE POLICY vi_select_own ON public.vendor_invoices FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY vi_insert_own ON public.vendor_invoices FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY vi_update_own ON public.vendor_invoices FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY vi_delete_own ON public.vendor_invoices FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE INDEX idx_vi_project ON public.vendor_invoices(project_id);
CREATE INDEX idx_vi_vendor ON public.vendor_invoices(vendor_id);
CREATE TRIGGER vi_set_updated_at BEFORE UPDATE ON public.vendor_invoices FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.vendor_invoice_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  invoice_id uuid NOT NULL REFERENCES public.vendor_invoices(id) ON DELETE CASCADE,
  order_index integer NOT NULL DEFAULT 0,
  description text NOT NULL DEFAULT '',
  quantity numeric NOT NULL DEFAULT 0,
  unit text,
  rate numeric NOT NULL DEFAULT 0,
  amount numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.vendor_invoice_lines ENABLE ROW LEVEL SECURITY;
CREATE POLICY vil_select_own ON public.vendor_invoice_lines FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY vil_insert_own ON public.vendor_invoice_lines FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY vil_update_own ON public.vendor_invoice_lines FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY vil_delete_own ON public.vendor_invoice_lines FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE INDEX idx_vil_invoice ON public.vendor_invoice_lines(invoice_id);

CREATE TABLE public.vendor_invoice_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  invoice_id uuid NOT NULL REFERENCES public.vendor_invoices(id) ON DELETE CASCADE,
  amount numeric NOT NULL DEFAULT 0,
  paid_on date NOT NULL DEFAULT CURRENT_DATE,
  method text NOT NULL DEFAULT 'bank_transfer',
  reference text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.vendor_invoice_payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY vip_select_own ON public.vendor_invoice_payments FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY vip_insert_own ON public.vendor_invoice_payments FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY vip_update_own ON public.vendor_invoice_payments FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY vip_delete_own ON public.vendor_invoice_payments FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE INDEX idx_vip_invoice ON public.vendor_invoice_payments(invoice_id);

CREATE OR REPLACE FUNCTION public.recalc_vendor_invoice_paid()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
DECLARE
  v_invoice_id uuid;
  v_total numeric;
  v_paid numeric;
BEGIN
  v_invoice_id := COALESCE(NEW.invoice_id, OLD.invoice_id);
  SELECT total_amount INTO v_total FROM public.vendor_invoices WHERE id = v_invoice_id;
  SELECT COALESCE(SUM(amount), 0) INTO v_paid FROM public.vendor_invoice_payments WHERE invoice_id = v_invoice_id;
  UPDATE public.vendor_invoices
  SET amount_paid = v_paid,
      status = CASE
        WHEN v_paid <= 0 THEN 'unpaid'
        WHEN v_paid >= COALESCE(v_total, 0) AND COALESCE(v_total, 0) > 0 THEN 'paid'
        ELSE 'partial'
      END,
      updated_at = now()
  WHERE id = v_invoice_id;
  RETURN NULL;
END;
$$;

CREATE TRIGGER vip_recalc_after_change
AFTER INSERT OR UPDATE OR DELETE ON public.vendor_invoice_payments
FOR EACH ROW EXECUTE FUNCTION public.recalc_vendor_invoice_paid();
