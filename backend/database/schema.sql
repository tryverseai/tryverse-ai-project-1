-- ============================================================
-- TryVerse Complete Database Schema
-- Paste this ENTIRE file into Supabase SQL Editor and run it.
-- Safe to run multiple times (uses IF NOT EXISTS / ON CONFLICT).
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
  widget_activated           BOOLEAN DEFAULT false,
  created_at                 TIMESTAMPTZ DEFAULT NOW(),
  updated_at                 TIMESTAMPTZ DEFAULT NOW()
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
