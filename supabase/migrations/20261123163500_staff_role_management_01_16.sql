-- STAFF & ROLE MANAGEMENT 01.16 — quota for permissioned staff AI.
-- Owner's existing quota, chats and marketing brief remain unchanged.
CREATE OR REPLACE FUNCTION public.snounu_ai_staff_quota_remaining()
RETURNS integer LANGUAGE sql STABLE SECURITY DEFINER SET search_path=''
AS $function$
 SELECT CASE
   WHEN auth.uid() IS NULL OR NOT private.menu_has_permission('assistant.access') THEN 0
   ELSE greatest(0,20-coalesce((
       SELECT u.request_count FROM private.snounu_ai_daily_usage u
       WHERE u.user_id=auth.uid()
         AND u.usage_date=(now() at time zone 'Asia/Gaza')::date
   ),0))
 END
$function$;
REVOKE ALL ON FUNCTION public.snounu_ai_staff_quota_remaining() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.snounu_ai_staff_quota_remaining() TO authenticated;

CREATE OR REPLACE FUNCTION public.snounu_ai_staff_consume_quota()
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $function$
DECLARE current_count integer;
BEGIN
 IF auth.uid() IS NULL OR NOT private.menu_has_permission('assistant.access') THEN RETURN false; END IF;
 INSERT INTO private.snounu_ai_daily_usage(user_id,usage_date,request_count)
 VALUES(auth.uid(),(now() at time zone 'Asia/Gaza')::date,1)
 ON CONFLICT (user_id,usage_date) DO UPDATE
 SET request_count=private.snounu_ai_daily_usage.request_count+1
 WHERE private.snounu_ai_daily_usage.request_count<20
 RETURNING request_count INTO current_count;
 RETURN current_count IS NOT NULL;
END $function$;
REVOKE ALL ON FUNCTION public.snounu_ai_staff_consume_quota() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.snounu_ai_staff_consume_quota() TO authenticated;
