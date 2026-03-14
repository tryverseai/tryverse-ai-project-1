
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS free_credits_remaining integer NOT NULL DEFAULT 3,
ADD COLUMN IF NOT EXISTS free_credits_total integer NOT NULL DEFAULT 3,
ADD COLUMN IF NOT EXISTS full_name text DEFAULT '',
ADD COLUMN IF NOT EXISTS role text DEFAULT '',
ADD COLUMN IF NOT EXISTS widget_activated boolean NOT NULL DEFAULT false;
