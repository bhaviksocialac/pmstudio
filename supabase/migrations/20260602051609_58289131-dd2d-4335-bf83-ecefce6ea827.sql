-- Shared trigger function: stamp user_id := auth.uid() on insert if NULL
CREATE OR REPLACE FUNCTION public.set_user_id_on_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.user_id IS NULL THEN
    NEW.user_id := auth.uid();
  END IF;
  RETURN NEW;
END;
$$;

DO $$
DECLARE
  t text;
  tables text[] := ARRAY[
    'vendors','project_vendors','project_vendor_line_items','project_vendor_milestones',
    'vendor_invoices','vendor_invoice_payments',
    'tasks','milestones','snags','site_attendance','invoices',
    'project_documents','project_phases','project_rooms','room_scope_items',
    'budget_lines','clients','client_contacts',
    'phase_subcategories','phase_subcategory_vendors',
    'project_alerts','document_folders','photos','meetings',
    'change_orders','approvals','ai_drafts','payment_requests','project_contractors'
  ];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    -- Only attach if table exists and has a user_id column
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema='public' AND table_name=t AND column_name='user_id'
    ) THEN
      EXECUTE format('DROP TRIGGER IF EXISTS set_user_id_on_insert_trg ON public.%I', t);
      EXECUTE format(
        'CREATE TRIGGER set_user_id_on_insert_trg BEFORE INSERT ON public.%I FOR EACH ROW EXECUTE FUNCTION public.set_user_id_on_insert()',
        t
      );
    END IF;
  END LOOP;
END $$;