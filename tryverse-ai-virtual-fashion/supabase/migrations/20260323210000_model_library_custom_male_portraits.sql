-- Custom male portraits: public/model-library/{slug}.png
-- Replaces former rows marcus, daniel, james, diego, amir, vikram with Andrew, Jack, Jordan, Steve, Vandik, Lucas.

DELETE FROM public.tryverse_model_library
WHERE slug = 'marcus'
  AND EXISTS (SELECT 1 FROM public.tryverse_model_library AS n WHERE n.slug = 'andrew');

DELETE FROM public.tryverse_model_library
WHERE slug = 'daniel'
  AND EXISTS (SELECT 1 FROM public.tryverse_model_library AS n WHERE n.slug = 'jack');

DELETE FROM public.tryverse_model_library
WHERE slug = 'james'
  AND EXISTS (SELECT 1 FROM public.tryverse_model_library AS n WHERE n.slug = 'jordan');

DELETE FROM public.tryverse_model_library
WHERE slug = 'diego'
  AND EXISTS (SELECT 1 FROM public.tryverse_model_library AS n WHERE n.slug = 'steve');

DELETE FROM public.tryverse_model_library
WHERE slug = 'amir'
  AND EXISTS (SELECT 1 FROM public.tryverse_model_library AS n WHERE n.slug = 'vandik');

DELETE FROM public.tryverse_model_library
WHERE slug = 'vikram'
  AND EXISTS (SELECT 1 FROM public.tryverse_model_library AS n WHERE n.slug = 'lucas');

UPDATE public.tryverse_model_library
SET slug = 'andrew', display_name = 'Andrew', image_url = '/model-library/andrew.png', body_type = NULL, appearance_tag = NULL
WHERE slug = 'marcus';

UPDATE public.tryverse_model_library
SET slug = 'jack', display_name = 'Jack', image_url = '/model-library/jack.png', body_type = NULL, appearance_tag = NULL
WHERE slug = 'daniel';

UPDATE public.tryverse_model_library
SET slug = 'jordan', display_name = 'Jordan', image_url = '/model-library/jordan.png', body_type = NULL, appearance_tag = NULL
WHERE slug = 'james';

UPDATE public.tryverse_model_library
SET slug = 'steve', display_name = 'Steve', image_url = '/model-library/steve.png', body_type = NULL, appearance_tag = NULL
WHERE slug = 'diego';

UPDATE public.tryverse_model_library
SET slug = 'vandik', display_name = 'Vandik', image_url = '/model-library/vandik.png', body_type = NULL, appearance_tag = NULL
WHERE slug = 'amir';

UPDATE public.tryverse_model_library
SET slug = 'lucas', display_name = 'Lucas', image_url = '/model-library/lucas.png', body_type = NULL, appearance_tag = NULL
WHERE slug = 'vikram';

UPDATE public.tryverse_model_library
SET display_name = 'Andrew', image_url = '/model-library/andrew.png', body_type = NULL, appearance_tag = NULL
WHERE slug = 'andrew';

UPDATE public.tryverse_model_library
SET display_name = 'Jack', image_url = '/model-library/jack.png', body_type = NULL, appearance_tag = NULL
WHERE slug = 'jack';

UPDATE public.tryverse_model_library
SET display_name = 'Jordan', image_url = '/model-library/jordan.png', body_type = NULL, appearance_tag = NULL
WHERE slug = 'jordan';

UPDATE public.tryverse_model_library
SET display_name = 'Steve', image_url = '/model-library/steve.png', body_type = NULL, appearance_tag = NULL
WHERE slug = 'steve';

UPDATE public.tryverse_model_library
SET display_name = 'Vandik', image_url = '/model-library/vandik.png', body_type = NULL, appearance_tag = NULL
WHERE slug = 'vandik';

UPDATE public.tryverse_model_library
SET display_name = 'Lucas', image_url = '/model-library/lucas.png', body_type = NULL, appearance_tag = NULL
WHERE slug = 'lucas';
