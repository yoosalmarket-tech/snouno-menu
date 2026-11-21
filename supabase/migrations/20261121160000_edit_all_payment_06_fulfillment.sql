-- EDIT ALL PAYMENT 06.5: payment, arrival, and fulfillment are separate.
-- Preserve old orders and proof records; old approved orders are not marked completed.
ALTER TABLE public.pay_orders
 ADD COLUMN payment_mode text NOT NULL DEFAULT 'online'
  CHECK(payment_mode IN('online','at_restaurant')),
 ADD COLUMN fulfillment_status text NOT NULL DEFAULT 'awaiting_approval'
  CHECK(fulfillment_status IN('awaiting_approval','awaiting_visit','awaiting_payment','preparing','completed','stopped')),
 ADD COLUMN arrived_at timestamptz,
 ADD COLUMN completed_at timestamptz;
ALTER TABLE public.pay_orders ALTER COLUMN method_id DROP NOT NULL;
UPDATE public.pay_orders SET fulfillment_status =
 CASE WHEN status='approved' THEN CASE WHEN service_type='dine_in' THEN 'awaiting_visit' ELSE 'preparing' END
 WHEN status IN('rejected','cancelled') THEN 'stopped'
 ELSE 'awaiting_approval' END;

CREATE OR REPLACE FUNCTION private.pay_order_stage_sync()
RETURNS trigger LANGUAGE plpgsql SET search_path = ''
AS $$
BEGIN
 IF NEW.status IS DISTINCT FROM OLD.status THEN
   IF NEW.status='approved' THEN
     NEW.fulfillment_status := CASE WHEN NEW.service_type='dine_in' AND NEW.arrived_at IS NULL
       THEN 'awaiting_visit' ELSE 'preparing' END;
   ELSIF NEW.status IN ('cancelled','rejected') THEN
     NEW.fulfillment_status := 'stopped';
   ELSIF NEW.status='pending' THEN
     NEW.fulfillment_status := CASE WHEN NEW.payment_mode='at_restaurant' AND NEW.arrived_at IS NULL
       THEN 'awaiting_visit' ELSE 'awaiting_approval' END;
   END IF;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER pay_order_stage_on_status BEFORE UPDATE OF status ON public.pay_orders
 FOR EACH ROW EXECUTE FUNCTION private.pay_order_stage_sync();

-- Same RPC signature so browser and tracking tokens from existing orders stay valid.
create or replace function public.pay_submit(p_id uuid,p_hash text,p_customer text,p_phone text,p_notes text,p_method uuid,p_items jsonb,p_total numeric,p_path text)
returns void language plpgsql set search_path='' as $$
declare m public.pay_methods; line record; cost numeric:=0; q int; existing public.pay_orders;
 payload jsonb; service text := 'unspecified'; destination text := ''; landmark text := ''; secondary_phone text := ''; customer_note text := coalesce(p_notes,''); pay_mode text := 'online';
begin
 if left(coalesce(p_notes,''),length('SNOUNU_FULFILLMENT_V1:'))='SNOUNU_FULFILLMENT_V1:' then
   payload := substring(p_notes from length('SNOUNU_FULFILLMENT_V1:') + 1)::jsonb;
   if jsonb_typeof(payload) is distinct from 'object' then raise exception 'Invalid fulfillment'; end if;
   service := payload->>'type';
   pay_mode := coalesce(payload->>'payment_mode','online');
   if pay_mode not in ('online','at_restaurant') then raise exception 'Invalid payment mode'; end if;
   if pay_mode='at_restaurant' and service<>'dine_in' then raise exception 'Arrival payment is dine-in only'; end if;
   destination := trim(coalesce(payload->>'address',''));
   landmark := trim(coalesce(payload->>'landmark',''));
   secondary_phone := trim(coalesce(payload->>'backup_phone',''));
   customer_note := trim(coalesce(payload->>'notes',''));
   if service is null or service not in ('dine_in','delivery') then raise exception 'Invalid service type'; end if;
   if service='delivery' then
     if length(destination) not between 8 and 500 then raise exception 'Delivery address required'; end if;
     if length(landmark) not between 3 and 160 then raise exception 'Nearby landmark required'; end if;
     if secondary_phone !~ '^([+])?[0-9 ()-]{7,25}$'
       or length(regexp_replace(secondary_phone,'[^0-9]','','g')) not between 7 and 15
       then raise exception 'Valid backup phone required'; end if;
     if regexp_replace(secondary_phone,'[^0-9]','','g') = regexp_replace(p_phone,'[^0-9]','','g')
       then raise exception 'Backup phone must differ from primary'; end if;
   else
     destination := ''; landmark := ''; secondary_phone := '';
   end if;
 end if;
 if length(customer_note)>1000 then raise exception 'Notes too long'; end if;
 perform pg_advisory_xact_lock(hashtextextended(p_id::text,0));
 select * into existing from public.pay_orders where id=p_id;
 if found then
  if existing.secret_hash<>p_hash then raise exception 'Invalid tracking key'; end if;
  return;
 end if;
 if pay_mode='online' then
   if p_method is null or p_path is null then raise exception 'Online payment requires receipt'; end if;
   select * into strict m from public.pay_methods where id=p_method and enabled for share;
 else
   if p_method is not null or p_path is not null then raise exception 'Arrival payment cannot have proof'; end if;
 end if;
 if jsonb_typeof(p_items)<>'array' or jsonb_array_length(p_items) not between 1 and 60 then raise exception 'Invalid cart'; end if;
 insert into public.pay_orders(id,secret_hash,customer,phone,notes,method_id,method,total,service_type,delivery_address,delivery_landmark,backup_phone,payment_mode,fulfillment_status)
 values(p_id,p_hash,p_customer,p_phone,customer_note,p_method,case when pay_mode='at_restaurant' then 'الدفع عند الوصول' else m.name end,0,service,destination,landmark,secondary_phone,pay_mode,case when pay_mode='at_restaurant' then 'awaiting_visit' else 'awaiting_approval' end);
 for line in select * from public.pay_price_lines(p_items) loop
  insert into public.pay_items(order_id,dish_id,name,qty,price,old_price,choices,special_instructions)
   values(p_id,line.dish_id,line.name,line.qty,line.price,line.old_price,line.choices,line.special_instructions);
  cost:=cost+line.qty*line.price;
 end loop;
 if cost is distinct from p_total then raise exception 'Total changed'; end if;
 update public.pay_orders set total=cost where id=p_id;
 if pay_mode='online' then insert into public.pay_proofs(path,order_id) values(p_path,p_id); end if;
 insert into public.pay_history(order_id,status) values(p_id,'pending');
end $$;

CREATE OR REPLACE FUNCTION public.pay_mark_arrived(p_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE o public.pay_orders; cfg public.pay_settings;
BEGIN
 IF auth.uid() IS NULL OR private.menu_role() IS DISTINCT FROM 'owner' THEN RAISE EXCEPTION 'Access denied'; END IF;
 SELECT * INTO STRICT o FROM public.pay_orders WHERE id=p_id FOR UPDATE;
 IF o.service_type<>'dine_in' OR o.status NOT IN('pending','approved') THEN RAISE EXCEPTION 'Invalid arrival'; END IF;
 IF o.arrived_at IS NOT NULL THEN RETURN; END IF;
 UPDATE public.pay_orders SET arrived_at=now(),
 fulfillment_status=CASE WHEN status='approved' THEN 'preparing'
   WHEN payment_mode='at_restaurant' THEN 'awaiting_payment' ELSE 'awaiting_approval' END
 WHERE id=p_id;
 INSERT INTO public.pay_history(order_id,status,actor,reason) VALUES(p_id,'arrived',auth.uid(),'تم تأكيد وصول العميل');
 SELECT * INTO cfg FROM public.pay_settings WHERE id=1;
 IF cfg.live_updates THEN PERFORM realtime.send('{}'::jsonb,'refresh','payment-'||o.topic,false); END IF;
END $$;

CREATE OR REPLACE FUNCTION public.pay_mark_completed(p_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE o public.pay_orders; cfg public.pay_settings;
BEGIN
 IF auth.uid() IS NULL OR private.menu_role() IS DISTINCT FROM 'owner' THEN RAISE EXCEPTION 'Access denied'; END IF;
 SELECT * INTO STRICT o FROM public.pay_orders WHERE id=p_id FOR UPDATE;
 IF o.fulfillment_status='completed' THEN RETURN; END IF;
 IF o.status<>'approved' THEN RAISE EXCEPTION 'Only approved orders can be completed'; END IF;
 IF o.service_type='dine_in' AND o.arrived_at IS NULL THEN RAISE EXCEPTION 'Confirm customer arrival first'; END IF;
 UPDATE public.pay_orders SET fulfillment_status='completed',completed_at=now() WHERE id=p_id;
 INSERT INTO public.pay_history(order_id,status,actor,reason)
 VALUES(p_id,'completed',auth.uid(),'تم تأكيد تسليم الطلب');
 SELECT * INTO cfg FROM public.pay_settings WHERE id=1;
 IF cfg.live_updates THEN PERFORM realtime.send('{}'::jsonb,'refresh','payment-'||o.topic,false); END IF;
END $$;

-- Payment on arrival can be accepted only after the owner marks the arrival.
CREATE OR REPLACE FUNCTION public.pay_decide(p_id uuid,p_target text,p_reason text DEFAULT '')
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE o public.pay_orders;
BEGIN
 IF auth.uid() IS NULL OR private.menu_role() IS DISTINCT FROM 'owner'
   OR p_target NOT IN('approved','rejected','cancelled') THEN RAISE EXCEPTION 'Access denied'; END IF;
 SELECT * INTO STRICT o FROM public.pay_orders WHERE id=p_id FOR UPDATE;
 IF o.payment_mode='at_restaurant' AND p_target='approved' AND o.arrived_at IS NULL
   THEN RAISE EXCEPTION 'Confirm arrival before accepting restaurant payment'; END IF;
 PERFORM private.pay_change(p_id,p_target,p_reason,auth.uid(),NULL,NULL);
END $$;

CREATE TABLE public.pay_order_reports (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 order_id uuid NOT NULL REFERENCES public.pay_orders(id) ON DELETE CASCADE,
 category text NOT NULL CHECK(category IN('not_received','incorrect_order','other')),
 message text NOT NULL CHECK(length(trim(message)) BETWEEN 5 AND 500),
 created_at timestamptz NOT NULL DEFAULT now(),
 resolved_at timestamptz,
 CONSTRAINT pay_reports_consistency CHECK(resolved_at IS NULL OR resolved_at>=created_at)
);
CREATE UNIQUE INDEX one_open_report_per_order ON public.pay_order_reports(order_id) WHERE resolved_at IS NULL;
CREATE INDEX pay_reports_recent ON public.pay_order_reports(created_at DESC);
ALTER TABLE public.pay_order_reports ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.pay_order_reports FROM public,anon,authenticated;
GRANT SELECT ON public.pay_order_reports TO authenticated;
CREATE POLICY owner_report_read ON public.pay_order_reports FOR SELECT TO authenticated
 USING ((SELECT private.menu_role())='owner');

CREATE OR REPLACE FUNCTION public.pay_resolve_report(p_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
 IF auth.uid() IS NULL OR private.menu_role() IS DISTINCT FROM 'owner' THEN RAISE EXCEPTION 'Access denied'; END IF;
 UPDATE public.pay_order_reports SET resolved_at=now() WHERE id=p_id AND resolved_at IS NULL;
 IF NOT FOUND THEN RAISE EXCEPTION 'Report already resolved'; END IF;
END $$;

REVOKE ALL ON FUNCTION public.pay_mark_arrived(uuid),public.pay_mark_completed(uuid),
 public.pay_resolve_report(uuid) FROM public,anon;
GRANT EXECUTE ON FUNCTION public.pay_mark_arrived(uuid),public.pay_mark_completed(uuid),
 public.pay_resolve_report(uuid) TO authenticated;
