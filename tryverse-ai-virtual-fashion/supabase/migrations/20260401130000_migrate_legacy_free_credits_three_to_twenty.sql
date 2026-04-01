-- Legacy free tier used free_credits_total = 3. Align existing rows with the 20-try pool.
-- Remaining balance is increased by 17 (capped at 20) so usage is preserved.
UPDATE public.profiles
SET
  free_credits_total = 20,
  free_credits_remaining = LEAST(20, free_credits_remaining + 17),
  updated_at = NOW()
WHERE COALESCE(plan_id, 'free') = 'free'
  AND free_credits_total = 3;
