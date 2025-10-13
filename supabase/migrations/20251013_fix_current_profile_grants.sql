-- Make current_profile RPC callable by client roles
DO $$ BEGIN
  GRANT EXECUTE ON FUNCTION public.current_profile() TO anon;
  GRANT EXECUTE ON FUNCTION public.current_profile() TO authenticated;
EXCEPTION WHEN undefined_function THEN
  -- No-op if function not present in this environment
  PERFORM 1;
END $$;

-- Optional helper grants (if present)
DO $$ BEGIN
  GRANT EXECUTE ON FUNCTION public.is_premium() TO anon;
  GRANT EXECUTE ON FUNCTION public.is_premium() TO authenticated;
EXCEPTION WHEN undefined_function THEN
  PERFORM 1;
END $$;

