-- Paste in Supabase SQL Editor: restore /model-library/*.png URLs (same as migration 20260326160000).

UPDATE public.tryverse_model_library SET image_url = '/model-library/zoe.png' WHERE slug = 'zoe';
UPDATE public.tryverse_model_library SET image_url = '/model-library/lina.png' WHERE slug = 'lina';
UPDATE public.tryverse_model_library SET image_url = '/model-library/min-ji.png' WHERE slug = 'min-ji';
UPDATE public.tryverse_model_library SET image_url = '/model-library/sophia.png' WHERE slug = 'sophia';
UPDATE public.tryverse_model_library SET image_url = '/model-library/camila.png' WHERE slug = 'camila';
UPDATE public.tryverse_model_library SET image_url = '/model-library/rashna.png' WHERE slug = 'rashna';
-- Legacy row before migration 20260326200000:
UPDATE public.tryverse_model_library SET image_url = '/model-library/priya.png' WHERE slug = 'priya';
UPDATE public.tryverse_model_library SET image_url = '/model-library/andrew.png' WHERE slug = 'andrew';
UPDATE public.tryverse_model_library SET image_url = '/model-library/jack.png' WHERE slug = 'jack';
UPDATE public.tryverse_model_library SET image_url = '/model-library/jordan.png' WHERE slug = 'jordan';
UPDATE public.tryverse_model_library SET image_url = '/model-library/steve.png' WHERE slug = 'steve';
UPDATE public.tryverse_model_library SET image_url = '/model-library/vandik.png' WHERE slug = 'vandik';
UPDATE public.tryverse_model_library SET image_url = '/model-library/lucas.png' WHERE slug = 'lucas';
