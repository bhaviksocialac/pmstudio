ALTER TABLE public.projects ALTER COLUMN type DROP DEFAULT;
ALTER TABLE public.projects ALTER COLUMN type TYPE text USING type::text;
ALTER TABLE public.projects ADD CONSTRAINT projects_type_check
  CHECK (type IN ('residential_apartment','independent_villa','penthouse',
                  'commercial_office','retail_shop','restaurant',
                  'hotel_room','other','residential','commercial'));
ALTER TABLE public.projects ALTER COLUMN type SET DEFAULT 'residential_apartment';