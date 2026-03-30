-- Add female presets Stephanie, Asher, Hanna, Mia, Louis, Aiko, Nicole, Diane (studio refs in public/model-library/).

INSERT INTO public.tryverse_model_library (slug, display_name, gender, body_type, appearance_tag, image_url, sort_order)
VALUES
  ('stephanie', 'Stephanie', 'female', 'Child', 'Black / African descent', '/model-library/stephanie.png', 65),
  ('asher', 'Asher', 'female', 'Child', 'East Asian', '/model-library/asher.png', 70),
  ('hanna', 'Hanna', 'female', 'Child', 'Black / African descent', '/model-library/hanna.png', 75),
  ('mia', 'Mia', 'female', 'Slim', 'East Asian', '/model-library/mia.png', 80),
  ('louis', 'Louis', 'female', 'Child', 'White / European', '/model-library/louis.png', 85),
  ('aiko', 'Aiko', 'female', 'Regular', 'East Asian', '/model-library/aiko.png', 90),
  ('nicole', 'Nicole', 'female', 'Slim', 'Latine / Hispanic', '/model-library/nicole.png', 95),
  ('diane', 'Diane', 'female', 'Curvy', 'White / European', '/model-library/diane.png', 100)
ON CONFLICT (slug) DO NOTHING;
