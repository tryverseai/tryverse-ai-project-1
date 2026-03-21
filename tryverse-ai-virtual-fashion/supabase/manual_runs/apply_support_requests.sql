-- =============================================================================
-- support_requests — run once in Supabase Dashboard → SQL → New query → Run
-- After this, the table appears under Table Editor → public → support_requests
-- =============================================================================

-- Base table (matches migrations 20260319000000 + 20260319000001)
CREATE TABLE IF NOT EXISTS public.support_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT,
  email TEXT NOT NULL,
  category TEXT NOT NULL,
  subject TEXT NOT NULL,
  message TEXT NOT NULL,
  status TEXT DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'resolved')),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Extended Contact Us columns (safe if already applied)
ALTER TABLE public.support_requests
  ADD COLUMN IF NOT EXISTS first_name TEXT,
  ADD COLUMN IF NOT EXISTS last_name TEXT,
  ADD COLUMN IF NOT EXISTS company_name TEXT,
  ADD COLUMN IF NOT EXISTS phone_number TEXT;

-- Allow full name to be derived from first/last (backend sets name)
ALTER TABLE public.support_requests ALTER COLUMN name DROP NOT NULL;

-- RLS
ALTER TABLE public.support_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can submit support requests" ON public.support_requests;
CREATE POLICY "Anyone can submit support requests" ON public.support_requests
  FOR INSERT TO anon, authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated users can read support requests" ON public.support_requests;
CREATE POLICY "Authenticated users can read support requests" ON public.support_requests
  FOR SELECT TO authenticated
  USING (true);

-- Optional: let logged-in admins browse rows in Table Editor / API (same as migration intent)
-- Service role (backend) bypasses RLS and can always insert.

COMMENT ON TABLE public.support_requests IS 'Contact Us / support form submissions; backend inserts via service role.';
