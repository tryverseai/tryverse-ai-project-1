-- =============================================================================
-- TryVerse: consolidated Supabase migration SQL (reference for Convex migration)
-- Order: migrations/*.sql sorted by filename. Supabase-only: auth, RLS, triggers.
-- =============================================================================



-- === FILE: 20260308155440_c170ddad-a008-43f6-9fcc-a62f4e60dfc2.sql ===



-- Profiles table for brand settings
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  brand_name TEXT NOT NULL DEFAULT '',
  website_url TEXT DEFAULT '',
  contact_email TEXT DEFAULT '',
  widget_show_models BOOLEAN DEFAULT true,
  widget_fit_recommendations BOOLEAN DEFAULT true,
  widget_auto_detect BOOLEAN DEFAULT false,
  widget_collect_analytics BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id);
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);

-- API keys table
CREATE TABLE public.api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL DEFAULT 'Production',
  key_value TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'revoked')),
  last_used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.api_keys ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own keys" ON public.api_keys FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own keys" ON public.api_keys FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own keys" ON public.api_keys FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own keys" ON public.api_keys FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Usage events table (tracks try-ons, widget activations)
CREATE TABLE public.usage_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  event_type TEXT NOT NULL CHECK (event_type IN ('try_on', 'widget_activation', 'ai_generation')),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.usage_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own events" ON public.usage_events FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own events" ON public.usage_events FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, brand_name, contact_email)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'brand_name', ''), NEW.email);
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Function to generate API key
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
  new_key := 'tv_live_' || encode(gen_random_bytes(24), 'hex');
  INSERT INTO public.api_keys (user_id, name, key_value)
  VALUES (auth.uid(), p_name, new_key)
  RETURNING * INTO result;
  RETURN result;
END;
$$;



-- === FILE: 20260308161638_0ba6730b-f2c4-4137-915c-2f7989568106.sql ===



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



-- === FILE: 20260308225936_0b7da00c-e764-4299-aaf4-559c085db816.sql ===



ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS free_credits_remaining integer NOT NULL DEFAULT 3,
ADD COLUMN IF NOT EXISTS free_credits_total integer NOT NULL DEFAULT 3,
ADD COLUMN IF NOT EXISTS full_name text DEFAULT '',
ADD COLUMN IF NOT EXISTS role text DEFAULT '',
ADD COLUMN IF NOT EXISTS widget_activated boolean NOT NULL DEFAULT false;



-- === FILE: 20260308230249_a8c94d88-a468-438f-9605-179bd19cfbb8.sql ===



CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.profiles (id, brand_name, contact_email, full_name, role, free_credits_remaining, free_credits_total)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'brand_name', ''),
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'role', ''),
    3,
    3
  );
  RETURN NEW;
END;
$function$;



-- === FILE: 20260311004225_e651887b-3e5e-459c-bf13-b5568cbbfae2.sql ===



-- Plans table for defining subscription tiers
CREATE TABLE public.plans (
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

-- Insert default plans
INSERT INTO public.plans (id, name, price_ngn, price_usd, tryons_per_month, max_products, features) VALUES
  ('starter', 'Starter', 150000, 100, 100, 100, '["Widget embed", "Basic fit prediction", "Email support"]'::jsonb),
  ('growth', 'Growth', 500000, 350, 1000, 1000, '["Advanced fit prediction", "AI marketing content", "Priority support", "Analytics dashboard"]'::jsonb),
  ('enterprise', 'Enterprise', 0, 0, -1, -1, '["Unlimited everything", "Custom model training", "Dedicated account manager"]'::jsonb);

-- Allowed domains table for API key domain whitelisting
CREATE TABLE public.allowed_domains (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  api_key_id uuid NOT NULL REFERENCES public.api_keys(id) ON DELETE CASCADE,
  domain text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(api_key_id, domain)
);

ALTER TABLE public.allowed_domains ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own domains" ON public.allowed_domains
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.api_keys WHERE api_keys.id = allowed_domains.api_key_id AND api_keys.user_id = auth.uid()));

CREATE POLICY "Users can insert own domains" ON public.allowed_domains
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.api_keys WHERE api_keys.id = allowed_domains.api_key_id AND api_keys.user_id = auth.uid()));

CREATE POLICY "Users can delete own domains" ON public.allowed_domains
  FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.api_keys WHERE api_keys.id = allowed_domains.api_key_id AND api_keys.user_id = auth.uid()));

-- Rate limits table for API rate limiting
CREATE TABLE public.rate_limits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  api_key_id text NOT NULL,
  window_start timestamptz NOT NULL DEFAULT now(),
  request_count integer NOT NULL DEFAULT 1,
  UNIQUE(api_key_id, window_start)
);

ALTER TABLE public.rate_limits ENABLE ROW LEVEL SECURITY;

-- Only service role can access rate_limits (edge functions use service role)
CREATE POLICY "Service role only" ON public.rate_limits
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

-- Add monthly_credits_remaining to profiles for plan-based credits
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS monthly_credits_remaining integer NOT NULL DEFAULT 0;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS monthly_credits_total integer NOT NULL DEFAULT 0;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS current_plan_id text REFERENCES public.plans(id) DEFAULT NULL;

-- Create trigger for handle_new_user on auth.users
CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();



-- === FILE: 20260311004232_a957ea92-b328-447c-a044-50219fdf6a51.sql ===



-- Plans table is public read-only data
ALTER TABLE public.plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Plans are publicly readable" ON public.plans
  FOR SELECT TO public
  USING (true);



-- === FILE: 20260317000000_admin_audit_log.sql ===


-- Admin audit log for security and compliance
CREATE TABLE IF NOT EXISTS public.admin_audit_log (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_type  TEXT NOT NULL,           -- admin_action, failed_login, rate_limit, api_key_blocked, api_key_anomaly
  actor       TEXT,                    -- admin, ip:x.x.x.x, api_key:xxx, user:uuid
  action      TEXT NOT NULL,           -- user_banned, credits_adjusted, key_revoked, etc.
  target_id   TEXT,                    -- userId, keyId, etc.
  details     JSONB DEFAULT '{}',
  ip_address  TEXT,
  user_agent  TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_admin_audit_log_created_at ON public.admin_audit_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_audit_log_event_type ON public.admin_audit_log(event_type);
CREATE INDEX IF NOT EXISTS idx_admin_audit_log_actor ON public.admin_audit_log(actor);

-- RLS enabled: blocks direct client access. Backend uses service role (bypasses RLS).
ALTER TABLE public.admin_audit_log ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.admin_audit_log IS 'Security audit trail: admin actions, failed logins, rate limits, API key events';



-- === FILE: 20260317000001_fix_function_search_path.sql ===


-- Fix search_path for functions (resolves Supabase security warning)
-- Uses ALTER so we don't change function logic, only the search_path setting
ALTER FUNCTION public.handle_new_user() SET search_path = public;
ALTER FUNCTION public.generate_api_key(text) SET search_path = public;



-- === FILE: 20260318000000_compliance_onboarding.sql ===


-- Track when user completes Terms, Privacy, and Data Processing acknowledgment
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS compliance_onboarding_completed_at TIMESTAMPTZ DEFAULT NULL;

COMMENT ON COLUMN public.profiles.compliance_onboarding_completed_at IS 'When user acknowledged Terms, Privacy, and Data Processing during signup';



-- === FILE: 20260319000000_support_requests.sql ===


-- Support requests table for contact/support form submissions
CREATE TABLE IF NOT EXISTS public.support_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  category TEXT NOT NULL,
  subject TEXT NOT NULL,
  message TEXT NOT NULL,
  status TEXT DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'resolved')),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Allow anyone to submit support requests (anon insert)
ALTER TABLE public.support_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can submit support requests" ON public.support_requests
  FOR INSERT TO anon, authenticated
  WITH CHECK (true);

-- Only authenticated users can read (for admin/dashboard - add admin check if needed)
CREATE POLICY "Authenticated users can read support requests" ON public.support_requests
  FOR SELECT TO authenticated
  USING (true);



-- === FILE: 20260319000001_support_requests_extend.sql ===


-- Add new columns to support_requests for Contact Us form
ALTER TABLE public.support_requests
  ADD COLUMN IF NOT EXISTS first_name TEXT,
  ADD COLUMN IF NOT EXISTS last_name TEXT,
  ADD COLUMN IF NOT EXISTS company_name TEXT,
  ADD COLUMN IF NOT EXISTS phone_number TEXT;

-- Make name nullable since we now use first_name/last_name
ALTER TABLE public.support_requests ALTER COLUMN name DROP NOT NULL;



-- === FILE: 20260319120000_profiles_is_blocked.sql ===


-- Admin block/unblock: enforced in API via is_blocked + Supabase auth ban when supported
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_blocked boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.profiles.is_blocked IS 'When true, backend rejects authenticated API calls for this user';



-- === FILE: 20260320000000_user_goals.sql ===


-- Store user goals selected during onboarding (after compliance acknowledgment)
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS onboarding_goals TEXT[] DEFAULT '{}';

COMMENT ON COLUMN public.profiles.onboarding_goals IS 'Goals selected by user during signup (e.g. premium look, conversions, reduce costs)';



-- === FILE: 20260320000001_products_table.sql ===


-- Products table for virtual try-on catalog
CREATE TABLE IF NOT EXISTS public.products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  image_url TEXT,
  category TEXT NOT NULL CHECK (category IN ('clothing', 'bags', 'glasses')),
  product_url TEXT,
  tryons_count integer NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_products_user_id ON public.products(user_id);
CREATE INDEX IF NOT EXISTS idx_products_category ON public.products(category);
CREATE INDEX IF NOT EXISTS idx_products_created_at ON public.products(created_at DESC);

ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own products" ON public.products FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own products" ON public.products FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own products" ON public.products FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own products" ON public.products FOR DELETE TO authenticated USING (auth.uid() = user_id);



-- === FILE: 20260320120000_early_access_requests.sql ===


-- Early access / waitlist applications (public insert only)
CREATE TABLE IF NOT EXISTS public.early_access_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  first_name text NOT NULL,
  email text NOT NULL,
  brand_name text NOT NULL,
  role text NOT NULL,
  website_url text NOT NULL,
  platform text NOT NULL,
  product_range text NOT NULL,
  monthly_revenue text NOT NULL,
  return_rate text NOT NULL,
  top_return_reason text NOT NULL,
  customer_confidence text NOT NULL,
  tried_solutions jsonb NOT NULL DEFAULT '[]'::jsonb,
  must_have_features jsonb NOT NULL DEFAULT '[]'::jsonb,
  biggest_challenge text NOT NULL,
  timeline text NOT NULL,
  heard_about text,
  prior_solution_notes text
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



-- === FILE: 20260321120000_tryverse_model_library.sql ===


-- Shared try-on model library (studio, widget, admin).
-- Portrait images: Unsplash License (https://unsplash.com/license) â€” replace with your own assets in production if needed.

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

CREATE POLICY "Anyone can read active tryverse models"
  ON public.tryverse_model_library FOR SELECT
  USING (is_active = true);

COMMENT ON TABLE public.tryverse_model_library IS 'Preset person images for virtual try-on (widget + studio). Managed via SQL/admin; image_url must be HTTPS.';

-- Zoe + Marcus portraits unchanged; all other slots use different Unsplash portraits (600Ã—800 crop). Replace URLs in DB anytime via admin/SQL.
INSERT INTO public.tryverse_model_library (slug, display_name, gender, body_type, appearance_tag, image_url, sort_order)
VALUES
  ('zoe', 'Zoe', 'female', 'Regular', 'Black / African descent', 'https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?w=600&h=800&fit=crop&q=80', 10),
  ('aisha', 'Aisha', 'female', 'Regular', 'Middle Eastern / North African', 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=600&h=800&fit=crop&q=80', 20),
  ('lin', 'Lin', 'female', 'Petite', 'East Asian', 'https://images.unsplash.com/photo-1515886657613-9f3515b0db78?w=600&h=800&fit=crop&q=80', 30),
  ('sophie', 'Sophie', 'female', 'Slim', 'White / European', 'https://images.unsplash.com/photo-1488426862026-3ee34a7d66df?w=600&h=800&fit=crop&q=80', 40),
  ('camila', 'Camila', 'female', 'Athletic', 'Latine / Hispanic', 'https://images.unsplash.com/photo-1508214751196-bcfd4ca60f91?w=600&h=800&fit=crop&q=80', 50),
  ('priya', 'Priya', 'female', 'Curvy', 'South Asian', 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=600&h=800&fit=crop&q=80', 60),
  ('marcus', 'Marcus', 'male', 'Athletic', 'Black / African descent', 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=600&h=800&fit=crop&q=80', 110),
  ('daniel', 'Daniel', 'male', 'Slim', 'East Asian', 'https://images.unsplash.com/photo-1566492031773-4f4e44671857?w=600&h=800&fit=crop&q=80', 120),
  ('james', 'James', 'male', 'Regular', 'White / European', 'https://images.unsplash.com/photo-1519345182560-3f2917c472ef?w=600&h=800&fit=crop&q=80', 130),
  ('diego', 'Diego', 'male', 'Broad', 'Latine / Hispanic', 'https://images.unsplash.com/photo-1504257432389-52343af14bab?w=600&h=800&fit=crop&q=80', 140),
  ('amir', 'Amir', 'male', 'Tall', 'Middle Eastern / North African', 'https://images.unsplash.com/photo-1568602471122-783295085e68?w=600&h=800&fit=crop&q=80', 150),
  ('vikram', 'Vikram', 'male', 'Regular', 'South Asian', 'https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?w=600&h=800&fit=crop&q=80', 160)
ON CONFLICT (slug) DO NOTHING;



-- === FILE: 20260321120200_model_library_portrait_updates.sql ===


-- Sync image_url for existing rows (INSERT ON CONFLICT does not update).
-- Zoe + Marcus unchanged; everyone else gets the current catalog URLs from seed.

UPDATE public.tryverse_model_library SET image_url = 'https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?w=600&h=800&fit=crop&q=80' WHERE slug = 'zoe';
UPDATE public.tryverse_model_library SET image_url = 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=600&h=800&fit=crop&q=80' WHERE slug = 'aisha';
UPDATE public.tryverse_model_library SET image_url = 'https://images.unsplash.com/photo-1515886657613-9f3515b0db78?w=600&h=800&fit=crop&q=80' WHERE slug = 'lin';
UPDATE public.tryverse_model_library SET image_url = 'https://images.unsplash.com/photo-1488426862026-3ee34a7d66df?w=600&h=800&fit=crop&q=80' WHERE slug = 'sophie';
UPDATE public.tryverse_model_library SET image_url = 'https://images.unsplash.com/photo-1508214751196-bcfd4ca60f91?w=600&h=800&fit=crop&q=80' WHERE slug = 'camila';
UPDATE public.tryverse_model_library SET image_url = 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=600&h=800&fit=crop&q=80' WHERE slug = 'priya';

UPDATE public.tryverse_model_library SET image_url = 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=600&h=800&fit=crop&q=80' WHERE slug = 'marcus';
UPDATE public.tryverse_model_library SET image_url = 'https://images.unsplash.com/photo-1566492031773-4f4e44671857?w=600&h=800&fit=crop&q=80' WHERE slug = 'daniel';
UPDATE public.tryverse_model_library SET image_url = 'https://images.unsplash.com/photo-1519345182560-3f2917c472ef?w=600&h=800&fit=crop&q=80' WHERE slug = 'james';
UPDATE public.tryverse_model_library SET image_url = 'https://images.unsplash.com/photo-1504257432389-52343af14bab?w=600&h=800&fit=crop&q=80' WHERE slug = 'diego';
UPDATE public.tryverse_model_library SET image_url = 'https://images.unsplash.com/photo-1568602471122-783295085e68?w=600&h=800&fit=crop&q=80' WHERE slug = 'amir';
UPDATE public.tryverse_model_library SET image_url = 'https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?w=600&h=800&fit=crop&q=80' WHERE slug = 'vikram';



-- === FILE: 20260321120500_model_library_new_set_keep_zoe_marcus.sql ===


-- New model photos: keep Zoe + Marcus URLs; replace the other 10 with a different Unsplash set.
-- Runs even if 20260321120200 already applied (new filename = new migration).

UPDATE public.tryverse_model_library SET image_url = 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=600&h=800&fit=crop&q=80' WHERE slug = 'aisha';
UPDATE public.tryverse_model_library SET image_url = 'https://images.unsplash.com/photo-1515886657613-9f3515b0db78?w=600&h=800&fit=crop&q=80' WHERE slug = 'lin';
UPDATE public.tryverse_model_library SET image_url = 'https://images.unsplash.com/photo-1488426862026-3ee34a7d66df?w=600&h=800&fit=crop&q=80' WHERE slug = 'sophie';
UPDATE public.tryverse_model_library SET image_url = 'https://images.unsplash.com/photo-1508214751196-bcfd4ca60f91?w=600&h=800&fit=crop&q=80' WHERE slug = 'camila';
UPDATE public.tryverse_model_library SET image_url = 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=600&h=800&fit=crop&q=80' WHERE slug = 'priya';

UPDATE public.tryverse_model_library SET image_url = 'https://images.unsplash.com/photo-1566492031773-4f4e44671857?w=600&h=800&fit=crop&q=80' WHERE slug = 'daniel';
UPDATE public.tryverse_model_library SET image_url = 'https://images.unsplash.com/photo-1519345182560-3f2917c472ef?w=600&h=800&fit=crop&q=80' WHERE slug = 'james';
UPDATE public.tryverse_model_library SET image_url = 'https://images.unsplash.com/photo-1504257432389-52343af14bab?w=600&h=800&fit=crop&q=80' WHERE slug = 'diego';
UPDATE public.tryverse_model_library SET image_url = 'https://images.unsplash.com/photo-1568602471122-783295085e68?w=600&h=800&fit=crop&q=80' WHERE slug = 'amir';
UPDATE public.tryverse_model_library SET image_url = 'https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?w=600&h=800&fit=crop&q=80' WHERE slug = 'vikram';



-- === FILE: 20260323180000_model_library_custom_female_portraits.sql ===


-- Custom female portraits under public/model-library/ (paths match filenames).
-- Backend resolves /model-library/... using FRONTEND_URL (see modelLibrary.ts).

DELETE FROM public.tryverse_model_library
WHERE slug = 'aisha'
  AND EXISTS (SELECT 1 FROM public.tryverse_model_library AS n WHERE n.slug = 'lina');

DELETE FROM public.tryverse_model_library
WHERE slug = 'lin'
  AND EXISTS (SELECT 1 FROM public.tryverse_model_library AS n WHERE n.slug = 'min-ji');

DELETE FROM public.tryverse_model_library
WHERE slug = 'sophie'
  AND EXISTS (SELECT 1 FROM public.tryverse_model_library AS n WHERE n.slug = 'sophia');

UPDATE public.tryverse_model_library
SET slug = 'lina', display_name = 'Lina', image_url = '/model-library/lina.png', body_type = NULL, appearance_tag = NULL
WHERE slug = 'aisha';

UPDATE public.tryverse_model_library
SET slug = 'min-ji', display_name = 'Min-Ji', image_url = '/model-library/min-ji.png', body_type = NULL, appearance_tag = NULL
WHERE slug = 'lin';

UPDATE public.tryverse_model_library
SET slug = 'sophia', display_name = 'Sophia', image_url = '/model-library/sophia.png', body_type = NULL, appearance_tag = NULL
WHERE slug = 'sophie';

UPDATE public.tryverse_model_library
SET display_name = 'Zoe', image_url = '/model-library/zoe.png', body_type = NULL, appearance_tag = NULL
WHERE slug = 'zoe';

UPDATE public.tryverse_model_library
SET display_name = 'Camila', image_url = '/model-library/camila.png', body_type = NULL, appearance_tag = NULL
WHERE slug = 'camila';

UPDATE public.tryverse_model_library
SET display_name = 'Priya', image_url = '/model-library/priya.png', body_type = NULL, appearance_tag = NULL
WHERE slug = 'priya';

COMMENT ON TABLE public.tryverse_model_library IS 'Preset person images for virtual try-on. image_url may be HTTPS or a path starting with / (resolved with FRONTEND_URL on the API).';



-- === FILE: 20260323190000_model_library_display_names_only.sql ===


-- Female models: slugs match files under public/model-library/; UI shows names only (no body/appearance text).
-- Clears body_type & appearance_tag for all library rows (including male).

DELETE FROM public.tryverse_model_library
WHERE slug = 'aisha'
  AND EXISTS (SELECT 1 FROM public.tryverse_model_library AS n WHERE n.slug = 'lina');

DELETE FROM public.tryverse_model_library
WHERE slug = 'lin'
  AND EXISTS (SELECT 1 FROM public.tryverse_model_library AS n WHERE n.slug = 'min-ji');

DELETE FROM public.tryverse_model_library
WHERE slug = 'sophie'
  AND EXISTS (SELECT 1 FROM public.tryverse_model_library AS n WHERE n.slug = 'sophia');

UPDATE public.tryverse_model_library
SET slug = 'lina', display_name = 'Lina', image_url = '/model-library/lina.png', body_type = NULL, appearance_tag = NULL
WHERE slug = 'aisha';

UPDATE public.tryverse_model_library
SET slug = 'min-ji', display_name = 'Min-Ji', image_url = '/model-library/min-ji.png', body_type = NULL, appearance_tag = NULL
WHERE slug = 'lin';

UPDATE public.tryverse_model_library
SET slug = 'sophia', display_name = 'Sophia', image_url = '/model-library/sophia.png', body_type = NULL, appearance_tag = NULL
WHERE slug = 'sophie';

UPDATE public.tryverse_model_library
SET display_name = 'Zoe', image_url = '/model-library/zoe.png', body_type = NULL, appearance_tag = NULL
WHERE slug = 'zoe';

UPDATE public.tryverse_model_library
SET display_name = 'Lina', image_url = '/model-library/lina.png', body_type = NULL, appearance_tag = NULL
WHERE slug = 'lina';

UPDATE public.tryverse_model_library
SET display_name = 'Min-Ji', image_url = '/model-library/min-ji.png', body_type = NULL, appearance_tag = NULL
WHERE slug = 'min-ji';

UPDATE public.tryverse_model_library
SET display_name = 'Sophia', image_url = '/model-library/sophia.png', body_type = NULL, appearance_tag = NULL
WHERE slug = 'sophia';

UPDATE public.tryverse_model_library
SET display_name = 'Camila', image_url = '/model-library/camila.png', body_type = NULL, appearance_tag = NULL
WHERE slug = 'camila';

UPDATE public.tryverse_model_library
SET display_name = 'Priya', image_url = '/model-library/priya.png', body_type = NULL, appearance_tag = NULL
WHERE slug = 'priya';

UPDATE public.tryverse_model_library
SET body_type = NULL, appearance_tag = NULL;



-- === FILE: 20260323210000_model_library_custom_male_portraits.sql ===


-- Custom male portraits: public/model-library/{slug}.png
-- Replaces former rows marcus, daniel, james, diego, amir, vikram with Andrew, Jack, Jordan, Steve, Vandik, Lucas.

DELETE FROM public.tryverse_model_library
WHERE slug = 'marcus'
  AND EXISTS (SELECT 1 FROM public.tryverse_model_library AS n WHERE n.slug = 'andrew');

DELETE FROM public.tryverse_model_library
WHERE slug = 'daniel'
  AND EXISTS (SELECT 1 FROM public.tryverse_model_library AS n WHERE n.slug = 'jack');

DELETE FROM public.tryverse_model_library
WHERE slug = 'james'
  AND EXISTS (SELECT 1 FROM public.tryverse_model_library AS n WHERE n.slug = 'jordan');

DELETE FROM public.tryverse_model_library
WHERE slug = 'diego'
  AND EXISTS (SELECT 1 FROM public.tryverse_model_library AS n WHERE n.slug = 'steve');

DELETE FROM public.tryverse_model_library
WHERE slug = 'amir'
  AND EXISTS (SELECT 1 FROM public.tryverse_model_library AS n WHERE n.slug = 'vandik');

DELETE FROM public.tryverse_model_library
WHERE slug = 'vikram'
  AND EXISTS (SELECT 1 FROM public.tryverse_model_library AS n WHERE n.slug = 'lucas');

UPDATE public.tryverse_model_library
SET slug = 'andrew', display_name = 'Andrew', image_url = '/model-library/andrew.png', body_type = NULL, appearance_tag = NULL
WHERE slug = 'marcus';

UPDATE public.tryverse_model_library
SET slug = 'jack', display_name = 'Jack', image_url = '/model-library/jack.png', body_type = NULL, appearance_tag = NULL
WHERE slug = 'daniel';

UPDATE public.tryverse_model_library
SET slug = 'jordan', display_name = 'Jordan', image_url = '/model-library/jordan.png', body_type = NULL, appearance_tag = NULL
WHERE slug = 'james';

UPDATE public.tryverse_model_library
SET slug = 'steve', display_name = 'Steve', image_url = '/model-library/steve.png', body_type = NULL, appearance_tag = NULL
WHERE slug = 'diego';

UPDATE public.tryverse_model_library
SET slug = 'vandik', display_name = 'Vandik', image_url = '/model-library/vandik.png', body_type = NULL, appearance_tag = NULL
WHERE slug = 'amir';

UPDATE public.tryverse_model_library
SET slug = 'lucas', display_name = 'Lucas', image_url = '/model-library/lucas.png', body_type = NULL, appearance_tag = NULL
WHERE slug = 'vikram';

UPDATE public.tryverse_model_library
SET display_name = 'Andrew', image_url = '/model-library/andrew.png', body_type = NULL, appearance_tag = NULL
WHERE slug = 'andrew';

UPDATE public.tryverse_model_library
SET display_name = 'Jack', image_url = '/model-library/jack.png', body_type = NULL, appearance_tag = NULL
WHERE slug = 'jack';

UPDATE public.tryverse_model_library
SET display_name = 'Jordan', image_url = '/model-library/jordan.png', body_type = NULL, appearance_tag = NULL
WHERE slug = 'jordan';

UPDATE public.tryverse_model_library
SET display_name = 'Steve', image_url = '/model-library/steve.png', body_type = NULL, appearance_tag = NULL
WHERE slug = 'steve';

UPDATE public.tryverse_model_library
SET display_name = 'Vandik', image_url = '/model-library/vandik.png', body_type = NULL, appearance_tag = NULL
WHERE slug = 'vandik';

UPDATE public.tryverse_model_library
SET display_name = 'Lucas', image_url = '/model-library/lucas.png', body_type = NULL, appearance_tag = NULL
WHERE slug = 'lucas';



-- === FILE: 20260326120000_model_library_full_body_reference.sql ===


-- Full-length / three-quarter standing reference photos for try-on (better clothing fit than tight face crops).
-- Unsplash License: https://unsplash.com/license â€” replace with owned assets in production if preferred.
-- CDN params: tall portrait crop so thumbnails and the try-on pipeline see torso + legs.

UPDATE public.tryverse_model_library
SET image_url = 'https://images.unsplash.com/photo-1578662996442-48f60103fc96?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&h=1350&q=85'
WHERE slug = 'zoe';

UPDATE public.tryverse_model_library
SET image_url = 'https://images.unsplash.com/photo-1529626455594-4ff0802cfb7e?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&h=1350&q=85'
WHERE slug = 'lina';

UPDATE public.tryverse_model_library
SET image_url = 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&h=1350&q=85'
WHERE slug = 'min-ji';

UPDATE public.tryverse_model_library
SET image_url = 'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&h=1350&q=85'
WHERE slug = 'sophia';

UPDATE public.tryverse_model_library
SET image_url = 'https://images.unsplash.com/photo-1508214751196-bcfd4ca60f91?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&h=1350&q=85'
WHERE slug = 'camila';

UPDATE public.tryverse_model_library
SET image_url = 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&h=1350&q=85'
WHERE slug = 'priya';

UPDATE public.tryverse_model_library
SET image_url = 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&h=1350&q=85'
WHERE slug = 'andrew';

UPDATE public.tryverse_model_library
SET image_url = 'https://images.unsplash.com/photo-1566492031773-4f4e44671857?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&h=1350&q=85'
WHERE slug = 'jack';

UPDATE public.tryverse_model_library
SET image_url = 'https://images.unsplash.com/photo-1519345182560-3f2917c472ef?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&h=1350&q=85'
WHERE slug = 'jordan';

UPDATE public.tryverse_model_library
SET image_url = 'https://images.unsplash.com/photo-1520975916090-3105956dac38?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&h=1350&q=85'
WHERE slug = 'steve';

UPDATE public.tryverse_model_library
SET image_url = 'https://images.unsplash.com/photo-1492562080023-ab3db95bfbce?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&h=1350&q=85'
WHERE slug = 'vandik';

UPDATE public.tryverse_model_library
SET image_url = 'https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&h=1350&q=85'
WHERE slug = 'lucas';



-- === FILE: 20260326160000_model_library_revert_paths.sql ===


-- Revert model library to frontend-hosted paths (see public/model-library/).
UPDATE public.tryverse_model_library SET image_url = '/model-library/zoe.png' WHERE slug = 'zoe';
UPDATE public.tryverse_model_library SET image_url = '/model-library/lina.png' WHERE slug = 'lina';
UPDATE public.tryverse_model_library SET image_url = '/model-library/min-ji.png' WHERE slug = 'min-ji';
UPDATE public.tryverse_model_library SET image_url = '/model-library/sophia.png' WHERE slug = 'sophia';
UPDATE public.tryverse_model_library SET image_url = '/model-library/camila.png' WHERE slug = 'camila';
UPDATE public.tryverse_model_library SET image_url = '/model-library/priya.png' WHERE slug = 'priya';
UPDATE public.tryverse_model_library SET image_url = '/model-library/andrew.png' WHERE slug = 'andrew';
UPDATE public.tryverse_model_library SET image_url = '/model-library/jack.png' WHERE slug = 'jack';
UPDATE public.tryverse_model_library SET image_url = '/model-library/jordan.png' WHERE slug = 'jordan';
UPDATE public.tryverse_model_library SET image_url = '/model-library/steve.png' WHERE slug = 'steve';
UPDATE public.tryverse_model_library SET image_url = '/model-library/vandik.png' WHERE slug = 'vandik';
UPDATE public.tryverse_model_library SET image_url = '/model-library/lucas.png' WHERE slug = 'lucas';



-- === FILE: 20260326200000_model_library_priya_to_rashna.sql ===


-- Rename Priya â†’ Rashna and point to /model-library/rashna.png (new full-body assets).

UPDATE public.tryverse_model_library
SET
  slug = 'rashna',
  display_name = 'Rashna',
  image_url = '/model-library/rashna.png',
  body_type = NULL,
  appearance_tag = NULL
WHERE slug = 'priya';



-- === FILE: 20260328120000_hybrid_plans_and_signup_credits.sql ===


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
   '["50â€“100 try-ons / month (quota)","HD images","No watermark","Download images"]'::jsonb),
  ('creator', 'Creator', 15000, 15, 250, 0,
   '["200â€“300 try-ons / month (quota)","HD + stronger realism","Generate marketing images","Priority processing"]'::jsonb)
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
  features = '["100â€“200 try-ons / month (quota)","50â€“100 products","Basic fit prediction","Download images"]'::jsonb
WHERE id = 'starter';

UPDATE public.plans SET
  name = 'Growth',
  price_ngn = 200000,
  price_usd = 140,
  tryons_per_month = 750,
  max_products = 750,
  features = '["500â€“1000 try-ons / month (quota)","100â€“500 products","Analytics","API / widget","Marketing content"]'::jsonb
WHERE id = 'growth';

UPDATE public.plans SET
  name = 'Enterprise',
  features = '["AI video generation","Custom models","SLA","Dedicated infrastructure","Custom pricing â€” contact sales"]'::jsonb
WHERE id = 'enterprise';

-- Free row: marketing copy; actual pool size is set per account_type on the profile.
UPDATE public.plans SET
  tryons_per_month = 5,
  features = '["Free try-on pool (individuals: 5 Â· brands: 20 on signup)","Watermark on free tier","Basic quality","Upgrade anytime"]'::jsonb
WHERE id = 'free';



-- === FILE: 20260328120000_model_library_max_li_xeng.sql ===


-- Add male presets Max and Li Xeng (full-body studio refs in public/model-library/).

INSERT INTO public.tryverse_model_library (slug, display_name, gender, body_type, appearance_tag, image_url, sort_order)
VALUES
  ('max', 'Max', 'male', 'Plus-size', 'Middle Eastern / South Asian', '/model-library/max.png', 165),
  ('li-xeng', 'Li Xeng', 'male', 'Athletic', 'East Asian', '/model-library/li-xeng.png', 170)
ON CONFLICT (slug) DO NOTHING;



-- === FILE: 20260328130000_model_library_jed.sql ===


-- Add male preset Jed (full-body studio ref in public/model-library/).

INSERT INTO public.tryverse_model_library (slug, display_name, gender, body_type, appearance_tag, image_url, sort_order)
VALUES
  ('jed', 'Jed', 'male', 'Slim', 'White / European', '/model-library/jed.png', 175)
ON CONFLICT (slug) DO NOTHING;



-- === FILE: 20260328140000_model_library_alex_alfred_derrick.sql ===


-- Add male child presets Alex, Alfred, Derrick (full-body studio refs in public/model-library/).

INSERT INTO public.tryverse_model_library (slug, display_name, gender, body_type, appearance_tag, image_url, sort_order)
VALUES
  ('alex', 'Alex', 'male', 'Child', 'White / European', '/model-library/alex.png', 180),
  ('alfred', 'Alfred', 'male', 'Child', 'Latine / Hispanic', '/model-library/alfred.png', 185),
  ('derrick', 'Derrick', 'male', 'Child', 'White / European', '/model-library/derrick.png', 190)
ON CONFLICT (slug) DO NOTHING;



-- === FILE: 20260329100000_pricing_ngn_usd_strategy.sql ===


-- Hybrid pricing: align NGN/USD amounts with product strategy (checkout uses these columns).

UPDATE public.plans SET
  price_ngn = 15000,
  price_usd = 10,
  tryons_per_month = 75,
  max_products = 0,
  features = '["50â€“100 try-ons / month","HD images","No watermark","Download images"]'::jsonb
WHERE id = 'pro';

UPDATE public.plans SET
  price_ngn = 30000,
  price_usd = 20,
  tryons_per_month = 250,
  max_products = 0,
  features = '["200â€“300 try-ons / month","HD + better realism","Generate marketing images","Priority processing"]'::jsonb
WHERE id = 'creator';

UPDATE public.plans SET
  price_ngn = 80000,
  price_usd = 60,
  tryons_per_month = 150,
  max_products = 100,
  features = '["100â€“200 try-ons / month","50â€“100 products","Basic fit prediction","Download images"]'::jsonb
WHERE id = 'starter';

UPDATE public.plans SET
  price_ngn = 180000,
  price_usd = 150,
  tryons_per_month = 750,
  max_products = 750,
  features = '["500â€“1000 try-ons / month","100â€“500 products","Analytics","API / widget","Marketing content"]'::jsonb
WHERE id = 'growth';

UPDATE public.plans SET
  name = 'Enterprise',
  price_ngn = 0,
  price_usd = 0,
  features = '["AI video generation","Custom models","SLA","Dedicated infrastructure","Let''s talk â€” negotiated pricing"]'::jsonb
WHERE id = 'enterprise';

UPDATE public.plans SET
  tryons_per_month = 5,
  features = '["3â€“5 try-ons/month (individual free pool) Â· 20 on signup (brands)","Watermark","Basic quality"]'::jsonb
WHERE id = 'free';



-- === FILE: 20260330120000_model_library_female_stephanie_diane.sql ===


-- Add female presets Stephanie, Asher, Hanna, Mia, Louis, Aiko, Nicole, Diane (studio refs in public/model-library/).

INSERT INTO public.tryverse_model_library (slug, display_name, gender, body_type, appearance_tag, image_url, sort_order)
VALUES
  ('stephanie', 'Stephanie', 'female', 'Child', 'Black / African descent', '/model-library/stephanie.png', 65),
  ('asher', 'Asher', 'female', 'Child', 'East Asian', '/model-library/asher.png', 70),
  ('hanna', 'Hanna', 'female', 'Child', 'Black / African descent', '/model-library/hanna.png', 75),
  ('mia', 'Mia', 'female', 'Slim', 'East Asian', '/model-library/mia.png', 80),
  ('louis', 'Louis', 'female', 'Child', 'White / European', '/model-library/louis.png', 85),
  ('aiko', 'Aiko', 'female', 'Regular', 'East Asian', '/model-library/aiko.png', 90),
  ('nicole', 'Nicole', 'female', 'Slim', 'Latine / Hispanic', '/model-library/nicole.png', 95),
  ('diane', 'Diane', 'female', 'Curvy', 'White / European', '/model-library/diane.png', 100)
ON CONFLICT (slug) DO NOTHING;



-- === FILE: 20260330140000_profiles_account_type.sql ===


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



-- === FILE: 20260330180000_early_access_applicant_type.sql ===


-- Distinguish business vs individual waitlist submissions.
ALTER TABLE public.early_access_requests
  ADD COLUMN IF NOT EXISTS applicant_type TEXT NOT NULL DEFAULT 'business';

ALTER TABLE public.early_access_requests
  DROP CONSTRAINT IF EXISTS early_access_requests_applicant_type_check;

ALTER TABLE public.early_access_requests
  ADD CONSTRAINT early_access_requests_applicant_type_check
  CHECK (applicant_type IN ('business', 'individual'));

COMMENT ON COLUMN public.early_access_requests.applicant_type IS 'business = full merchant form; individual = personal interest form';



-- === FILE: 20260330190000_default_free_credits_20.sql ===


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



-- === FILE: 20260401130000_migrate_legacy_free_credits_three_to_twenty.sql ===


-- Legacy free tier used free_credits_total = 3. Align existing rows with the 20-try pool.
-- Remaining balance is increased by 17 (capped at 20) so usage is preserved.
UPDATE public.profiles
SET
  free_credits_total = 20,
  free_credits_remaining = LEAST(20, free_credits_remaining + 17),
  updated_at = NOW()
WHERE COALESCE(plan_id, 'free') = 'free'
  AND free_credits_total = 3;



-- === FILE: 20260403120000_free_tier_copy_widgets.sql ===


-- Pricing copy: individual free pool messaging (5), brand free (20), widget embed on Growth/Enterprise.

UPDATE public.plans SET
  name = 'Free',
  tryons_per_month = 5,
  features = '["5 try-ons/month on free pool (individual) Â· 20 on signup (brands)","Watermark","Basic quality"]'::jsonb
WHERE id = 'free';

UPDATE public.plans SET
  tryons_per_month = 5,
  features = '["5 try-ons/month on free pool (individual) Â· 20 on signup (brands)","Watermark","Basic quality"]'::jsonb
WHERE id IN ('free_trial', 'trial');

UPDATE public.plans SET
  features = '["500â€“1000 try-ons / month","100â€“500 products","Analytics","API / widget","Widget embed","Marketing content"]'::jsonb
WHERE id = 'growth';

UPDATE public.plans SET
  features = '["AI video generation","Custom models","SLA","Dedicated infrastructure","Widget embed","Let''s talk â€” negotiated pricing"]'::jsonb
WHERE id = 'enterprise';



-- === FILE: 20260405120000_growth_products_range_100_500.sql ===


-- Growth plan: product range copy 500â€“1000 â†’ 100â€“500 (marketing / features list only).

UPDATE public.plans SET
  features = '["500â€“1000 try-ons / month","100â€“500 products","Analytics","API / widget","Widget embed","Marketing content"]'::jsonb
WHERE id = 'growth';



-- === FILE: 20260406120000_model_library_free_tier_eligible.sql ===


-- Free tier: only presets with free_tier_eligible = true are usable when profiles.plan_id is free/trial.
-- Defaults: Diane + Andrew eligible; all rows stay visible (is_active true) unless you turn them off in admin.

ALTER TABLE public.tryverse_model_library
  ADD COLUMN IF NOT EXISTS free_tier_eligible boolean NOT NULL DEFAULT false;

UPDATE public.tryverse_model_library
SET
  is_active = true,
  free_tier_eligible = (lower(slug) IN ('diane', 'andrew'));

COMMENT ON COLUMN public.tryverse_model_library.free_tier_eligible IS
  'When true, users on the free plan may use this preset in Try-On Studio / widget; paid plans may use any is_active model.';



-- === FILE: 20260406130000_diane_sort_order_first.sql ===


-- List order is ascending by sort_order. Put Diane first, then Andrew (free-tier defaults).

UPDATE public.tryverse_model_library SET sort_order = -1000 WHERE lower(trim(slug)) = 'diane';
UPDATE public.tryverse_model_library SET sort_order = -999 WHERE lower(trim(slug)) = 'andrew';



-- === APPENDIX: tryverse_supabase_paste_pricing_and_signup.sql ===


-- =============================================================================
-- TryVerse â€” paste into Supabase SQL Editor (Dashboard â†’ SQL â†’ New query)
-- Safe to re-run: creates/updates plans, refresh handle_new_user, public read on plans.
-- For a full greenfield schema see: backend/database/schema.sql
-- =============================================================================

-- â”€â”€â”€ PLANS TABLE â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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
    '["5 try-ons/month on free pool (individual) Â· 20 on signup (brands)","Watermark","Basic quality"]'::jsonb,
    true
  ),
  (
    'pro',
    'Pro',
    15000,
    10,
    75,
    0,
    '["50â€“100 try-ons / month","HD images","No watermark","Download images"]'::jsonb,
    true
  ),
  (
    'creator',
    'Creator',
    30000,
    20,
    250,
    0,
    '["200â€“300 try-ons / month","HD + better realism","Generate marketing images","Priority processing"]'::jsonb,
    true
  ),
  (
    'starter',
    'Starter',
    80000,
    60,
    150,
    100,
    '["100â€“200 try-ons / month","50â€“100 products","Basic fit prediction","Download images"]'::jsonb,
    true
  ),
  (
    'growth',
    'Growth',
    180000,
    150,
    750,
    750,
    '["500â€“1000 try-ons / month","100â€“500 products","Analytics","API / widget","Widget embed","Marketing content"]'::jsonb,
    true
  ),
  (
    'enterprise',
    'Enterprise',
    0,
    0,
    -1,
    -1,
    '["AI video generation","Custom models","SLA","Dedicated infrastructure","Widget embed","Let''s talk â€” negotiated pricing"]'::jsonb,
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
  features = '["5 try-ons/month on free pool (individual) Â· 20 on signup (brands)","Watermark","Basic quality"]'::jsonb
WHERE id IN ('free_trial', 'trial');

ALTER TABLE public.plans ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Plans are publicly readable" ON public.plans;
CREATE POLICY "Plans are publicly readable" ON public.plans
  FOR SELECT TO public
  USING (true);

-- â”€â”€â”€ PROFILES: columns apps expect (skip errors if table differs) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

-- â”€â”€â”€ AUTH: new users get 5 free try-ons (individual) or 20 (business) â”€â”€â”€â”€â”€
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



-- === APPENDIX: docs/EARLY_ACCESS_SUPABASE.sql ===


-- Paste this in Supabase â†’ SQL Editor â†’ Run
-- Creates early access table + RLS.
--
-- The app saves submissions through your Node backend (service role), which also
-- sends a confirmation email via Resend. This SQL does NOT change Auth or signup
-- emails â€” those are separate (Supabase Auth â†’ SMTP / built-in mailer).
--
-- Optional anon INSERT policy below lets you test inserts from the Supabase SQL
-- editor; the production form uses POST /api/early-access only.

CREATE TABLE IF NOT EXISTS public.early_access_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  first_name text NOT NULL,
  email text NOT NULL,
  brand_name text NOT NULL,
  role text NOT NULL,
  website_url text NOT NULL,
  platform text NOT NULL,
  product_range text NOT NULL,
  monthly_revenue text NOT NULL,
  return_rate text NOT NULL,
  top_return_reason text NOT NULL,
  customer_confidence text NOT NULL,
  tried_solutions jsonb NOT NULL DEFAULT '[]'::jsonb,
  must_have_features jsonb NOT NULL DEFAULT '[]'::jsonb,
  biggest_challenge text NOT NULL,
  timeline text NOT NULL,
  heard_about text,
  prior_solution_notes text
);

CREATE INDEX IF NOT EXISTS early_access_requests_email_lower_idx
  ON public.early_access_requests (lower(email));

CREATE INDEX IF NOT EXISTS early_access_requests_created_at_idx
  ON public.early_access_requests (created_at DESC);

ALTER TABLE public.early_access_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can submit early access request" ON public.early_access_requests;

CREATE POLICY "Anyone can submit early access request"
  ON public.early_access_requests
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- Optional: block public reads (default â€” only service role / dashboard can SELECT)
-- No SELECT policy for anon = they cannot list othersâ€™ submissions.

