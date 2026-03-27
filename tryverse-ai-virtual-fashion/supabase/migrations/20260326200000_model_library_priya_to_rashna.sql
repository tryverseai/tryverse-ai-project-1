-- Rename Priya → Rashna and point to /model-library/rashna.png (new full-body assets).

UPDATE public.tryverse_model_library
SET
  slug = 'rashna',
  display_name = 'Rashna',
  image_url = '/model-library/rashna.png',
  body_type = NULL,
  appearance_tag = NULL
WHERE slug = 'priya';
