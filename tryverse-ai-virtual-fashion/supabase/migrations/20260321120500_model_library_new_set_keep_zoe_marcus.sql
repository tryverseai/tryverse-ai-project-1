-- New model photos: keep Zoe + Marcus URLs; replace the other 10 with a different Unsplash set.
-- Runs even if 20260321120200 already applied (new filename = new migration).

UPDATE public.tryverse_model_library SET image_url = 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=600&h=800&fit=crop&q=80' WHERE slug = 'aisha';
UPDATE public.tryverse_model_library SET image_url = 'https://images.unsplash.com/photo-1515886657613-9f3515b0db78?w=600&h=800&fit=crop&q=80' WHERE slug = 'lin';
UPDATE public.tryverse_model_library SET image_url = 'https://images.unsplash.com/photo-1488426862026-3ee34a7d66df?w=600&h=800&fit=crop&q=80' WHERE slug = 'sophie';
UPDATE public.tryverse_model_library SET image_url = 'https://images.unsplash.com/photo-1508214751196-bcfd4ca60f91?w=600&h=800&fit=crop&q=80' WHERE slug = 'camila';
UPDATE public.tryverse_model_library SET image_url = 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=600&h=800&fit=crop&q=80' WHERE slug = 'priya';

UPDATE public.tryverse_model_library SET image_url = 'https://images.unsplash.com/photo-1566492031773-4f4e44671857?w=600&h=800&fit=crop&q=80' WHERE slug = 'daniel';
UPDATE public.tryverse_model_library SET image_url = 'https://images.unsplash.com/photo-1519345182560-3f2917c472ef?w=600&h=800&fit=crop&q=80' WHERE slug = 'james';
UPDATE public.tryverse_model_library SET image_url = 'https://images.unsplash.com/photo-1504257432389-52343af14bab?w=600&h=800&fit=crop&q=80' WHERE slug = 'diego';
UPDATE public.tryverse_model_library SET image_url = 'https://images.unsplash.com/photo-1568602471122-783295085e68?w=600&h=800&fit=crop&q=80' WHERE slug = 'amir';
UPDATE public.tryverse_model_library SET image_url = 'https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?w=600&h=800&fit=crop&q=80' WHERE slug = 'vikram';
