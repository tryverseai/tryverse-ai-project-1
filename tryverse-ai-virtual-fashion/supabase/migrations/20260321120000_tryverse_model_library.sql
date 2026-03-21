-- Shared try-on model library (studio, widget, admin).
-- Portrait images: Unsplash License (https://unsplash.com/license) — replace with your own assets in production if needed.

CREATE TABLE IF NOT EXISTS public.tryverse_model_library (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  gender TEXT NOT NULL CHECK (gender IN ('female', 'male')),
  body_type TEXT,
  appearance_tag TEXT,
  image_url TEXT NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tryverse_model_library_active_sort
  ON public.tryverse_model_library (is_active, sort_order);

ALTER TABLE public.tryverse_model_library ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read active tryverse models"
  ON public.tryverse_model_library FOR SELECT
  USING (is_active = true);

COMMENT ON TABLE public.tryverse_model_library IS 'Preset person images for virtual try-on (widget + studio). Managed via SQL/admin; image_url must be HTTPS.';

-- Zoe + Marcus portraits unchanged; all other slots use different Unsplash portraits (600×800 crop). Replace URLs in DB anytime via admin/SQL.
INSERT INTO public.tryverse_model_library (slug, display_name, gender, body_type, appearance_tag, image_url, sort_order)
VALUES
  ('zoe', 'Zoe', 'female', 'Regular', 'Black / African descent', 'https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?w=600&h=800&fit=crop&q=80', 10),
  ('aisha', 'Aisha', 'female', 'Regular', 'Middle Eastern / North African', 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=600&h=800&fit=crop&q=80', 20),
  ('lin', 'Lin', 'female', 'Petite', 'East Asian', 'https://images.unsplash.com/photo-1515886657613-9f3515b0db78?w=600&h=800&fit=crop&q=80', 30),
  ('sophie', 'Sophie', 'female', 'Slim', 'White / European', 'https://images.unsplash.com/photo-1488426862026-3ee34a7d66df?w=600&h=800&fit=crop&q=80', 40),
  ('camila', 'Camila', 'female', 'Athletic', 'Latine / Hispanic', 'https://images.unsplash.com/photo-1508214751196-bcfd4ca60f91?w=600&h=800&fit=crop&q=80', 50),
  ('priya', 'Priya', 'female', 'Curvy', 'South Asian', 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=600&h=800&fit=crop&q=80', 60),
  ('marcus', 'Marcus', 'male', 'Athletic', 'Black / African descent', 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=600&h=800&fit=crop&q=80', 110),
  ('daniel', 'Daniel', 'male', 'Slim', 'East Asian', 'https://images.unsplash.com/photo-1566492031773-4f4e44671857?w=600&h=800&fit=crop&q=80', 120),
  ('james', 'James', 'male', 'Regular', 'White / European', 'https://images.unsplash.com/photo-1519345182560-3f2917c472ef?w=600&h=800&fit=crop&q=80', 130),
  ('diego', 'Diego', 'male', 'Broad', 'Latine / Hispanic', 'https://images.unsplash.com/photo-1504257432389-52343af14bab?w=600&h=800&fit=crop&q=80', 140),
  ('amir', 'Amir', 'male', 'Tall', 'Middle Eastern / North African', 'https://images.unsplash.com/photo-1568602471122-783295085e68?w=600&h=800&fit=crop&q=80', 150),
  ('vikram', 'Vikram', 'male', 'Regular', 'South Asian', 'https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?w=600&h=800&fit=crop&q=80', 160)
ON CONFLICT (slug) DO NOTHING;
