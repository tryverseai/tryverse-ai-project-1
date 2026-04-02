-- Hybrid pricing: align NGN/USD amounts with product strategy (checkout uses these columns).

UPDATE public.plans SET
  price_ngn = 15000,
  price_usd = 10,
  tryons_per_month = 75,
  max_products = 0,
  features = '["50–100 try-ons / month","HD images","No watermark","Download images"]'::jsonb
WHERE id = 'pro';

UPDATE public.plans SET
  price_ngn = 30000,
  price_usd = 20,
  tryons_per_month = 250,
  max_products = 0,
  features = '["200–300 try-ons / month","HD + better realism","Generate marketing images","Priority processing"]'::jsonb
WHERE id = 'creator';

UPDATE public.plans SET
  price_ngn = 80000,
  price_usd = 60,
  tryons_per_month = 150,
  max_products = 100,
  features = '["100–200 try-ons / month","50–100 products","Basic fit prediction","Download images"]'::jsonb
WHERE id = 'starter';

UPDATE public.plans SET
  price_ngn = 180000,
  price_usd = 150,
  tryons_per_month = 750,
  max_products = 750,
  features = '["500–1000 try-ons / month","100–500 products","Analytics","API / widget","Marketing content"]'::jsonb
WHERE id = 'growth';

UPDATE public.plans SET
  name = 'Enterprise',
  price_ngn = 0,
  price_usd = 0,
  features = '["AI video generation","Custom models","SLA","Dedicated infrastructure","Let''s talk — negotiated pricing"]'::jsonb
WHERE id = 'enterprise';

UPDATE public.plans SET
  tryons_per_month = 5,
  features = '["3–5 try-ons/month (individual free pool) · 20 on signup (brands)","Watermark","Basic quality"]'::jsonb
WHERE id = 'free';
