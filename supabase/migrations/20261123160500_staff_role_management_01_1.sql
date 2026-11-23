-- STAFF & ROLE MANAGEMENT 01.1 — additive staff identity, role metadata, invoice attribution.
-- Designed to preserve existing accounts, roles, payments, and historical receipts.
-- Apply in a controlled migration only after the corresponding application release is validated.

ALTER TABLE public.menu_staff
  ADD COLUMN IF NOT EXISTS user_id uuid,
  ADD COLUMN IF NOT EXISTS full_name text,
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS added_at timestamptz NOT NULL DEFAULT now();

ALTER TABLE public.menu_staff
  ADD CONSTRAINT menu_staff_name_length CHECK (full_name IS NULL OR length(trim(full_name)) BETWEEN 2 AND 120),
  ADD CONSTRAINT menu_staff_status_check CHECK (status IN ('active', 'disabled')),
  ADD CONSTRAINT menu_staff_user_id_unique UNIQUE (user_id),
  ADD CONSTRAINT menu_staff_user_id_fk FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL;

-- Existing users are associated with their already verified Supabase Auth identities.
UPDATE public.menu_staff s SET user_id = u.id
  FROM auth.users u
  WHERE lower(u.email) = s.email AND s.user_id IS NULL;

CREATE OR REPLACE FUNCTION private.menu_staff_new_identity()
RETURNS trigger LANGUAGE plpgsql SET search_path = ''
AS $function$
BEGIN
  IF NEW.full_name IS NULL OR length(trim(NEW.full_name)) < 2 THEN
    RAISE EXCEPTION 'Employee full name is required';
  END IF;
  NEW.full_name := trim(NEW.full_name);
  RETURN NEW;
END $function$;

DROP TRIGGER IF EXISTS menu_staff_require_new_name ON public.menu_staff;
CREATE TRIGGER menu_staff_require_new_name BEFORE INSERT ON public.menu_staff
FOR EACH ROW EXECUTE FUNCTION private.menu_staff_new_identity();

ALTER TABLE public.menu_roles
  ADD COLUMN IF NOT EXISTS id uuid NOT NULL DEFAULT gen_random_uuid(),
  ADD COLUMN IF NOT EXISTS label_ar text,
  ADD COLUMN IF NOT EXISTS label_en text,
  ADD COLUMN IF NOT EXISTS description text NOT NULL DEFAULT '';

UPDATE public.menu_roles SET label_ar = label WHERE label_ar IS NULL;
ALTER TABLE public.menu_roles ADD CONSTRAINT menu_roles_uuid_unique UNIQUE (id);
ALTER TABLE public.menu_roles ADD CONSTRAINT menu_roles_translations_length CHECK (
  length(trim(coalesce(label_ar,''))) BETWEEN 2 AND 100
  AND (label_en IS NULL OR length(label_en) <= 100)
  AND length(description) <= 500
);

-- Keep the historical role text as an immutable internal authorization identifier.
-- Changing display names never changes the role ID or the assignments.
CREATE OR REPLACE FUNCTION public.menu_staff_set_name(p_user_id uuid, p_full_name text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $function$
BEGIN
  IF auth.uid() IS NULL OR private.menu_role() IS DISTINCT FROM 'owner'
    THEN RAISE EXCEPTION 'Access denied'; END IF;
  IF p_full_name IS NULL OR length(trim(p_full_name)) NOT BETWEEN 2 AND 120
    THEN RAISE EXCEPTION 'Invalid employee name'; END IF;
  UPDATE public.menu_staff SET full_name=trim(p_full_name)
  WHERE user_id=p_user_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Employee not found'; END IF;
END $function$;
REVOKE ALL ON FUNCTION public.menu_staff_set_name(uuid,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.menu_staff_set_name(uuid,text) TO authenticated;

CREATE OR REPLACE FUNCTION public.menu_role_save_details(
  p_role text, p_label_ar text, p_label_en text, p_description text
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $function$
BEGIN
 IF auth.uid() IS NULL OR private.menu_role() IS DISTINCT FROM 'owner'
   THEN RAISE EXCEPTION 'Access denied'; END IF;
 IF length(trim(coalesce(p_label_ar,''))) NOT BETWEEN 2 AND 100
    OR length(coalesce(p_label_en,''))>100
    OR length(coalesce(p_description,''))>500
   THEN RAISE EXCEPTION 'Invalid role metadata'; END IF;
 UPDATE public.menu_roles SET label=left(trim(p_label_ar),60),
    label_ar=trim(p_label_ar), label_en=nullif(trim(coalesce(p_label_en,'')),''),
    description=trim(coalesce(p_description,''))
 WHERE role=p_role;
 IF NOT FOUND THEN RAISE EXCEPTION 'Role not found'; END IF;
END $function$;
REVOKE ALL ON FUNCTION public.menu_role_save_details(text,text,text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.menu_role_save_details(text,text,text,text) TO authenticated;

CREATE OR REPLACE FUNCTION private.menu_roles_sync_label()
RETURNS trigger LANGUAGE plpgsql SET search_path = ''
AS $function$
BEGIN
  -- Compatibility with existing menu_role_save RPC (which updates label).
  IF TG_OP='INSERT' THEN
    NEW.label_ar:=coalesce(nullif(NEW.label_ar,''),NEW.label);
  ELSIF NEW.label IS DISTINCT FROM OLD.label AND NEW.label_ar IS NOT DISTINCT FROM OLD.label_ar THEN
    NEW.label_ar:=NEW.label;
  END IF;
  RETURN NEW;
END $function$;
DROP TRIGGER IF EXISTS menu_roles_sync_label ON public.menu_roles;
CREATE TRIGGER menu_roles_sync_label BEFORE INSERT OR UPDATE ON public.menu_roles
FOR EACH ROW EXECUTE FUNCTION private.menu_roles_sync_label();

ALTER TABLE public.pay_orders
  ADD COLUMN IF NOT EXISTS approved_by uuid,
  ADD COLUMN IF NOT EXISTS approved_by_name text,
  ADD COLUMN IF NOT EXISTS approved_by_role text,
  ADD COLUMN IF NOT EXISTS approved_by_role_id uuid;

CREATE OR REPLACE FUNCTION private.menu_payment_approval_attribution()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $function$
DECLARE person record;
BEGIN
  IF NEW.status='approved' AND OLD.status IS DISTINCT FROM 'approved' THEN
    -- Only the authenticated employee approving the transaction is attributable.
    IF auth.uid() IS NULL OR NOT private.menu_has_permission('orders.approve') THEN
      RAISE EXCEPTION 'Payment approval requires an authorized employee';
    END IF;
    SELECT s.full_name,s.email,s.role,r.id AS role_id,r.label
      INTO person
      FROM public.menu_staff s
      JOIN public.menu_roles r ON r.role=s.role
      WHERE s.user_id=auth.uid()
         OR (s.user_id IS NULL AND s.email=(
           SELECT lower(email) FROM auth.users WHERE id=auth.uid()))
      ORDER BY (s.user_id=auth.uid()) DESC LIMIT 1;
    IF NOT FOUND OR person.role IS NULL OR person.role_id IS NULL THEN
      RAISE EXCEPTION 'Approving employee not found'; END IF;
    NEW.approved_by:=auth.uid();
    NEW.approved_by_name:=coalesce(nullif(trim(person.full_name),''),person.email);
    NEW.approved_by_role:=person.label;
    NEW.approved_by_role_id:=person.role_id;
    NEW.invoice:=coalesce(NEW.invoice,'{}'::jsonb) ||
      jsonb_build_object('approval', jsonb_build_object(
        'employee_id',NEW.approved_by,'employee_name',NEW.approved_by_name,
        'role_id',NEW.approved_by_role_id,'role_name',NEW.approved_by_role,
        'approved_at',coalesce(NEW.approved_at,now())));
  END IF;
  RETURN NEW;
END $function$;
DROP TRIGGER IF EXISTS menu_payment_approval_attribution ON public.pay_orders;
CREATE TRIGGER menu_payment_approval_attribution
BEFORE UPDATE OF status ON public.pay_orders
FOR EACH ROW EXECUTE FUNCTION private.menu_payment_approval_attribution();

-- Audit data is append-only to application users and contains no credentials.
CREATE TABLE IF NOT EXISTS public.menu_staff_activity (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  actor_id uuid,
  actor_name text NOT NULL DEFAULT '',
  actor_role text NOT NULL DEFAULT '',
  action text NOT NULL CHECK (length(action) BETWEEN 2 AND 100),
  target_table text NOT NULL,
  target_id text NOT NULL,
  previous_value jsonb,
  new_value jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.menu_staff_activity ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.menu_staff_activity FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.menu_staff_activity TO authenticated;
CREATE POLICY owner_activity_read ON public.menu_staff_activity FOR SELECT TO authenticated
USING ((SELECT private.menu_role())='owner');
CREATE INDEX IF NOT EXISTS menu_staff_activity_date_idx ON public.menu_staff_activity(created_at DESC);
CREATE INDEX IF NOT EXISTS menu_staff_activity_actor_idx ON public.menu_staff_activity(actor_id,created_at DESC);

CREATE OR REPLACE FUNCTION private.menu_write_staff_audit(
  p_action text,p_table text,p_id text,p_before jsonb,p_after jsonb
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $function$
DECLARE who record;
BEGIN
  IF auth.uid() IS NULL THEN RETURN; END IF;
  SELECT coalesce(nullif(s.full_name,''),s.email) AS name,r.label AS role
    INTO who FROM public.menu_staff s JOIN public.menu_roles r ON r.role=s.role
    WHERE s.user_id=auth.uid() OR (s.user_id IS NULL AND s.email=(
      SELECT lower(email) FROM auth.users WHERE id=auth.uid()))
    LIMIT 1;
  INSERT INTO public.menu_staff_activity(actor_id,actor_name,actor_role,action,target_table,target_id,previous_value,new_value)
  VALUES(auth.uid(),coalesce(who.name,''),coalesce(who.role,''),p_action,p_table,p_id,p_before,p_after);
END $function$;
REVOKE ALL ON FUNCTION private.menu_write_staff_audit(text,text,text,jsonb,jsonb) FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION private.menu_audit_staff_and_roles()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $function$
DECLARE old_data jsonb; new_data jsonb; ident text;
BEGIN
 IF TG_OP IN ('UPDATE','DELETE') THEN
   old_data:=CASE WHEN TG_TABLE_NAME='menu_staff' THEN
     jsonb_build_object('name',OLD.full_name,'role',OLD.role,'status',OLD.status)
     ELSE jsonb_build_object('name',OLD.label,'permissions',OLD.permissions) END;
 END IF;
 IF TG_OP IN ('UPDATE','INSERT') THEN
   new_data:=CASE WHEN TG_TABLE_NAME='menu_staff' THEN
     jsonb_build_object('name',NEW.full_name,'role',NEW.role,'status',NEW.status)
     ELSE jsonb_build_object('name',NEW.label,'permissions',NEW.permissions) END;
 END IF;
 ident:=CASE WHEN TG_OP='DELETE' THEN
   CASE WHEN TG_TABLE_NAME='menu_staff' THEN OLD.email ELSE OLD.role END
 ELSE CASE WHEN TG_TABLE_NAME='menu_staff' THEN NEW.email ELSE NEW.role END END;
 IF old_data IS DISTINCT FROM new_data THEN
   PERFORM private.menu_write_staff_audit(lower(TG_OP)||'_'||TG_TABLE_NAME,TG_TABLE_NAME,ident,old_data,new_data);
 END IF;
 IF TG_OP='DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
END $function$;
DROP TRIGGER IF EXISTS menu_staff_activity_changes ON public.menu_staff;
CREATE TRIGGER menu_staff_activity_changes AFTER INSERT OR UPDATE OR DELETE ON public.menu_staff
FOR EACH ROW EXECUTE FUNCTION private.menu_audit_staff_and_roles();
DROP TRIGGER IF EXISTS menu_roles_activity_changes ON public.menu_roles;
CREATE TRIGGER menu_roles_activity_changes AFTER INSERT OR UPDATE OR DELETE ON public.menu_roles
FOR EACH ROW EXECUTE FUNCTION private.menu_audit_staff_and_roles();

CREATE OR REPLACE FUNCTION private.menu_audit_payment()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $function$
BEGIN
 IF NEW.status IN ('approved','rejected','cancelled') AND NEW.status IS DISTINCT FROM OLD.status THEN
   PERFORM private.menu_write_staff_audit('payment_'||NEW.status,'pay_orders',NEW.id::text,
     jsonb_build_object('status',OLD.status),
     jsonb_build_object('status',NEW.status,'approved_at',NEW.approved_at));
 END IF;
 RETURN NEW;
END $function$;
DROP TRIGGER IF EXISTS menu_payment_activity_changes ON public.pay_orders;
CREATE TRIGGER menu_payment_activity_changes AFTER UPDATE OF status ON public.pay_orders
FOR EACH ROW EXECUTE FUNCTION private.menu_audit_payment();

-- Do not retroactively attribute old approved transactions to a guessed employee.

-- Keep Auth email updates synchronized with stable user IDs.
CREATE OR REPLACE FUNCTION private.sync_snounu_staff_email()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $function$
BEGIN
 IF OLD.email IS DISTINCT FROM NEW.email AND OLD.email IS NOT NULL AND NEW.email IS NOT NULL THEN
  UPDATE public.menu_staff SET email=lower(NEW.email),user_id=NEW.id
  WHERE user_id=NEW.id OR email=lower(OLD.email);
 END IF;
 RETURN NEW;
END $function$;

-- Account disabling must affect already-issued sessions at the database layer.
CREATE OR REPLACE FUNCTION private.menu_role()
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path=''
AS $function$
 SELECT s.role FROM public.menu_staff s
 JOIN auth.users u ON (u.id=s.user_id OR (s.user_id IS NULL AND lower(u.email)=s.email))
 WHERE u.id=(SELECT auth.uid()) AND u.email_confirmed_at IS NOT NULL
   AND s.status='active'
$function$;

CREATE OR REPLACE FUNCTION private.menu_can(p_section text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=''
AS $function$
 SELECT coalesce(
  (SELECT s.role='owner' OR p_section=ANY(r.permissions)
   FROM public.menu_staff s
   JOIN public.menu_roles r ON r.role=s.role
   JOIN auth.users u ON (u.id=s.user_id OR (s.user_id IS NULL AND lower(u.email)=s.email))
   WHERE u.id=auth.uid() AND u.email_confirmed_at IS NOT NULL
     AND s.status='active'),false)
$function$;

CREATE OR REPLACE FUNCTION public.menu_my_capabilities()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=''
AS $function$
DECLARE r record;
BEGIN
 IF auth.uid() IS NULL THEN
   RETURN jsonb_build_object('role','','permissions','[]'::jsonb);
 END IF;
 SELECT s.role,mr.label,mr.permissions,s.full_name,s.status INTO r
 FROM public.menu_staff s JOIN public.menu_roles mr ON mr.role=s.role
 JOIN auth.users u ON (u.id=s.user_id OR (s.user_id IS NULL AND lower(u.email)=s.email))
 WHERE u.id=auth.uid() AND u.email_confirmed_at IS NOT NULL AND s.status='active';
 IF NOT FOUND THEN
   RETURN jsonb_build_object('role','','permissions','[]'::jsonb);
 END IF;
 RETURN jsonb_build_object('role',r.role,'label',r.label,'full_name',r.full_name,
                           'permissions',to_jsonb(r.permissions));
END $function$;
REVOKE ALL ON FUNCTION public.menu_my_capabilities() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.menu_my_capabilities() TO authenticated;

CREATE OR REPLACE FUNCTION public.menu_staff_set_status(p_user_id uuid,p_status text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $function$
DECLARE target_role text;
BEGIN
 IF auth.uid() IS NULL OR private.menu_role() IS DISTINCT FROM 'owner'
   THEN RAISE EXCEPTION 'Access denied'; END IF;
 IF p_status NOT IN ('active','disabled') THEN RAISE EXCEPTION 'Invalid account status'; END IF;
 SELECT role INTO target_role FROM public.menu_staff WHERE user_id=p_user_id FOR UPDATE;
 IF target_role IS NULL THEN RAISE EXCEPTION 'Employee not found'; END IF;
 IF target_role='owner' THEN RAISE EXCEPTION 'Owner account is protected'; END IF;
 UPDATE public.menu_staff SET status=p_status WHERE user_id=p_user_id;
END $function$;
REVOKE ALL ON FUNCTION public.menu_staff_set_status(uuid,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.menu_staff_set_status(uuid,text) TO authenticated;

-- Audited menu changes must exclude secrets and customer personal details.
CREATE OR REPLACE FUNCTION private.menu_audit_dish_updates()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $function$
BEGIN
 IF TG_OP='DELETE' THEN
   PERFORM private.menu_write_staff_audit('meal_deleted','dishes',OLD.id::text,
      jsonb_build_object('name',OLD.name,'price',OLD.price,'available',OLD.available),NULL);
   RETURN OLD;
 END IF;
 IF NEW.price IS DISTINCT FROM OLD.price THEN
   PERFORM private.menu_write_staff_audit('meal_price_changed','dishes',NEW.id::text,
      jsonb_build_object('price',OLD.price),jsonb_build_object('price',NEW.price));
 END IF;
 IF NEW.available IS DISTINCT FROM OLD.available THEN
   PERFORM private.menu_write_staff_audit('meal_availability_changed','dishes',NEW.id::text,
      jsonb_build_object('available',OLD.available),
      jsonb_build_object('available',NEW.available));
 END IF;
 RETURN NEW;
END $function$;
DROP TRIGGER IF EXISTS menu_dish_activity_changes ON public.dishes;
CREATE TRIGGER menu_dish_activity_changes AFTER UPDATE OR DELETE ON public.dishes
FOR EACH ROW EXECUTE FUNCTION private.menu_audit_dish_updates();
