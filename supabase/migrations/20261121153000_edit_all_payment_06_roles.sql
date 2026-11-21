-- EDIT ALL PAYMENT 06: customizable roles, server-enforced capabilities.
CREATE TABLE IF NOT EXISTS public.menu_roles (
 role text PRIMARY KEY CHECK (role ~ '^[a-z][a-z0-9_]{2,31}$'),
 label text NOT NULL CHECK (length(trim(label)) BETWEEN 2 AND 60),
 permissions text[] NOT NULL DEFAULT '{}',
 built_in boolean NOT NULL DEFAULT false,
 CONSTRAINT menu_roles_permitted CHECK (
   permissions <@ ARRAY['dishes','categories','menu_settings','menu_links','menu_ads','rankings','submissions','events','orders']::text[]
 )
);
INSERT INTO public.menu_roles(role,label,permissions,built_in) VALUES
 ('owner','المالك',ARRAY['dishes','categories','menu_settings','menu_links','menu_ads','rankings','submissions','events','orders']::text[],true),
 ('editor','المحرر',ARRAY['dishes','categories','menu_settings','menu_links','menu_ads','rankings','submissions']::text[],true)
ON CONFLICT (role) DO NOTHING;
ALTER TABLE public.menu_roles ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.menu_roles FROM public,anon,authenticated;
GRANT SELECT ON public.menu_roles TO authenticated;
CREATE POLICY owner_roles_read ON public.menu_roles FOR SELECT TO authenticated
 USING ((SELECT private.menu_role()) = 'owner');

ALTER TABLE public.menu_staff DROP CONSTRAINT IF EXISTS menu_staff_role_check;
ALTER TABLE public.menu_staff ADD CONSTRAINT menu_staff_role_fk
 FOREIGN KEY (role) REFERENCES public.menu_roles(role) ON UPDATE RESTRICT ON DELETE RESTRICT;
-- No direct role update allowed. Owner-only RPC functions below perform mutations.

CREATE OR REPLACE FUNCTION private.menu_can(p_section text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
 SELECT coalesce(
   (SELECT s.role='owner' OR p_section = ANY(r.permissions)
    FROM public.menu_staff s
    JOIN public.menu_roles r ON r.role=s.role
    JOIN auth.users u ON lower(u.email)=s.email
    WHERE u.id=auth.uid() AND u.email_confirmed_at IS NOT NULL),false
 );
$$;
REVOKE ALL ON FUNCTION private.menu_can(text) FROM public,anon,authenticated;
GRANT EXECUTE ON FUNCTION private.menu_can(text) TO authenticated;

CREATE OR REPLACE FUNCTION public.menu_my_capabilities()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = ''
AS $$
DECLARE r record;
BEGIN
 IF auth.uid() IS NULL THEN RETURN jsonb_build_object('role','','permissions','[]'::jsonb); END IF;
 SELECT s.role, mr.label, mr.permissions INTO r FROM public.menu_staff s
 JOIN public.menu_roles mr ON mr.role=s.role
 JOIN auth.users u ON lower(u.email)=s.email
 WHERE u.id=auth.uid() AND u.email_confirmed_at IS NOT NULL;
 IF NOT FOUND THEN RETURN jsonb_build_object('role','','permissions','[]'::jsonb); END IF;
 RETURN jsonb_build_object('role',r.role,'label',r.label,'permissions',to_jsonb(r.permissions));
END $$;
REVOKE ALL ON FUNCTION public.menu_my_capabilities() FROM public,anon;
GRANT EXECUTE ON FUNCTION public.menu_my_capabilities() TO authenticated;

CREATE OR REPLACE FUNCTION public.menu_role_save(p_role text,p_label text,p_permissions text[])
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE requested text[];
BEGIN
 IF private.menu_role() IS DISTINCT FROM 'owner' OR auth.uid() IS NULL THEN RAISE EXCEPTION 'Access denied'; END IF;
 IF p_role IS NULL OR p_role !~ '^[a-z][a-z0-9_]{2,31}$' OR p_role='owner' THEN RAISE EXCEPTION 'Protected role'; END IF;
 IF length(trim(coalesce(p_label,''))) NOT BETWEEN 2 AND 60 THEN RAISE EXCEPTION 'Invalid role name'; END IF;
 SELECT coalesce(array_agg(DISTINCT x ORDER BY x),'{}'::text[]) INTO requested FROM unnest(coalesce(p_permissions,'{}'::text[])) x;
 IF NOT (requested <@ ARRAY['dishes','categories','menu_settings','menu_links','menu_ads','rankings','submissions','events','orders']::text[]) THEN
   RAISE EXCEPTION 'Invalid permissions';
 END IF;
 INSERT INTO public.menu_roles(role,label,permissions) VALUES(p_role,trim(p_label),requested)
 ON CONFLICT (role) DO UPDATE SET label=EXCLUDED.label,permissions=EXCLUDED.permissions;
END $$;
CREATE OR REPLACE FUNCTION public.menu_role_remove(p_role text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
 IF private.menu_role() IS DISTINCT FROM 'owner' OR auth.uid() IS NULL THEN RAISE EXCEPTION 'Access denied'; END IF;
 IF p_role IN ('owner','editor') THEN RAISE EXCEPTION 'Cannot remove system role'; END IF;
 DELETE FROM public.menu_roles WHERE role=p_role AND built_in=false;
 IF NOT FOUND THEN RAISE EXCEPTION 'Role not found or in use'; END IF;
END $$;
CREATE OR REPLACE FUNCTION public.menu_staff_set_role(p_email text,p_role text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE target_role text;
BEGIN
 IF private.menu_role() IS DISTINCT FROM 'owner' OR auth.uid() IS NULL THEN RAISE EXCEPTION 'Access denied'; END IF;
 IF p_role='owner' OR NOT EXISTS(SELECT 1 FROM public.menu_roles WHERE role=p_role) THEN
  RAISE EXCEPTION 'Invalid role';
 END IF;
 SELECT role INTO target_role FROM public.menu_staff WHERE email=lower(trim(p_email)) FOR UPDATE;
 IF target_role IS NULL OR target_role='owner' THEN RAISE EXCEPTION 'Protected account'; END IF;
 UPDATE public.menu_staff SET role=p_role WHERE email=lower(trim(p_email));
END $$;
REVOKE ALL ON FUNCTION public.menu_role_save(text,text,text[]),public.menu_role_remove(text),public.menu_staff_set_role(text,text) FROM public,anon;
GRANT EXECUTE ON FUNCTION public.menu_role_save(text,text,text[]),public.menu_role_remove(text),public.menu_staff_set_role(text,text) TO authenticated;

-- Replace overly broad "any staff" write access with capability checks.
DROP POLICY IF EXISTS menu_edit ON public.dishes;
CREATE POLICY menu_edit ON public.dishes FOR ALL TO authenticated
 USING ((SELECT private.menu_can('dishes'))) WITH CHECK ((SELECT private.menu_can('dishes')));
DROP POLICY IF EXISTS menu_edit ON public.categories;
CREATE POLICY menu_edit ON public.categories FOR ALL TO authenticated
 USING ((SELECT private.menu_can('categories'))) WITH CHECK ((SELECT private.menu_can('categories')));
DROP POLICY IF EXISTS ads_edit ON public.menu_ads;
CREATE POLICY ads_edit ON public.menu_ads FOR ALL TO authenticated
 USING ((SELECT private.menu_can('menu_ads'))) WITH CHECK ((SELECT private.menu_can('menu_ads')));
DROP POLICY IF EXISTS menu_edit ON public.menu_links;
CREATE POLICY menu_edit ON public.menu_links FOR ALL TO authenticated
 USING ((SELECT private.menu_can('menu_links'))) WITH CHECK ((SELECT private.menu_can('menu_links')));
DROP POLICY IF EXISTS menu_edit ON public.menu_settings;
CREATE POLICY menu_edit ON public.menu_settings FOR ALL TO authenticated
 USING ((SELECT private.menu_can('menu_settings'))) WITH CHECK ((SELECT private.menu_can('menu_settings')));
DROP POLICY IF EXISTS feedback_read ON public.menu_feedback;
CREATE POLICY feedback_read ON public.menu_feedback FOR SELECT TO authenticated
 USING ((SELECT private.menu_can('rankings') OR private.menu_can('submissions')));
DROP POLICY IF EXISTS feedback_remove ON public.menu_feedback;
CREATE POLICY feedback_remove ON public.menu_feedback FOR DELETE TO authenticated
 USING ((SELECT private.menu_can('rankings') OR private.menu_can('submissions')));
DROP POLICY IF EXISTS menu_action_owner_select ON public.menu_action_events;
CREATE POLICY menu_action_owner_select ON public.menu_action_events FOR SELECT TO authenticated
 USING ((SELECT private.menu_can('events')));
-- Owners can grant order-reading access, never payment decision access.
DROP POLICY IF EXISTS owner_read ON public.pay_orders;
CREATE POLICY owner_read ON public.pay_orders FOR SELECT TO authenticated
 USING ((SELECT private.menu_can('orders')));
DROP POLICY IF EXISTS owner_read ON public.pay_items;
CREATE POLICY owner_read ON public.pay_items FOR SELECT TO authenticated
 USING ((SELECT private.menu_can('orders')));
DROP POLICY IF EXISTS owner_read ON public.pay_history;
CREATE POLICY owner_read ON public.pay_history FOR SELECT TO authenticated
 USING ((SELECT private.menu_can('orders')));
DROP POLICY IF EXISTS owner_read ON public.pay_proofs;
CREATE POLICY owner_read ON public.pay_proofs FOR SELECT TO authenticated
 USING ((SELECT private.menu_can('orders')));

-- Staff revocation covers custom roles too, but never the protected owner.
DROP POLICY IF EXISTS staff_remove ON public.menu_staff;
CREATE POLICY staff_remove ON public.menu_staff FOR DELETE TO authenticated
 USING ((role<>'owner') AND ((SELECT private.menu_role())='owner'));

-- Image upload privileges must follow content permissions, not just any staff login.
DROP POLICY IF EXISTS menu_upload ON storage.objects;
CREATE POLICY menu_upload ON storage.objects FOR INSERT TO authenticated
 WITH CHECK (
   bucket_id='menu-images' AND
   (SELECT private.menu_can('dishes') OR private.menu_can('categories') OR
     private.menu_can('menu_ads') OR private.menu_can('menu_settings'))
 );
