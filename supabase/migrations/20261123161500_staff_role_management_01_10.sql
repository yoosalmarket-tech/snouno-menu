-- STAFF & ROLE MANAGEMENT 01.10 — granular permission catalog and role persistence.
-- Non-destructive: retain legacy section keys until each dashboard endpoint is migrated.
CREATE TABLE public.menu_permission_catalog (
  key text PRIMARY KEY CHECK (key ~ '^[a-z][a-z0-9_]*\.[a-z][a-z0-9_]*$'),
  group_key text NOT NULL,
  label_ar text NOT NULL,
  label_en text NOT NULL,
  sort_order integer NOT NULL
);
ALTER TABLE public.menu_permission_catalog ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.menu_permission_catalog FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.menu_permission_catalog TO authenticated;
CREATE POLICY staff_can_read_permission_catalog ON public.menu_permission_catalog
FOR SELECT TO authenticated USING ((SELECT private.menu_role()) IS NOT NULL);
INSERT INTO public.menu_permission_catalog(key,group_key,label_ar,label_en,sort_order) VALUES
('dashboard.view_overview','dashboard','عرض الصفحة الرئيسية','View dashboard overview',1),
('reports.view_visitors','dashboard','عرض إحصائيات الزوار','View visitor statistics',2),
('reports.view_sales','dashboard','عرض المبيعات والإيرادات','View sales and revenue',3),
('reports.view_conversions','dashboard','عرض معدلات التحويل','View conversion rates',4),
('reports.view_products','dashboard','عرض أداء المنتجات','View product performance',5),
('reports.view_customers','dashboard','عرض تفاعل العملاء','View customer activity',6),
('reports.export','dashboard','تصدير التقارير','Export reports',7),
('reports.view_attribution','dashboard','عرض مصادر الحملات','View marketing attribution',8),
('meals.view','meals','عرض الوجبات','View meals',9),
('meals.add','meals','إضافة وجبات','Add meals',10),
('meals.edit_details','meals','تعديل تفاصيل الوجبات','Edit meal details',11),
('meals.change_prices','meals','تغيير الأسعار','Change prices',12),
('meals.change_availability','meals','تغيير التوفر','Change availability',13),
('meals.delete','meals','حذف وجبات','Delete meals',14),
('meals.reorder','meals','إعادة ترتيب الوجبات','Reorder meals',15),
('meals.manage_categories','meals','إدارة الأصناف','Manage categories',16),
('meals.manage_images','meals','رفع وتغيير صور الوجبات','Manage meal images',17),
('meals.manage_ingredients','meals','إدارة المكونات والإضافات','Manage ingredients and extras',18),
('orders.view','orders','عرض الطلبات','View orders',19),
('orders.view_customers','orders','عرض بيانات العملاء','View customer information',20),
('orders.view_receipts','orders','عرض إثباتات الدفع','View payment receipts',21),
('orders.approve','orders','اعتماد المدفوعات','Approve payments',22),
('orders.reject','orders','رفض المدفوعات','Reject payments',23),
('orders.request_proof','orders','طلب إثبات دفع جديد','Request new payment proof',24),
('orders.update_status','orders','تحديث حالة الطلب','Update order status',25),
('orders.cancel','orders','إلغاء الطلبات','Cancel orders',26),
('orders.print_invoices','orders','طباعة الإيصالات','Print invoices',27),
('orders.view_history','orders','عرض سجل المدفوعات','View payment history',28),
('orders.export','orders','تصدير الطلبات','Export orders',29),
('orders.manage_methods','orders','إدارة طرق الدفع','Manage payment methods',30),
('orders.view_financial','orders','عرض التقارير المالية','View financial reports',31),
('content.edit_welcome','content','تعديل شاشة الترحيب','Edit welcome screen',32),
('content.manage_ads','content','إدارة الإعلانات','Manage advertisements',33),
('content.edit_banners','content','تعديل البنرات','Edit banners',34),
('content.manage_promotions','content','إدارة المحتوى الترويجي','Manage promotional content',35),
('content.edit_contact','content','تعديل معلومات التواصل','Edit restaurant contact information',36),
('content.manage_hours','content','إدارة ساعات العمل','Manage business hours',37),
('content.manage_closures','content','إدارة الإغلاقات','Manage closing schedules',38),
('content.edit_social','content','تعديل روابط التواصل','Edit social media links',39),
('content.manage_images','content','إدارة صور الموقع','Manage website images',40),
('marketing.view_ga4','marketing','عرض بيانات Google Analytics','View Google Analytics data',41),
('marketing.view_search_console','marketing','عرض بيانات Search Console','View Google Search Console',42),
('marketing.manage_campaign_links','marketing','إدارة روابط الحملات','Manage campaign tracking links',43),
('marketing.generate_tagged_urls','marketing','إنشاء روابط تتبع','Generate tagged URLs',44),
('marketing.view_sources','marketing','عرض مصادر الزيارات','View traffic sources',45),
('marketing.view_conversions','marketing','عرض أحداث التحويل','View conversion events',46),
('marketing.edit_seo','marketing','تعديل عناوين وأوصاف SEO','Edit SEO titles and descriptions',47),
('marketing.edit_image_seo','marketing','تعديل SEO للصور','Edit image SEO metadata',48),
('marketing.manage_tracking','marketing','إدارة إعدادات التتبع','Manage tracking configurations',49),
('marketing.export_reports','marketing','تصدير تقارير التسويق','Export marketing reports',50),
('assistant.access','assistant','الوصول للمساعد','Access AI assistant',51),
('assistant.ask_meals','assistant','السؤال عن الوجبات','Ask about meals',52),
('assistant.ask_orders','assistant','السؤال عن الطلبات','Ask about orders',53),
('assistant.ask_sales','assistant','السؤال عن المبيعات','Ask about sales',54),
('assistant.ask_marketing','assistant','السؤال عن التسويق','Ask about marketing',55),
('assistant.view_financial','assistant','عرض التحليلات المالية بالذكاء الاصطناعي','View AI financial insights',56),
('assistant.generate_campaigns','assistant','توليد أفكار الحملات','Generate campaign recommendations',57),
('assistant.manage_settings','assistant','إدارة إعدادات المساعد','Manage AI settings',58),
('assistant.manage_limits','assistant','إدارة حدود استخدام المساعد','Manage AI usage limits',59),
('staff.view','staff','عرض الموظفين','View employees',60),
('staff.invite','staff','دعوة الموظفين','Invite employees',61),
('staff.edit_names','staff','تعديل أسماء الموظفين','Edit employee names',62),
('staff.assign_roles','staff','تعيين الأدوار','Assign roles',63),
('staff.create_roles','staff','إنشاء الأدوار','Create roles',64),
('staff.edit_roles','staff','تعديل الأدوار','Edit roles',65),
('staff.delete_roles','staff','حذف الأدوار','Delete roles',66),
('staff.disable','staff','تعطيل الحسابات','Disable employee accounts',67),
('staff.view_activity','staff','عرض نشاط الموظفين','View employee activity',68),
('staff.view_changes','staff','عرض سجل تغييرات الصلاحيات','View permission change history',69),
('system.view_settings','system','عرض الإعدادات العامة','View general settings',70),
('system.edit_settings','system','تعديل الإعدادات العامة','Edit general settings',71),
('system.manage_integrations','system','إدارة التكاملات','Manage integrations',72),
('system.manage_payment_config','system','إدارة إعدادات الدفع','Manage payment configuration',73),
('system.view_audit','system','عرض سجل النظام','View audit logs',74),
('system.manage_security','system','إدارة الأمان','Manage security settings',75),
('system.manage_ownership','system','إدارة الملكية','Manage ownership',76);

ALTER TABLE public.menu_roles DROP CONSTRAINT IF EXISTS menu_roles_permitted;
ALTER TABLE public.menu_roles ADD CONSTRAINT menu_roles_permitted
CHECK (cardinality(permissions)<=120 AND array_position(permissions,NULL) IS NULL);

-- Migrate existing users' effective nine-group access to matching granular grants.
-- Legacy keys remain for now to avoid breaking the original dashboard until rollout.
WITH mapping(legacy,granular) AS (VALUES
('dishes','meals.view'),
('dishes','meals.add'),
('dishes','meals.edit_details'),
('dishes','meals.change_prices'),
('dishes','meals.change_availability'),
('dishes','meals.delete'),
('dishes','meals.reorder'),
('dishes','meals.manage_images'),
('dishes','meals.manage_ingredients'),
('dishes','marketing.edit_image_seo'),
('categories','meals.manage_categories'),
('menu_settings','content.edit_welcome'),
('menu_settings','content.edit_contact'),
('menu_settings','content.manage_hours'),
('menu_settings','content.manage_closures'),
('menu_settings','content.manage_images'),
('menu_settings','system.view_settings'),
('menu_settings','system.edit_settings'),
('menu_links','content.edit_social'),
('menu_ads','content.manage_ads'),
('menu_ads','content.manage_promotions'),
('menu_ads','content.edit_banners'),
('rankings','reports.view_customers'),
('submissions','reports.view_customers'),
('events','reports.view_visitors'),
('events','reports.view_products'),
('events','reports.view_conversions'),
('events','reports.view_attribution'),
('orders','orders.view'),
('orders','orders.view_customers'),
('orders','orders.view_receipts'),
('orders','orders.view_history'),
('orders','orders.print_invoices'),
('orders','orders.view_financial')
), expanded AS (
 SELECT r.role,ARRAY(
   SELECT DISTINCT token FROM (
     SELECT unnest(r.permissions) token
     UNION ALL
     SELECT m.granular token FROM mapping m WHERE m.legacy=ANY(r.permissions)
   ) grants ORDER BY token
 ) AS new_permissions FROM public.menu_roles r
)
UPDATE public.menu_roles r
SET permissions=e.new_permissions FROM expanded e WHERE r.role=e.role;

CREATE OR REPLACE FUNCTION private.menu_has_permission(p_key text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=''
AS $function$
 SELECT coalesce(
   (SELECT s.role='owner' OR p_key=ANY(r.permissions)
    FROM public.menu_staff s
    JOIN public.menu_roles r ON r.role=s.role
    JOIN auth.users u ON (u.id=s.user_id OR (s.user_id IS NULL AND lower(u.email)=s.email))
    WHERE u.id=auth.uid() AND u.email_confirmed_at IS NOT NULL
      AND s.status='active'),false)
$function$;
REVOKE ALL ON FUNCTION private.menu_has_permission(text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION private.menu_has_permission(text) TO authenticated;

-- New, atomic role editor RPC. Names, descriptions and grants change together.
-- Owner alone can grant permissions until delegable-role rules are introduced.
CREATE OR REPLACE FUNCTION public.menu_role_save_v2(
  p_role text,p_name_ar text,p_name_en text,p_description text,p_permissions text[]
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $function$
DECLARE requested text[];
BEGIN
 IF auth.uid() IS NULL OR private.menu_role() IS DISTINCT FROM 'owner'
   THEN RAISE EXCEPTION 'Access denied'; END IF;
 IF p_role IS NULL OR p_role !~ '^[a-z][a-z0-9_]{2,31}$' OR p_role='owner'
   THEN RAISE EXCEPTION 'Protected role'; END IF;
 IF length(trim(coalesce(p_name_ar,''))) NOT BETWEEN 2 AND 100 OR
    length(coalesce(p_name_en,''))>100 OR
    length(coalesce(p_description,''))>500
    THEN RAISE EXCEPTION 'Invalid role metadata'; END IF;
 SELECT coalesce(array_agg(DISTINCT x ORDER BY x),'{}'::text[])
 INTO requested FROM unnest(coalesce(p_permissions,'{}'::text[])) x;
 IF EXISTS(SELECT 1 FROM unnest(requested) AS k(key)
           WHERE NOT EXISTS(SELECT 1 FROM public.menu_permission_catalog c WHERE c.key=k.key))
 THEN RAISE EXCEPTION 'Invalid permission keys'; END IF;
 INSERT INTO public.menu_roles(role,label,label_ar,label_en,description,permissions)
 VALUES(p_role,left(trim(p_name_ar),60),trim(p_name_ar),nullif(trim(coalesce(p_name_en,'')),''),
        trim(coalesce(p_description,'')),requested)
 ON CONFLICT(role) DO UPDATE SET label=EXCLUDED.label,
   label_ar=EXCLUDED.label_ar,label_en=EXCLUDED.label_en,
   description=EXCLUDED.description,permissions=EXCLUDED.permissions;
END $function$;
REVOKE ALL ON FUNCTION public.menu_role_save_v2(text,text,text,text,text[]) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.menu_role_save_v2(text,text,text,text,text[]) TO authenticated;
