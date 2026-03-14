
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
