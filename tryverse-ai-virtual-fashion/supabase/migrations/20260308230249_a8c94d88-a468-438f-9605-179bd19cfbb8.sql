
CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.profiles (id, brand_name, contact_email, full_name, role, free_credits_remaining, free_credits_total)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'brand_name', ''),
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'role', ''),
    3,
    3
  );
  RETURN NEW;
END;
$function$;
