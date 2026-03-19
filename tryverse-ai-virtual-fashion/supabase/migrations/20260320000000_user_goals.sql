-- Store user goals selected during onboarding (after compliance acknowledgment)
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS onboarding_goals TEXT[] DEFAULT '{}';

COMMENT ON COLUMN public.profiles.onboarding_goals IS 'Goals selected by user during signup (e.g. premium look, conversions, reduce costs)';
