-- Extend clients table
ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS client_type text NOT NULL DEFAULT 'individual',
  ADD COLUMN IF NOT EXISTS contact_person text,
  ADD COLUMN IF NOT EXISTS designation text,
  ADD COLUMN IF NOT EXISTS pan text,
  ADD COLUMN IF NOT EXISTS gst text,
  ADD COLUMN IF NOT EXISTS rera text,
  ADD COLUMN IF NOT EXISTS language_pref text NOT NULL DEFAULT 'English',
  ADD COLUMN IF NOT EXISTS communication_pref text NOT NULL DEFAULT 'Both',
  ADD COLUMN IF NOT EXISTS relationship text,
  ADD COLUMN IF NOT EXISTS referred_by text,
  ADD COLUMN IF NOT EXISTS currency_code text NOT NULL DEFAULT 'INR',
  ADD COLUMN IF NOT EXISTS phone_country_code text NOT NULL DEFAULT '+91',
  ADD COLUMN IF NOT EXISTS site_flat_number text,
  ADD COLUMN IF NOT EXISTS site_street text,
  ADD COLUMN IF NOT EXISTS site_city text,
  ADD COLUMN IF NOT EXISTS site_state text,
  ADD COLUMN IF NOT EXISTS site_country text,
  ADD COLUMN IF NOT EXISTS site_pincode text,
  ADD COLUMN IF NOT EXISTS site_same_as_registered boolean NOT NULL DEFAULT true;

-- New client contacts table
CREATE TABLE IF NOT EXISTS public.client_contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  name text NOT NULL,
  designation text,
  phone text,
  email text,
  whatsapp text,
  tag text NOT NULL DEFAULT 'Other',
  order_index integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.client_contacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "client_contacts_select_own" ON public.client_contacts
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "client_contacts_insert_own" ON public.client_contacts
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "client_contacts_update_own" ON public.client_contacts
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "client_contacts_delete_own" ON public.client_contacts
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_client_contacts_client_id ON public.client_contacts(client_id);

CREATE TRIGGER set_client_contacts_updated_at
  BEFORE UPDATE ON public.client_contacts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();