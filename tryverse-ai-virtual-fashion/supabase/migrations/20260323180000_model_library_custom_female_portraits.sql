-- Custom female portraits under public/model-library/ (paths match filenames).
-- Backend resolves /model-library/... using FRONTEND_URL (see modelLibrary.ts).

DELETE FROM public.tryverse_model_library
WHERE slug = 'aisha'
  AND EXISTS (SELECT 1 FROM public.tryverse_model_library AS n WHERE n.slug = 'lina');

DELETE FROM public.tryverse_model_library
WHERE slug = 'lin'
  AND EXISTS (SELECT 1 FROM public.tryverse_model_library AS n WHERE n.slug = 'min-ji');

DELETE FROM public.tryverse_model_library
WHERE slug = 'sophie'
  AND EXISTS (SELECT 1 FROM public.tryverse_model_library AS n WHERE n.slug = 'sophia');

UPDATE public.tryverse_model_library
SET slug = 'lina', display_name = 'Lina', image_url = '/model-library/lina.png', body_type = NULL, appearance_tag = NULL
WHERE slug = 'aisha';

UPDATE public.tryverse_model_library
SET slug = 'min-ji', display_name = 'Min-Ji', image_url = '/model-library/min-ji.png', body_type = NULL, appearance_tag = NULL
WHERE slug = 'lin';

UPDATE public.tryverse_model_library
SET slug = 'sophia', display_name = 'Sophia', image_url = '/model-library/sophia.png', body_type = NULL, appearance_tag = NULL
WHERE slug = 'sophie';

UPDATE public.tryverse_model_library
SET display_name = 'Zoe', image_url = '/model-library/zoe.png', body_type = NULL, appearance_tag = NULL
WHERE slug = 'zoe';

UPDATE public.tryverse_model_library
SET display_name = 'Camila', image_url = '/model-library/camila.png', body_type = NULL, appearance_tag = NULL
WHERE slug = 'camila';

UPDATE public.tryverse_model_library
SET display_name = 'Priya', image_url = '/model-library/priya.png', body_type = NULL, appearance_tag = NULL
WHERE slug = 'priya';

COMMENT ON TABLE public.tryverse_model_library IS 'Preset person images for virtual try-on. image_url may be HTTPS or a path starting with / (resolved with FRONTEND_URL on the API).';
