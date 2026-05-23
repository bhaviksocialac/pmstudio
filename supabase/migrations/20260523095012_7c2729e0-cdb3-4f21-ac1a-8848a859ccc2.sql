
CREATE TYPE public.milestone_kind AS ENUM ('room', 'phase', 'work_type', 'custom');
CREATE TYPE public.milestone_status AS ENUM ('pending', 'triggered', 'invoice_sent', 'paid');

CREATE TABLE public.milestones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  project_id uuid NOT NULL,
  name text NOT NULL,
  description text,
  kind public.milestone_kind NOT NULL DEFAULT 'custom',
  trigger jsonb NOT NULL DEFAULT '{}'::jsonb,
  invoice_amount numeric NOT NULL DEFAULT 0,
  client_message_template text,
  status public.milestone_status NOT NULL DEFAULT 'pending',
  triggered_at timestamptz,
  triggered_on_time boolean,
  invoice_id uuid,
  approval_id uuid,
  order_index integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX milestones_project_idx ON public.milestones(project_id);
CREATE INDEX milestones_user_idx ON public.milestones(user_id);

ALTER TABLE public.milestones ENABLE ROW LEVEL SECURITY;

CREATE POLICY milestones_select_own ON public.milestones
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY milestones_insert_own ON public.milestones
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY milestones_update_own ON public.milestones
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY milestones_delete_own ON public.milestones
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE TRIGGER milestones_set_updated_at
  BEFORE UPDATE ON public.milestones
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
