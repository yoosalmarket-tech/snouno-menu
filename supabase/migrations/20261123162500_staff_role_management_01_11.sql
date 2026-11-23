-- STAFF & ROLE MANAGEMENT 01.11 — enforce editable granular grants in Supabase.
-- Existing nine section identifiers remain compatible for legacy sessions.
CREATE OR REPLACE FUNCTION private.menu_can(p_section text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=''
AS $function$
 SELECT coalesce((
 SELECT CASE WHEN s.role='owner' THEN true ELSE
  CASE p_section
   WHEN 'dishes' THEN r.permissions && ARRAY[
     'dishes','meals.add','meals.edit_details','meals.change_prices',
     'meals.change_availability','meals.delete','meals.reorder',
     'meals.manage_images','meals.manage_ingredients','meals.manage_categories',
     'marketing.edit_image_seo']::text[]
   WHEN 'categories' THEN r.permissions && ARRAY['categories','meals.manage_categories']::text[]
   WHEN 'menu_settings' THEN r.permissions && ARRAY[
      'menu_settings','content.edit_welcome','content.edit_contact',
      'content.manage_hours','content.manage_closures','content.manage_images',
      'system.edit_settings']::text[]
   WHEN 'menu_links' THEN r.permissions && ARRAY['menu_links','content.edit_social']::text[]
   WHEN 'menu_ads' THEN r.permissions && ARRAY['menu_ads','content.manage_ads']::text[]
   WHEN 'rankings' THEN r.permissions && ARRAY['rankings','reports.view_customers']::text[]
   WHEN 'submissions' THEN r.permissions && ARRAY['submissions','reports.view_customers']::text[]
   WHEN 'events' THEN r.permissions && ARRAY[
      'events','reports.view_visitors','reports.view_products','reports.view_conversions',
      'reports.view_attribution']::text[]
   WHEN 'orders' THEN r.permissions && ARRAY['orders','orders.view_financial']::text[]
   ELSE p_section=ANY(r.permissions)
  END END
 FROM public.menu_staff s JOIN public.menu_roles r ON r.role=s.role
 JOIN auth.users u ON (u.id=s.user_id OR (s.user_id IS NULL AND lower(u.email)=s.email))
 WHERE u.id=auth.uid() AND u.email_confirmed_at IS NOT NULL AND s.status='active'
 ),false)
$function$;

-- Every changed meal field requires its exact permission, not merely access to the menu page.
CREATE OR REPLACE FUNCTION private.menu_guard_dish_changes()
RETURNS trigger LANGUAGE plpgsql SET search_path=''
AS $function$
DECLARE field record; need text;
BEGIN
 IF TG_OP='INSERT' THEN
    IF NOT private.menu_has_permission('meals.add') AND NOT private.menu_has_permission('dishes')
      THEN RAISE EXCEPTION 'Permission denied: meals.add'; END IF;
    RETURN NEW;
 END IF;
 IF TG_OP='DELETE' THEN
    IF NOT private.menu_has_permission('meals.delete') AND NOT private.menu_has_permission('dishes')
      THEN RAISE EXCEPTION 'Permission denied: meals.delete'; END IF;
    RETURN OLD;
 END IF;
 IF NEW.id IS DISTINCT FROM OLD.id THEN RAISE EXCEPTION 'Meal identifier cannot change'; END IF;
 FOR field IN SELECT k,v FROM jsonb_each(to_jsonb(NEW)) AS x(k,v)
 LOOP
   IF field.v IS NOT DISTINCT FROM (to_jsonb(OLD)->field.k) THEN CONTINUE; END IF;
   need:=CASE
     WHEN field.k IN ('price','old_price') THEN 'meals.change_prices'
     WHEN field.k='available' THEN 'meals.change_availability'
     WHEN field.k='position' THEN 'meals.reorder'
     WHEN field.k='category_id' THEN 'meals.manage_categories'
     WHEN field.k IN ('image','rich_image') THEN 'meals.manage_images'
     WHEN field.k IN ('ingredients','order_options') THEN 'meals.manage_ingredients'
     WHEN field.k IN ('seo_title','seo_description','seo_alt','seo_image_filename') THEN 'marketing.edit_image_seo'
     ELSE 'meals.edit_details'
   END;
   IF NOT private.menu_has_permission(need) AND NOT private.menu_has_permission('dishes')
     THEN RAISE EXCEPTION 'Permission denied: %',need; END IF;
 END LOOP;
 RETURN NEW;
END $function$;
DROP TRIGGER IF EXISTS menu_guard_dish_changes ON public.dishes;
CREATE TRIGGER menu_guard_dish_changes BEFORE INSERT OR UPDATE OR DELETE ON public.dishes
FOR EACH ROW EXECUTE FUNCTION private.menu_guard_dish_changes();

CREATE OR REPLACE FUNCTION private.menu_guard_settings_changes()
RETURNS trigger LANGUAGE plpgsql SET search_path=''
AS $function$
DECLARE field record; need text;
BEGIN
 IF TG_OP='DELETE' THEN
   IF private.menu_role() IS DISTINCT FROM 'owner' THEN RAISE EXCEPTION 'Protected settings'; END IF;
   RETURN OLD;
 END IF;
 IF TG_OP='INSERT' THEN
   IF private.menu_role() IS DISTINCT FROM 'owner' THEN RAISE EXCEPTION 'Protected settings'; END IF;
   RETURN NEW;
 END IF;
 IF NEW.id IS DISTINCT FROM OLD.id THEN RAISE EXCEPTION 'Restaurant settings identifier cannot change'; END IF;
 FOR field IN SELECT k,v FROM jsonb_each(to_jsonb(NEW)) AS x(k,v) LOOP
   IF field.v IS NOT DISTINCT FROM (to_jsonb(OLD)->field.k) THEN CONTINUE; END IF;
   need:=CASE
      WHEN field.k LIKE 'welcome%' THEN 'content.edit_welcome'
      WHEN field.k='hours' THEN 'content.manage_hours'
      WHEN field.k='closure_rules' THEN 'content.manage_closures'
      WHEN field.k IN ('logo','favicon_url') THEN 'content.manage_images'
      WHEN field.k IN ('contact','address','hotline') THEN 'content.edit_contact'
      ELSE 'system.edit_settings'
   END;
   IF NOT private.menu_has_permission(need) AND NOT private.menu_has_permission('menu_settings')
       THEN RAISE EXCEPTION 'Permission denied: %',need; END IF;
 END LOOP;
 RETURN NEW;
END $function$;
DROP TRIGGER IF EXISTS menu_guard_settings_changes ON public.menu_settings;
CREATE TRIGGER menu_guard_settings_changes BEFORE INSERT OR UPDATE OR DELETE ON public.menu_settings
FOR EACH ROW EXECUTE FUNCTION private.menu_guard_settings_changes();

-- Retain existing broad order read behavior for compatibility during migration.
-- Financial information must be separately guarded before granular read permissions can be trusted.
DROP POLICY IF EXISTS owner_read ON public.pay_orders;
CREATE POLICY owner_read ON public.pay_orders FOR SELECT TO authenticated
USING ((SELECT private.menu_can('orders')));
DROP POLICY IF EXISTS owner_read ON public.pay_items;
CREATE POLICY owner_read ON public.pay_items FOR SELECT TO authenticated
USING ((SELECT private.menu_can('orders')));
DROP POLICY IF EXISTS owner_read ON public.pay_history;
CREATE POLICY owner_read ON public.pay_history FOR SELECT TO authenticated
USING ((SELECT private.menu_has_permission('orders.view_history') OR private.menu_can('orders'))));
DROP POLICY IF EXISTS owner_read ON public.pay_proofs;
CREATE POLICY owner_read ON public.pay_proofs FOR SELECT TO authenticated
USING ((SELECT private.menu_has_permission('orders.view_receipts') OR private.menu_can('orders'))));

DROP POLICY IF EXISTS menu_upload ON storage.objects;
CREATE POLICY menu_upload ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id='menu-images' AND
  (SELECT private.menu_has_permission('meals.manage_images') OR
    private.menu_has_permission('content.manage_images') OR
    private.menu_has_permission('content.manage_ads') OR
    private.menu_has_permission('dishes') OR private.menu_has_permission('menu_ads')));

-- Audit log access follows the specific activity/audit grants.
DROP POLICY IF EXISTS owner_activity_read ON public.menu_staff_activity;
CREATE POLICY owner_activity_read ON public.menu_staff_activity FOR SELECT TO authenticated
USING ((SELECT private.menu_has_permission('staff.view_activity') OR
                    private.menu_has_permission('staff.view_changes') OR
                    private.menu_has_permission('system.view_audit')));

-- The other nine legacy sections continue through menu_can; each specialized
-- data service, report and AI tool must additionally check its own permission.
