-- Add new columns to support_requests for Contact Us form
ALTER TABLE public.support_requests
  ADD COLUMN IF NOT EXISTS first_name TEXT,
  ADD COLUMN IF NOT EXISTS last_name TEXT,
  ADD COLUMN IF NOT EXISTS company_name TEXT,
  ADD COLUMN IF NOT EXISTS phone_number TEXT;

-- Make name nullable since we now use first_name/last_name
ALTER TABLE public.support_requests ALTER COLUMN name DROP NOT NULL;
