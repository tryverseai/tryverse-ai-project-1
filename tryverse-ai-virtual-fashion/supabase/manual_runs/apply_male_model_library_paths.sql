-- Paste in Supabase SQL Editor: point male presets at /model-library/*.png (Andrew, Jack, Jordan, Steve, Vandik, Lucas).
-- Use after deploying new PNGs under public/model-library/ on your frontend host.

UPDATE public.tryverse_model_library SET image_url = '/model-library/andrew.png' WHERE slug = 'andrew';
UPDATE public.tryverse_model_library SET image_url = '/model-library/jack.png' WHERE slug = 'jack';
UPDATE public.tryverse_model_library SET image_url = '/model-library/jordan.png' WHERE slug = 'jordan';
UPDATE public.tryverse_model_library SET image_url = '/model-library/steve.png' WHERE slug = 'steve';
UPDATE public.tryverse_model_library SET image_url = '/model-library/vandik.png' WHERE slug = 'vandik';
UPDATE public.tryverse_model_library SET image_url = '/model-library/lucas.png' WHERE slug = 'lucas';
