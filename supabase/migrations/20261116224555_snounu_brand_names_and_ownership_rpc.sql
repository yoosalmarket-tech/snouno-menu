-- Rebrand the ownership RPC while keeping the previous RPC for still-open dashboards.
CREATE OR REPLACE FUNCTION public.transfer_snounu_ownership(p_target_email text)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_user uuid := auth.uid();
  v_session uuid;
  v_current_email text;
  v_target_email text := lower(btrim(coalesce(p_target_email, '')));
  v_session_text text := (auth.jwt()->>'session_id');
BEGIN
  IF v_user IS NULL OR v_session_text IS NULL OR
     v_session_text !~ '^[a-fA-F0-9-]{36}$' THEN
    RAISE EXCEPTION 'يجب تسجيل الدخول من جديد';
  END IF;
  v_session := v_session_text::uuid;
  IF NOT EXISTS (
    SELECT 1 FROM auth.sessions ss
    WHERE ss.id=v_session AND ss.user_id=v_user
      AND ss.created_at > now() - interval '10 minutes'
      AND (ss.not_after IS NULL OR ss.not_after > now())
  ) THEN
    RAISE EXCEPTION 'لتغيير المالك، أعد إدخال كلمة المرور أولاً';
  END IF;
  SELECT lower(u.email) INTO v_current_email
    FROM auth.users u
    WHERE u.id=v_user AND u.email_confirmed_at IS NOT NULL;
  IF v_current_email IS NULL THEN
    RAISE EXCEPTION 'يلزم تأكيد البريد الإلكتروني';
  END IF;
  IF v_target_email = v_current_email THEN
    RAISE EXCEPTION 'لا يمكنك نقل الملكية لنفس الحساب';
  END IF;
  LOCK TABLE public.menu_staff IN SHARE ROW EXCLUSIVE MODE;
  IF NOT EXISTS (
    SELECT 1 FROM public.menu_staff
    WHERE email=v_current_email AND role='owner'
  ) THEN
    RAISE EXCEPTION 'هذه العملية متاحة للمالك الحالي فقط';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.menu_staff s
    JOIN auth.users u ON lower(u.email)=s.email
    WHERE s.email=v_target_email AND s.role='editor'
      AND u.email_confirmed_at IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'اختر محرراً مسجلاً ببريد مؤكد';
  END IF;
  UPDATE public.menu_staff SET role='editor' WHERE email=v_current_email AND role='owner';
  UPDATE public.menu_staff SET role='owner' WHERE email=v_target_email AND role='editor';
  RETURN 'تم نقل ملكية لوحة التحكم إلى '||v_target_email;
END
$function$;
REVOKE ALL ON FUNCTION public.transfer_snounu_ownership(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.transfer_snounu_ownership(text) TO authenticated, service_role;
ALTER FUNCTION private.sync_snouno_staff_email() RENAME TO sync_snounu_staff_email;
