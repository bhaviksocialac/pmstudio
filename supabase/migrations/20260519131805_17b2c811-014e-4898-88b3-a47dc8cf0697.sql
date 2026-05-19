
-- Enums
CREATE TYPE public.ai_draft_kind AS ENUM ('weekly_report', 'vendor_followup', 'delay_notice', 'holding', 'event_notification');
CREATE TYPE public.ai_draft_status AS ENUM ('pending', 'sent', 'discarded');
CREATE TYPE public.vendor_delivery_status AS ENUM ('pending', 'delivered', 'delayed');

-- ai_drafts table
CREATE TABLE public.ai_drafts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  project_id uuid,
  kind public.ai_draft_kind NOT NULL,
  recipient_kind text NOT NULL CHECK (recipient_kind IN ('client', 'vendor')),
  recipient_id uuid,
  recipient_name text,
  recipient_phone text,
  subject text,
  body text NOT NULL,
  meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  status public.ai_draft_status NOT NULL DEFAULT 'pending',
  sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_ai_drafts_user_status ON public.ai_drafts (user_id, status, created_at DESC);
CREATE INDEX idx_ai_drafts_project ON public.ai_drafts (project_id);

ALTER TABLE public.ai_drafts ENABLE ROW LEVEL SECURITY;

CREATE POLICY ai_drafts_select_own ON public.ai_drafts FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY ai_drafts_insert_own ON public.ai_drafts FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY ai_drafts_update_own ON public.ai_drafts FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY ai_drafts_delete_own ON public.ai_drafts FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE TRIGGER ai_drafts_updated_at BEFORE UPDATE ON public.ai_drafts FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- vendor_deliveries table
CREATE TABLE public.vendor_deliveries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  project_id uuid NOT NULL,
  vendor_id uuid,
  item text NOT NULL,
  expected_date date NOT NULL,
  status public.vendor_delivery_status NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_vendor_deliveries_user_date ON public.vendor_deliveries (user_id, expected_date);
CREATE INDEX idx_vendor_deliveries_project ON public.vendor_deliveries (project_id);

ALTER TABLE public.vendor_deliveries ENABLE ROW LEVEL SECURITY;

CREATE POLICY vendor_deliveries_select_own ON public.vendor_deliveries FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY vendor_deliveries_insert_own ON public.vendor_deliveries FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY vendor_deliveries_update_own ON public.vendor_deliveries FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY vendor_deliveries_delete_own ON public.vendor_deliveries FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE TRIGGER vendor_deliveries_updated_at BEFORE UPDATE ON public.vendor_deliveries FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
