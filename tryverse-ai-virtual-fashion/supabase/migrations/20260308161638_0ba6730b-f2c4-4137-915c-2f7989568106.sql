
CREATE EXTENSION IF NOT EXISTS pgcrypto SCHEMA extensions;

CREATE OR REPLACE FUNCTION public.generate_api_key(p_name TEXT DEFAULT 'Production')
RETURNS public.api_keys
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_key TEXT;
  result public.api_keys;
BEGIN
  new_key := 'tv_live_' || encode(extensions.gen_random_bytes(24), 'hex');
  INSERT INTO public.api_keys (user_id, name, key_value)
  VALUES (auth.uid(), p_name, new_key)
  RETURNING * INTO result;
  RETURN result;
END;
$$;
