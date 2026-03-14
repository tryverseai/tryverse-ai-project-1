
-- Plans table is public read-only data
ALTER TABLE public.plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Plans are publicly readable" ON public.plans
  FOR SELECT TO public
  USING (true);
