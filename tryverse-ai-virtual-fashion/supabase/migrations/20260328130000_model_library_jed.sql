-- Add male preset Jed (full-body studio ref in public/model-library/).

INSERT INTO public.tryverse_model_library (slug, display_name, gender, body_type, appearance_tag, image_url, sort_order)
VALUES
  ('jed', 'Jed', 'male', 'Slim', 'White / European', '/model-library/jed.png', 175)
ON CONFLICT (slug) DO NOTHING;
