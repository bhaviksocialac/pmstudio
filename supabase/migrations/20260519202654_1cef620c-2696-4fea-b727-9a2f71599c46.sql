
-- 1. Phase subcategories
CREATE TABLE public.phase_subcategories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  project_id uuid not null,
  phase text not null,
  name text not null,
  vendor_id uuid,
  contractor_name text,
  start_date date,
  end_date date,
  status text not null default 'planned',
  order_index integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

ALTER TABLE public.phase_subcategories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "phase_subcategories_select_own" ON public.phase_subcategories FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "phase_subcategories_insert_own" ON public.phase_subcategories FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "phase_subcategories_update_own" ON public.phase_subcategories FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "phase_subcategories_delete_own" ON public.phase_subcategories FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE TRIGGER set_updated_at_phase_subcategories
BEFORE UPDATE ON public.phase_subcategories
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX idx_phase_subcategories_project ON public.phase_subcategories(project_id, phase);

-- 2. User-saved options (vendor categories, payment terms, etc.)
CREATE TABLE public.user_options (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  kind text not null,
  value text not null,
  created_at timestamptz not null default now(),
  UNIQUE (user_id, kind, value)
);

ALTER TABLE public.user_options ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user_options_select_own" ON public.user_options FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "user_options_insert_own" ON public.user_options FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "user_options_delete_own" ON public.user_options FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- 3. Photo image url
ALTER TABLE public.photos ADD COLUMN IF NOT EXISTS image_url text;

-- 4. Storage bucket for project photos
INSERT INTO storage.buckets (id, name, public) VALUES ('project-photos', 'project-photos', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "project_photos_public_read" ON storage.objects FOR SELECT USING (bucket_id = 'project-photos');
CREATE POLICY "project_photos_owner_insert" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'project-photos' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "project_photos_owner_update" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'project-photos' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "project_photos_owner_delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'project-photos' AND auth.uid()::text = (storage.foldername(name))[1]);
