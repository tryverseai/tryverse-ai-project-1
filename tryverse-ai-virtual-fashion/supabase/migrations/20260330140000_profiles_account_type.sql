-- B2B vs B2C: account_type drives dashboard routing and feature access.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS account_type TEXT NOT NULL DEFAULT 'business';

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_account_type_check;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_account_type_check
  CHECK (account_type IN ('business', 'individual'));

COMMENT ON COLUMN public.profiles.account_type IS 'business = brand dashboard; individual = consumer try-on experience';

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_type TEXT;
BEGIN
  v_type := COALESCE(NULLIF(TRIM(NEW.raw_user_meta_data->>'account_type'), ''), 'business');
  IF v_type NOT IN ('business', 'individual') THEN
    v_type := 'business';
  END IF;

  INSERT INTO public.profiles (
    id,
    brand_name,
    full_name,
    contact_email,
    free_credits_remaining,
    free_credits_total,
    monthly_credits_remaining,
    monthly_credits_total,
    widget_activated,
    role,
    account_type
  ) VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'brand_name', 'My Brand'),
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    NEW.email,
    3,
    3,
    0,
    0,
    false,
    COALESCE(NEW.raw_user_meta_data->>'role', 'brand'),
    v_type
  )
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$$;
