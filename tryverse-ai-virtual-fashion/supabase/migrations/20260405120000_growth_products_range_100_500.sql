-- Growth plan: product range copy 500–1000 → 100–500 (marketing / features list only).

UPDATE public.plans SET
  features = '["500–1000 try-ons / month","100–500 products","Analytics","API / widget","Widget embed","Marketing content"]'::jsonb
WHERE id = 'growth';
