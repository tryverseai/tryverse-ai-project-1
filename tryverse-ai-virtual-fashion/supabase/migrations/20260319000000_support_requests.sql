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
