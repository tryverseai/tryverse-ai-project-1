-- Free tier: only presets with free_tier_eligible = true are usable when profiles.plan_id is free/trial.
-- Defaults: Diane + Andrew eligible; all rows stay visible (is_active true) unless you turn them off in admin.

ALTER TABLE public.tryverse_model_library
  ADD COLUMN IF NOT EXISTS free_tier_eligible boolean NOT NULL DEFAULT false;

UPDATE public.tryverse_model_library
SET
  is_active = true,
  free_tier_eligible = (lower(slug) IN ('diane', 'andrew'));

COMMENT ON COLUMN public.tryverse_model_library.free_tier_eligible IS
  'When true, users on the free plan may use this preset in Try-On Studio / widget; paid plans may use any is_active model.';
