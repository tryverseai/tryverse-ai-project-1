-- =============================================================================
-- TryVerse — paste into Supabase SQL Editor (Dashboard → SQL → New query)
-- Safe to re-run: creates/updates plans, refresh handle_new_user, public read on plans.
-- For a full greenfield schema see: backend/database/schema.sql
-- =============================================================================

-- ─── PLANS TABLE ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.plans (
  id text PRIMARY KEY,
  name text NOT NULL,
  price_ngn integer NOT NULL DEFAULT 0,
  price_usd integer NOT NULL DEFAULT 0,
  tryons_per_month integer NOT NULL DEFAULT 0,
  max_products integer NOT NULL DEFAULT 0,
  features jsonb NOT NULL DEFAULT '[]'::jsonb,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Hybrid B2C + B2B tiers (NGN + USD amounts used at checkout)
INSERT INTO public.plans (id, name, price_ngn, price_usd, tryons_per_month, max_products, features, is_active) VALUES
  (
    'free',
    'Free',
    0,
    0,
    5,
    0,
    '["5 try-ons/month on free pool (individual) · 20 on signup (brands)","Watermark","Basic quality"]'::jsonb,
    true
  ),
  (
    'pro',
    'Pro',
    15000,
    10,
    75,
    0,
    '["50–100 try-ons / month","HD images","No watermark","Download images"]'::jsonb,
    true
  ),
  (
    'creator',
    'Creator',
    30000,
    20,
    250,
    0,
    '["200–300 try-ons / month","HD + better realism","Generate marketing images","Priority processing"]'::jsonb,
    true
  ),
  (
    'starter',
    'Starter',
    80000,
    60,
    150,
    100,
    '["100–200 try-ons / month","50–100 products","Basic fit prediction","Download images"]'::jsonb,
    true
  ),
  (
    'growth',
    'Growth',
    180000,
    150,
    750,
    750,
    '["500–1000 try-ons / month","100–500 products","Analytics","API / widget","Widget embed","Marketing content"]'::jsonb,
    true
  ),
  (
    'enterprise',
    'Enterprise',
    0,
    0,
    -1,
    -1,
    '["AI video generation","Custom models","SLA","Dedicated infrastructure","Widget embed","Let''s talk — negotiated pricing"]'::jsonb,
    true
  )
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  price_ngn = EXCLUDED.price_ngn,
  price_usd = EXCLUDED.price_usd,
  tryons_per_month = EXCLUDED.tryons_per_month,
  max_products = EXCLUDED.max_products,
  features = EXCLUDED.features,
  is_active = EXCLUDED.is_active;

-- Optional: legacy ids some projects use instead of `free`
UPDATE public.plans SET
  name = 'Free',
  tryons_per_month = 5,
  features = '["5 try-ons/month on free pool (individual) · 20 on signup (brands)","Watermark","Basic quality"]'::jsonb
WHERE id IN ('free_trial', 'trial');

ALTER TABLE public.plans ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Plans are publicly readable" ON public.plans;
CREATE POLICY "Plans are publicly readable" ON public.plans
  FOR SELECT TO public
  USING (true);

-- ─── PROFILES: columns apps expect (skip errors if table differs) ──────────
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS brand_name text NOT NULL DEFAULT '';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS contact_email text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS full_name text DEFAULT '';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS role text DEFAULT '';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS free_credits_remaining integer NOT NULL DEFAULT 20;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS free_credits_total integer NOT NULL DEFAULT 20;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS widget_activated boolean NOT NULL DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS monthly_credits_remaining integer NOT NULL DEFAULT 0;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS monthly_credits_total integer NOT NULL DEFAULT 0;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS account_type text NOT NULL DEFAULT 'business';
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_account_type_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_account_type_check
  CHECK (account_type IN ('business', 'individual'));

-- Backend + edge functions may use plan_id and/or current_plan_id
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS plan_id text DEFAULT 'free';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS current_plan_id text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'profiles_plan_id_fkey'
  ) THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_plan_id_fkey
      FOREIGN KEY (plan_id) REFERENCES public.plans(id);
  END IF;
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

-- ─── AUTH: new users get 5 free try-ons (individual) or 20 (business) ─────
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_type text;
  v_free_cap integer;
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
    account_type,
    plan_id
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
    v_type,
    'free'
  )
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
