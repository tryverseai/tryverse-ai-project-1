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
