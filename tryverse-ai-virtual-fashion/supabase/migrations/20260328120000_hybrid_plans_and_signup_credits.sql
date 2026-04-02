-- Hybrid B2C/B2B: signup free pools (individual 5, brand 20), new consumer plans, updated brand tiers.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_type TEXT;
  v_free_cap INTEGER;
BEGIN
  v_type := COALESCE(NULLIF(TRIM(NEW.raw_user_meta_data->>'account_type'), ''), 'business');
  IF v_type NOT IN ('business', 'individual') THEN
    v_type := 'business';
  END IF;

  v_free_cap := CASE WHEN v_type = 'individual' THEN 5 ELSE 20 END;

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
    v_free_cap,
    v_free_cap,
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

-- B2C tiers
INSERT INTO public.plans (id, name, price_ngn, price_usd, tryons_per_month, max_products, features) VALUES
  ('pro', 'Pro', 7500, 8, 75, 0,
   '["50–100 try-ons / month (quota)","HD images","No watermark","Download images"]'::jsonb),
  ('creator', 'Creator', 15000, 15, 250, 0,
   '["200–300 try-ons / month (quota)","HD + stronger realism","Generate marketing images","Priority processing"]'::jsonb)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  price_ngn = EXCLUDED.price_ngn,
  price_usd = EXCLUDED.price_usd,
  tryons_per_month = EXCLUDED.tryons_per_month,
  max_products = EXCLUDED.max_products,
  features = EXCLUDED.features,
  is_active = true;

-- B2B tiers (mid-range pricing; checkout uses these amounts)
UPDATE public.plans SET
  name = 'Starter',
  price_ngn = 65000,
  price_usd = 45,
  tryons_per_month = 150,
  max_products = 100,
  features = '["100–200 try-ons / month (quota)","50–100 products","Basic fit prediction","Download images"]'::jsonb
WHERE id = 'starter';

UPDATE public.plans SET
  name = 'Growth',
  price_ngn = 200000,
  price_usd = 140,
  tryons_per_month = 750,
  max_products = 750,
  features = '["500–1000 try-ons / month (quota)","100–500 products","Analytics","API / widget","Marketing content"]'::jsonb
WHERE id = 'growth';

UPDATE public.plans SET
  name = 'Enterprise',
  features = '["AI video generation","Custom models","SLA","Dedicated infrastructure","Custom pricing — contact sales"]'::jsonb
WHERE id = 'enterprise';

-- Free row: marketing copy; actual pool size is set per account_type on the profile.
UPDATE public.plans SET
  tryons_per_month = 5,
  features = '["Free try-on pool (individuals: 5 · brands: 20 on signup)","Watermark on free tier","Basic quality","Upgrade anytime"]'::jsonb
WHERE id = 'free';
