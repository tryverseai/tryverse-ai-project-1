-- Admin block/unblock: enforced in API via is_blocked + Supabase auth ban when supported
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_blocked boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.profiles.is_blocked IS 'When true, backend rejects authenticated API calls for this user';
