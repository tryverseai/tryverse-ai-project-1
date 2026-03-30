-- Distinguish business vs individual waitlist submissions.
ALTER TABLE public.early_access_requests
  ADD COLUMN IF NOT EXISTS applicant_type TEXT NOT NULL DEFAULT 'business';

ALTER TABLE public.early_access_requests
  DROP CONSTRAINT IF EXISTS early_access_requests_applicant_type_check;

ALTER TABLE public.early_access_requests
  ADD CONSTRAINT early_access_requests_applicant_type_check
  CHECK (applicant_type IN ('business', 'individual'));

COMMENT ON COLUMN public.early_access_requests.applicant_type IS 'business = full merchant form; individual = personal interest form';
