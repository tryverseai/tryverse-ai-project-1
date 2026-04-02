-- List order is ascending by sort_order. Put Diane first, then Andrew (free-tier defaults).

UPDATE public.tryverse_model_library SET sort_order = -1000 WHERE lower(trim(slug)) = 'diane';
UPDATE public.tryverse_model_library SET sort_order = -999 WHERE lower(trim(slug)) = 'andrew';
