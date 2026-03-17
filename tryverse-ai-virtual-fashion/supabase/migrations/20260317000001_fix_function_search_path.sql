-- Fix search_path for functions (resolves Supabase security warning)
-- Uses ALTER so we don't change function logic, only the search_path setting
ALTER FUNCTION public.handle_new_user() SET search_path = public;
ALTER FUNCTION public.generate_api_key(text) SET search_path = public;
