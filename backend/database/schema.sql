-- ============================================================
-- TryVerse Complete Database Schema
-- Paste this ENTIRE file into Supabase SQL Editor and run it.
-- Safe to run multiple times (uses IF NOT EXISTS, DROP POLICY IF EXISTS, ON CONFLICT).
-- Includes: core app tables, support_requests, early_access_requests, tryverse_model_library (all models).
-- ============================================================

-- ─── EXTENSIONS ─────────────────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ─── PLANS ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS plans (
  id                TEXT PRIMARY KEY,
  name              TEXT NOT NULL,
  price_ngn         INTEGER DEFAULT 0,
  price_usd         INTEGER DEFAULT 0,
  tryons_per_month  INTEGER DEFAULT 0,   -- -1 = unlimited
  max_products      INTEGER DEFAULT 0,   -- -1 = unlimited
  features          JSONB DEFAULT '[]',
  is_active         BOOLEAN DEFAULT true,
  created_at        TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO plans (id, name, price_ngn, price_usd, tryons_per_month, max_products, features, is_active)
VALUES
  ('free',       'Free Trial',  0,      0,   3,    5,    '["3 free try-ons","Basic quality","Email support"]',                                                                                    true),
  ('starter',    'Starter',     150000, 100, 100,  100,  '["100 try-ons/month","Basic fit prediction","Widget embed","Email support"]',                                                           true),
  ('growth',     'Growth',      500000, 350, 1000, 1000, '["1,000 try-ons/month","Advanced fit prediction","AI marketing content","Analytics dashboard","Priority support"]',                     true),
  ('enterprise', 'Enterprise',  0,      0,   -1,   -1,   '["Unlimited try-ons","AI video generation","Custom model training","Dedicated API access","SLA guarantee","Account manager"]',         true)
ON CONFLICT (id) DO NOTHING;

-- ─── PROFILES ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS profiles (
  id                         UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  brand_name                 TEXT DEFAULT 'My Brand',
  full_name                  TEXT DEFAULT '',
  contact_email              TEXT,
  avatar_url                 TEXT,
  website                    TEXT,
  plan_id                    TEXT REFERENCES plans(id) DEFAULT 'free',
  role                       TEXT DEFAULT 'brand',          -- 'brand' | 'admin'
  free_credits_remaining     INTEGER DEFAULT 3,
  free_credits_total         INTEGER DEFAULT 3,
  monthly_credits_remaining  INTEGER DEFAULT 0,
  monthly_credits_total      INTEGER DEFAULT 0,
  widget_activated                   BOOLEAN DEFAULT false,
  compliance_onboarding_completed_at TIMESTAMPTZ DEFAULT NULL,
  created_at                         TIMESTAMPTZ DEFAULT NOW(),
  updated_at                         TIMESTAMPTZ DEFAULT NOW()
);

-- ─── API KEYS ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS api_keys (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  key_value   TEXT NOT NULL UNIQUE,
  name        TEXT DEFAULT 'Default',
  status      TEXT DEFAULT 'active',       -- 'active' | 'revoked'
  last_used   TIMESTAMPTZ,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ─── ALLOWED DOMAINS ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS allowed_domains (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  api_key_id  UUID NOT NULL REFERENCES api_keys(id) ON DELETE CASCADE,
  domain      TEXT NOT NULL,
  verified    BOOLEAN DEFAULT false,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ─── TRYONS ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS tryons (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id       UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  person_image  TEXT,                      -- storage path
  product_image TEXT,                      -- storage path (renamed from garment_image)
  garment_image TEXT,                      -- kept for backward compat
  category      TEXT DEFAULT 'clothing',   -- 'clothing' | 'bags' | 'glasses'
  status        TEXT DEFAULT 'queued',     -- 'queued' | 'processing' | 'completed' | 'failed'
  result_image  TEXT,                      -- storage path of generated result
  completed_at  TIMESTAMPTZ,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ─── PAYMENTS ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS payments (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plan_id      TEXT REFERENCES plans(id),
  amount       INTEGER NOT NULL,           -- in smallest currency unit
  currency     TEXT DEFAULT 'NGN',
  provider     TEXT NOT NULL,              -- 'paystack' | 'flutterwave'
  reference    TEXT UNIQUE,
  status       TEXT DEFAULT 'pending',     -- 'pending' | 'success' | 'failed'
  metadata     JSONB DEFAULT '{}',
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- ─── SUBSCRIPTIONS ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS subscriptions (
  id                     UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id                UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plan_id                TEXT NOT NULL REFERENCES plans(id),
  status                 TEXT DEFAULT 'active',  -- 'active' | 'cancelled' | 'expired'
  provider               TEXT,                     -- 'paystack' | 'flutterwave'
  provider_subscription_id TEXT,
  current_period_start   TIMESTAMPTZ DEFAULT NOW(),
  current_period_end     TIMESTAMPTZ,
  payment_id             UUID REFERENCES payments(id),
  created_at             TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id)
);

-- ─── ADMIN AUDIT LOG ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS admin_audit_log (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_type  TEXT NOT NULL,
  actor       TEXT,
  action      TEXT NOT NULL,
  target_id   TEXT,
  details     JSONB DEFAULT '{}',
  ip_address  TEXT,
  user_agent  TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_admin_audit_log_created_at ON admin_audit_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_audit_log_event_type ON admin_audit_log(event_type);
ALTER TABLE admin_audit_log ENABLE ROW LEVEL SECURITY;

-- ─── PRODUCTS (Brand product catalog) ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS products (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  image_url   TEXT,                       -- storage path or external URL
  category    TEXT DEFAULT 'clothing',    -- 'clothing' | 'bags' | 'glasses'
  product_url TEXT,                       -- link to product page
  tryons_count INTEGER DEFAULT 0,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_products_user_id ON products(user_id);
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);

-- ─── USAGE EVENTS ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS usage_events (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  event_type  TEXT NOT NULL,               -- 'tryon_completed' | 'tryon_failed' | 'payment_success' etc.
  metadata    JSONB DEFAULT '{}',
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ─── RATE LIMITS ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS rate_limits (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  identifier  TEXT NOT NULL,               -- IP or user ID
  endpoint    TEXT NOT NULL,
  requests    INTEGER DEFAULT 1,
  window_start TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(identifier, endpoint)
);

-- ─── AUTO-CREATE PROFILE ON SIGNUP ───────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
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
    role
  ) VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'brand_name', 'My Brand'),
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    NEW.email,
    3,     -- 3 free try-ons on signup
    3,
    0,
    0,
    false,
    COALESCE(NEW.raw_user_meta_data->>'role', 'brand')
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ─── API KEY GENERATION FUNCTION ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.generate_api_key(p_name TEXT DEFAULT 'Default')
RETURNS SETOF public.api_keys
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_key    TEXT;
  v_result public.api_keys;
BEGIN
  v_key := 'TV_' || encode(gen_random_bytes(32), 'hex');

  INSERT INTO public.api_keys (user_id, key_value, name, status)
  VALUES (auth.uid(), v_key, p_name, 'active')
  RETURNING * INTO v_result;

  RETURN NEXT v_result;
END;
$$;

-- ─── ROW LEVEL SECURITY ──────────────────────────────────────────────────────

-- profiles
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "users_own_profile" ON profiles;
CREATE POLICY "users_own_profile" ON profiles
  FOR ALL USING (auth.uid() = id);

-- api_keys
ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "users_own_api_keys" ON api_keys;
CREATE POLICY "users_own_api_keys" ON api_keys
  FOR ALL USING (auth.uid() = user_id);

-- allowed_domains
ALTER TABLE allowed_domains ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "users_own_domains" ON allowed_domains;
CREATE POLICY "users_own_domains" ON allowed_domains
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM api_keys
      WHERE api_keys.id = allowed_domains.api_key_id
        AND api_keys.user_id = auth.uid()
    )
  );

-- tryons
ALTER TABLE tryons ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "users_own_tryons" ON tryons;
CREATE POLICY "users_own_tryons" ON tryons
  FOR ALL USING (auth.uid() = user_id OR user_id IS NULL);

-- payments
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "users_own_payments" ON payments;
CREATE POLICY "users_own_payments" ON payments
  FOR SELECT USING (auth.uid() = user_id);

-- subscriptions
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "users_own_subscriptions" ON subscriptions;
CREATE POLICY "users_own_subscriptions" ON subscriptions
  FOR SELECT USING (auth.uid() = user_id);

-- plans: anyone can read
ALTER TABLE plans ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "plans_public_read" ON plans;
CREATE POLICY "plans_public_read" ON plans
  FOR SELECT USING (true);

-- usage_events
ALTER TABLE usage_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "users_own_events" ON usage_events;
CREATE POLICY "users_own_events" ON usage_events
  FOR SELECT USING (auth.uid() = user_id);

-- rate_limits: backend service role only
ALTER TABLE rate_limits ENABLE ROW LEVEL SECURITY;

-- ─── INDEXES ─────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_tryons_user_id       ON tryons(user_id);
CREATE INDEX IF NOT EXISTS idx_tryons_status        ON tryons(status);
CREATE INDEX IF NOT EXISTS idx_tryons_created_at    ON tryons(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_tryons_category      ON tryons(category);
CREATE INDEX IF NOT EXISTS idx_api_keys_key_value   ON api_keys(key_value);
CREATE INDEX IF NOT EXISTS idx_api_keys_user_id     ON api_keys(user_id);
CREATE INDEX IF NOT EXISTS idx_allowed_domains_key  ON allowed_domains(api_key_id);
CREATE INDEX IF NOT EXISTS idx_payments_user_id     ON payments(user_id);
CREATE INDEX IF NOT EXISTS idx_payments_reference   ON payments(reference);
CREATE INDEX IF NOT EXISTS idx_subscriptions_user   ON subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_usage_events_user     ON usage_events(user_id);
CREATE INDEX IF NOT EXISTS idx_usage_events_date    ON usage_events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_profiles_plan        ON profiles(plan_id);

-- ─── MIGRATIONS (run if upgrading existing DB) ─────────────────────────────────
-- Add unique user_id to subscriptions for upsert (run manually if table exists):
-- ALTER TABLE subscriptions ADD CONSTRAINT subscriptions_user_id_key UNIQUE (user_id);
-- ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS provider TEXT;
-- ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS provider_subscription_id TEXT;

-- products RLS
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "users_own_products" ON products;
CREATE POLICY "users_own_products" ON products
  FOR ALL USING (auth.uid() = user_id);

-- ─── PROFILES: columns from later Supabase migrations ────────────────────────
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_blocked BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS onboarding_goals TEXT[] DEFAULT '{}';
COMMENT ON COLUMN public.profiles.is_blocked IS 'When true, backend rejects authenticated API calls for this user';
COMMENT ON COLUMN public.profiles.onboarding_goals IS 'Goals selected during signup (e.g. premium look, conversions)';

-- ─── SUPPORT REQUESTS (contact form) ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.support_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT,
  email TEXT NOT NULL,
  category TEXT NOT NULL,
  subject TEXT NOT NULL,
  message TEXT NOT NULL,
  status TEXT DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'resolved')),
  first_name TEXT,
  last_name TEXT,
  company_name TEXT,
  phone_number TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.support_requests ADD COLUMN IF NOT EXISTS first_name TEXT;
ALTER TABLE public.support_requests ADD COLUMN IF NOT EXISTS last_name TEXT;
ALTER TABLE public.support_requests ADD COLUMN IF NOT EXISTS company_name TEXT;
ALTER TABLE public.support_requests ADD COLUMN IF NOT EXISTS phone_number TEXT;
ALTER TABLE public.support_requests ALTER COLUMN name DROP NOT NULL;
ALTER TABLE public.support_requests ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone can submit support requests" ON public.support_requests;
CREATE POLICY "Anyone can submit support requests" ON public.support_requests
  FOR INSERT TO anon, authenticated
  WITH CHECK (true);
DROP POLICY IF EXISTS "Authenticated users can read support requests" ON public.support_requests;
CREATE POLICY "Authenticated users can read support requests" ON public.support_requests
  FOR SELECT TO authenticated
  USING (true);

-- ─── EARLY ACCESS / WAITLIST ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.early_access_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  first_name TEXT NOT NULL,
  email TEXT NOT NULL,
  brand_name TEXT NOT NULL,
  role TEXT NOT NULL,
  website_url TEXT NOT NULL,
  platform TEXT NOT NULL,
  product_range TEXT NOT NULL,
  monthly_revenue TEXT NOT NULL,
  return_rate TEXT NOT NULL,
  top_return_reason TEXT NOT NULL,
  customer_confidence TEXT NOT NULL,
  tried_solutions JSONB NOT NULL DEFAULT '[]'::JSONB,
  must_have_features JSONB NOT NULL DEFAULT '[]'::JSONB,
  biggest_challenge TEXT NOT NULL,
  timeline TEXT NOT NULL,
  heard_about TEXT,
  prior_solution_notes TEXT
);
CREATE INDEX IF NOT EXISTS early_access_requests_email_lower_idx ON public.early_access_requests (lower(email));
CREATE INDEX IF NOT EXISTS early_access_requests_created_at_idx ON public.early_access_requests (created_at DESC);
ALTER TABLE public.early_access_requests ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone can submit early access request" ON public.early_access_requests;
CREATE POLICY "Anyone can submit early access request"
  ON public.early_access_requests
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- ─── TRYVERSE MODEL LIBRARY (preset try-on models; male + female) ─────────────
CREATE TABLE IF NOT EXISTS public.tryverse_model_library (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  gender TEXT NOT NULL CHECK (gender IN ('female', 'male')),
  body_type TEXT,
  appearance_tag TEXT,
  image_url TEXT NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_tryverse_model_library_active_sort
  ON public.tryverse_model_library (is_active, sort_order);
ALTER TABLE public.tryverse_model_library ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'tryverse_model_library'
      AND policyname = 'Anyone can read active tryverse models'
  ) THEN
    CREATE POLICY "Anyone can read active tryverse models"
      ON public.tryverse_model_library FOR SELECT
      USING (is_active = true);
  END IF;
END $$;
COMMENT ON TABLE public.tryverse_model_library IS
  'Preset person images for virtual try-on. image_url may be HTTPS or /model-library/... (resolved with FRONTEND_URL on the API).';

INSERT INTO public.tryverse_model_library
  (slug, display_name, gender, body_type, appearance_tag, image_url, sort_order, is_active)
VALUES
  ('zoe', 'Zoe', 'female', NULL, NULL, '/model-library/zoe.png', 10, true),
  ('lina', 'Lina', 'female', NULL, NULL, '/model-library/lina.png', 20, true),
  ('min-ji', 'Min-Ji', 'female', NULL, NULL, '/model-library/min-ji.png', 30, true),
  ('sophia', 'Sophia', 'female', NULL, NULL, '/model-library/sophia.png', 40, true),
  ('camila', 'Camila', 'female', NULL, NULL, '/model-library/camila.png', 50, true),
  ('rashna', 'Rashna', 'female', NULL, NULL, '/model-library/rashna.png', 60, true),
  ('stephanie', 'Stephanie', 'female', 'Child', 'Black / African descent', '/model-library/stephanie.png', 65, true),
  ('asher', 'Asher', 'female', 'Child', 'East Asian', '/model-library/asher.png', 70, true),
  ('hanna', 'Hanna', 'female', 'Child', 'Black / African descent', '/model-library/hanna.png', 75, true),
  ('mia', 'Mia', 'female', 'Slim', 'East Asian', '/model-library/mia.png', 80, true),
  ('louis', 'Louis', 'female', 'Child', 'White / European', '/model-library/louis.png', 85, true),
  ('aiko', 'Aiko', 'female', 'Regular', 'East Asian', '/model-library/aiko.png', 90, true),
  ('nicole', 'Nicole', 'female', 'Slim', 'Latine / Hispanic', '/model-library/nicole.png', 95, true),
  ('diane', 'Diane', 'female', 'Curvy', 'White / European', '/model-library/diane.png', 100, true),
  ('andrew', 'Andrew', 'male', NULL, NULL, '/model-library/andrew.png', 110, true),
  ('jack', 'Jack', 'male', NULL, NULL, '/model-library/jack.png', 120, true),
  ('jordan', 'Jordan', 'male', NULL, NULL, '/model-library/jordan.png', 130, true),
  ('steve', 'Steve', 'male', NULL, NULL, '/model-library/steve.png', 140, true),
  ('vandik', 'Vandik', 'male', NULL, NULL, '/model-library/vandik.png', 150, true),
  ('lucas', 'Lucas', 'male', NULL, NULL, '/model-library/lucas.png', 160, true),
  ('max', 'Max', 'male', 'Plus-size', 'Middle Eastern / South Asian', '/model-library/max.png', 165, true),
  ('li-xeng', 'Li Xeng', 'male', 'Athletic', 'East Asian', '/model-library/li-xeng.png', 170, true),
  ('jed', 'Jed', 'male', 'Slim', 'White / European', '/model-library/jed.png', 175, true),
  ('alex', 'Alex', 'male', 'Child', 'White / European', '/model-library/alex.png', 180, true),
  ('alfred', 'Alfred', 'male', 'Child', 'Latine / Hispanic', '/model-library/alfred.png', 185, true),
  ('derrick', 'Derrick', 'male', 'Child', 'White / European', '/model-library/derrick.png', 190, true)
ON CONFLICT (slug) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  gender = EXCLUDED.gender,
  body_type = EXCLUDED.body_type,
  appearance_tag = EXCLUDED.appearance_tag,
  image_url = EXCLUDED.image_url,
  sort_order = EXCLUDED.sort_order,
  is_active = EXCLUDED.is_active;
