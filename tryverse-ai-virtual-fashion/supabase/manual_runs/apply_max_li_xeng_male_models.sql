-- Run in Supabase after deploying max.png and li-xeng.png under public/model-library/.

INSERT INTO public.tryverse_model_library (slug, display_name, gender, body_type, appearance_tag, image_url, sort_order)
VALUES
  ('max', 'Max', 'male', 'Plus-size', 'Middle Eastern / South Asian', '/model-library/max.png', 165),
  ('li-xeng', 'Li Xeng', 'male', 'Athletic', 'East Asian', '/model-library/li-xeng.png', 170)
ON CONFLICT (slug) DO NOTHING;
