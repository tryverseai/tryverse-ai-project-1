-- Align free-tier default pool with app/backend (3 -> 20 try-ons for new users).

ALTER TABLE public.profiles
  ALTER COLUMN free_credits_remaining SET DEFAULT 20,
  ALTER COLUMN free_credits_total SET DEFAULT 20;

UPDATE public.plans
SET
  tryons_per_month = 20,
  features = '["20 free try-ons","Basic quality","Email support"]'::jsonb
WHERE id = 'free';

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
    20,
    20,
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
