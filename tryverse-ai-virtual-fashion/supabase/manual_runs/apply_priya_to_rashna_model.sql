-- Paste in Supabase SQL Editor if the row is still slug `priya` (same as migration 20260326200000).

UPDATE public.tryverse_model_library
SET
  slug = 'rashna',
  display_name = 'Rashna',
  image_url = '/model-library/rashna.png',
  body_type = NULL,
  appearance_tag = NULL
WHERE slug = 'priya';
