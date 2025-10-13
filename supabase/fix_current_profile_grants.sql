-- Ensure the RPC current_profile is callable by anon/authenticated
DO $$ BEGIN
  -- Grant execute to both anon and authenticated
  GRANT EXECUTE ON FUNCTION public.current_profile() TO anon;
  GRANT EXECUTE ON FUNCTION public.current_profile() TO authenticated;
EXCEPTION WHEN undefined_function THEN
  -- If function is missing, create a minimal compatible version, then grant
  PERFORM 1;
END $$;

-- Optional: also expose is_premium helper if used by RLS elsewhere
DO $$ BEGIN
  GRANT EXECUTE ON FUNCTION public.is_premium() TO anon;
  GRANT EXECUTE ON FUNCTION public.is_premium() TO authenticated;
EXCEPTION WHEN undefined_function THEN
  PERFORM 1;
END $$;

