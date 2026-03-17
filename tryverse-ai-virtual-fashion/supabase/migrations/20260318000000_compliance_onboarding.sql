-- Track when user completes Terms, Privacy, and Data Processing acknowledgment
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS compliance_onboarding_completed_at TIMESTAMPTZ DEFAULT NULL;

COMMENT ON COLUMN public.profiles.compliance_onboarding_completed_at IS 'When user acknowledged Terms, Privacy, and Data Processing during signup';
