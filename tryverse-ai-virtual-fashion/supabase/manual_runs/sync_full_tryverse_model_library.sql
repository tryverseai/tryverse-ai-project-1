-- Full model library: table + RLS policy (if missing) + all male/female rows.
-- Safe to re-run: no duplicate policy; rows upsert by slug.
-- Deploy public/model-library/*.png and set API FRONTEND_URL so /model-library/... resolves.

-- ─── 1. Table & index (idempotent) ───────────────────────────────────────────
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

-- ─── 2. Read policy only if it does not exist (avoids 42710) ─────────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'tryverse_model_library'
      AND policyname = 'Anyone can read active tryverse models'
  ) THEN
    CREATE POLICY "Anyone can read active tryverse models"
      ON public.tryverse_model_library FOR SELECT
      USING (is_active = true);
  END IF;
END $$;

COMMENT ON TABLE public.tryverse_model_library IS
  'Preset person images for virtual try-on. image_url may be HTTPS or /model-library/... (resolved with FRONTEND_URL on the API).';

-- ─── 3. Seed / sync all models (upsert) ─────────────────────────────────────
INSERT INTO public.tryverse_model_library
  (slug, display_name, gender, body_type, appearance_tag, image_url, sort_order, is_active)
VALUES
  -- Female (core)
  ('zoe', 'Zoe', 'female', NULL, NULL, '/model-library/zoe.png', 10, true),
  ('lina', 'Lina', 'female', NULL, NULL, '/model-library/lina.png', 20, true),
  ('min-ji', 'Min-Ji', 'female', NULL, NULL, '/model-library/min-ji.png', 30, true),
  ('sophia', 'Sophia', 'female', NULL, NULL, '/model-library/sophia.png', 40, true),
  ('camila', 'Camila', 'female', NULL, NULL, '/model-library/camila.png', 50, true),
  ('rashna', 'Rashna', 'female', NULL, NULL, '/model-library/rashna.png', 60, true),
  -- Female (added batch)
  ('stephanie', 'Stephanie', 'female', 'Child', 'Black / African descent', '/model-library/stephanie.png', 65, true),
  ('asher', 'Asher', 'female', 'Child', 'East Asian', '/model-library/asher.png', 70, true),
  ('hanna', 'Hanna', 'female', 'Child', 'Black / African descent', '/model-library/hanna.png', 75, true),
  ('mia', 'Mia', 'female', 'Slim', 'East Asian', '/model-library/mia.png', 80, true),
  ('louis', 'Louis', 'female', 'Child', 'White / European', '/model-library/louis.png', 85, true),
  ('aiko', 'Aiko', 'female', 'Regular', 'East Asian', '/model-library/aiko.png', 90, true),
  ('nicole', 'Nicole', 'female', 'Slim', 'Latine / Hispanic', '/model-library/nicole.png', 95, true),
  ('diane', 'Diane', 'female', 'Curvy', 'White / European', '/model-library/diane.png', 100, true),
  -- Male (core)
  ('andrew', 'Andrew', 'male', NULL, NULL, '/model-library/andrew.png', 110, true),
  ('jack', 'Jack', 'male', NULL, NULL, '/model-library/jack.png', 120, true),
  ('jordan', 'Jordan', 'male', NULL, NULL, '/model-library/jordan.png', 130, true),
  ('steve', 'Steve', 'male', NULL, NULL, '/model-library/steve.png', 140, true),
  ('vandik', 'Vandik', 'male', NULL, NULL, '/model-library/vandik.png', 150, true),
  ('lucas', 'Lucas', 'male', NULL, NULL, '/model-library/lucas.png', 160, true),
  -- Male (added batch)
  ('max', 'Max', 'male', 'Plus-size', 'Middle Eastern / South Asian', '/model-library/max.png', 165, true),
  ('li-xeng', 'Li Xeng', 'male', 'Athletic', 'East Asian', '/model-library/li-xeng.png', 170, true),
  ('jed', 'Jed', 'male', 'Slim', 'White / European', '/model-library/jed.png', 175, true),
  ('alex', 'Alex', 'male', 'Child', 'White / European', '/model-library/alex.png', 180, true),
  ('alfred', 'Alfred', 'male', 'Child', 'Latine / Hispanic', '/model-library/alfred.png', 185, true),
  ('derrick', 'Derrick', 'male', 'Child', 'White / European', '/model-library/derrick.png', 190, true)
ON CONFLICT (slug) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  gender = EXCLUDED.gender,
  body_type = EXCLUDED.body_type,
  appearance_tag = EXCLUDED.appearance_tag,
  image_url = EXCLUDED.image_url,
  sort_order = EXCLUDED.sort_order,
  is_active = EXCLUDED.is_active;
