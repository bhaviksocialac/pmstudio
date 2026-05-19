
-- Project phases
CREATE TABLE public.project_phases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  project_id UUID NOT NULL,
  phase project_phase NOT NULL,
  order_index INT NOT NULL,
  start_date DATE,
  end_date DATE,
  status TEXT NOT NULL DEFAULT 'planned',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.project_phases ENABLE ROW LEVEL SECURITY;
CREATE POLICY phases_select_own ON public.project_phases FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY phases_insert_own ON public.project_phases FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY phases_update_own ON public.project_phases FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY phases_delete_own ON public.project_phases FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE TRIGGER trg_project_phases_updated BEFORE UPDATE ON public.project_phases FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE INDEX idx_project_phases_project ON public.project_phases(project_id);

-- Budget lines
CREATE TABLE public.budget_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  project_id UUID NOT NULL,
  category TEXT NOT NULL,
  percentage NUMERIC NOT NULL DEFAULT 0,
  amount NUMERIC NOT NULL DEFAULT 0,
  order_index INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.budget_lines ENABLE ROW LEVEL SECURITY;
CREATE POLICY budget_lines_select_own ON public.budget_lines FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY budget_lines_insert_own ON public.budget_lines FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY budget_lines_update_own ON public.budget_lines FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY budget_lines_delete_own ON public.budget_lines FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE TRIGGER trg_budget_lines_updated BEFORE UPDATE ON public.budget_lines FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE INDEX idx_budget_lines_project ON public.budget_lines(project_id);

-- Project rooms
CREATE TABLE public.project_rooms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  project_id UUID NOT NULL,
  name TEXT NOT NULL,
  order_index INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.project_rooms ENABLE ROW LEVEL SECURITY;
CREATE POLICY project_rooms_select_own ON public.project_rooms FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY project_rooms_insert_own ON public.project_rooms FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY project_rooms_update_own ON public.project_rooms FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY project_rooms_delete_own ON public.project_rooms FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE TRIGGER trg_project_rooms_updated BEFORE UPDATE ON public.project_rooms FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE INDEX idx_project_rooms_project ON public.project_rooms(project_id);

-- Room scope items
CREATE TABLE public.room_scope_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  project_id UUID NOT NULL,
  room_id UUID NOT NULL,
  label TEXT NOT NULL,
  done BOOLEAN NOT NULL DEFAULT false,
  order_index INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.room_scope_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY room_scope_items_select_own ON public.room_scope_items FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY room_scope_items_insert_own ON public.room_scope_items FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY room_scope_items_update_own ON public.room_scope_items FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY room_scope_items_delete_own ON public.room_scope_items FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE TRIGGER trg_room_scope_items_updated BEFORE UPDATE ON public.room_scope_items FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE INDEX idx_room_scope_items_room ON public.room_scope_items(room_id);
CREATE INDEX idx_room_scope_items_project ON public.room_scope_items(project_id);
