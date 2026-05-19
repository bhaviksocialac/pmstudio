
-- whatsapp_groups
CREATE TYPE public.whatsapp_group_kind AS ENUM ('client','design','execution','accounts');

CREATE TABLE public.whatsapp_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  kind public.whatsapp_group_kind NOT NULL,
  label text NOT NULL,
  phone text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, kind)
);

ALTER TABLE public.whatsapp_groups ENABLE ROW LEVEL SECURITY;

CREATE POLICY whatsapp_groups_select_own ON public.whatsapp_groups FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY whatsapp_groups_insert_own ON public.whatsapp_groups FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY whatsapp_groups_update_own ON public.whatsapp_groups FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY whatsapp_groups_delete_own ON public.whatsapp_groups FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE TRIGGER whatsapp_groups_set_updated_at
BEFORE UPDATE ON public.whatsapp_groups
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- photos.status
CREATE TYPE public.photo_status AS ENUM ('pending','approved','rejected');
ALTER TABLE public.photos ADD COLUMN status public.photo_status NOT NULL DEFAULT 'approved';
-- new uploads default via app-level insert with 'pending'

-- tasks.delayed
ALTER TABLE public.tasks ADD COLUMN delayed boolean NOT NULL DEFAULT false;
