-- Pricing copy: individual free pool messaging (5), brand free (20), widget embed on Growth/Enterprise.

UPDATE public.plans SET
  name = 'Free',
  tryons_per_month = 5,
  features = '["5 try-ons/month on free pool (individual) · 20 on signup (brands)","Watermark","Basic quality"]'::jsonb
WHERE id = 'free';

UPDATE public.plans SET
  tryons_per_month = 5,
  features = '["5 try-ons/month on free pool (individual) · 20 on signup (brands)","Watermark","Basic quality"]'::jsonb
WHERE id IN ('free_trial', 'trial');

UPDATE public.plans SET
  features = '["500–1000 try-ons / month","100–500 products","Analytics","API / widget","Widget embed","Marketing content"]'::jsonb
WHERE id = 'growth';

UPDATE public.plans SET
  features = '["AI video generation","Custom models","SLA","Dedicated infrastructure","Widget embed","Let''s talk — negotiated pricing"]'::jsonb
WHERE id = 'enterprise';
