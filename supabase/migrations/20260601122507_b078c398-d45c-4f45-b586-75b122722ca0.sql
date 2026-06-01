
REVOKE EXECUTE ON FUNCTION public.purge_trashed_rows() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.purge_trashed_rows() FROM anon;
REVOKE EXECUTE ON FUNCTION public.purge_trashed_rows() FROM authenticated;
GRANT  EXECUTE ON FUNCTION public.purge_trashed_rows() TO postgres;
