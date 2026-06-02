-- 1) Vendor documents: add custom_label for "Other" category, migrate legacy values
ALTER TABLE public.vendor_documents
  ADD COLUMN IF NOT EXISTS custom_label text;

UPDATE public.vendor_documents SET category = 'po'      WHERE category = 'work_order';
UPDATE public.vendor_documents SET category = 'challan' WHERE category = 'delivery_challan';
