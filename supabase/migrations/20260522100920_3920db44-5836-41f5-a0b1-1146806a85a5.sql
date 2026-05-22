ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS ifr_date date,
  ADD COLUMN IF NOT EXISTS ifr_type text;