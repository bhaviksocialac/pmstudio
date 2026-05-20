
-- Extend AI draft kind enum
ALTER TYPE public.ai_draft_kind ADD VALUE IF NOT EXISTS 'attendance_summary';

-- Geo coordinates on projects
ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS latitude numeric,
  ADD COLUMN IF NOT EXISTS longitude numeric;

-- Contractors per project
CREATE TABLE IF NOT EXISTS public.project_contractors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  project_id uuid NOT NULL,
  name text NOT NULL,
  category text,
  phone text,
  expected_days integer NOT NULL DEFAULT 20,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.project_contractors ENABLE ROW LEVEL SECURITY;
CREATE POLICY project_contractors_select_own ON public.project_contractors FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY project_contractors_insert_own ON public.project_contractors FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY project_contractors_update_own ON public.project_contractors FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY project_contractors_delete_own ON public.project_contractors FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE TRIGGER project_contractors_updated_at BEFORE UPDATE ON public.project_contractors FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE INDEX IF NOT EXISTS idx_project_contractors_project ON public.project_contractors(project_id);

-- Daily attendance entries
CREATE TABLE IF NOT EXISTS public.site_attendance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  project_id uuid NOT NULL,
  contractor_id uuid NOT NULL,
  attendance_date date NOT NULL DEFAULT CURRENT_DATE,
  present boolean NOT NULL DEFAULT true,
  workers_count integer NOT NULL DEFAULT 0,
  work_done text,
  hours_on_site numeric,
  check_in_lat numeric,
  check_in_lng numeric,
  checked_in_at timestamptz,
  check_in_outside_geofence boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (contractor_id, attendance_date)
);
ALTER TABLE public.site_attendance ENABLE ROW LEVEL SECURITY;
CREATE POLICY site_attendance_select_own ON public.site_attendance FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY site_attendance_insert_own ON public.site_attendance FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY site_attendance_update_own ON public.site_attendance FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY site_attendance_delete_own ON public.site_attendance FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE TRIGGER site_attendance_updated_at BEFORE UPDATE ON public.site_attendance FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE INDEX IF NOT EXISTS idx_site_attendance_project_date ON public.site_attendance(project_id, attendance_date);
CREATE INDEX IF NOT EXISTS idx_site_attendance_contractor ON public.site_attendance(contractor_id);
