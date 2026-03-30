-- Run in Supabase after deploying alex.png, alfred.png, derrick.png under public/model-library/.

INSERT INTO public.tryverse_model_library (slug, display_name, gender, body_type, appearance_tag, image_url, sort_order)
VALUES
  ('alex', 'Alex', 'male', 'Child', 'White / European', '/model-library/alex.png', 180),
  ('alfred', 'Alfred', 'male', 'Child', 'Latine / Hispanic', '/model-library/alfred.png', 185),
  ('derrick', 'Derrick', 'male', 'Child', 'White / European', '/model-library/derrick.png', 190)
ON CONFLICT (slug) DO NOTHING;
