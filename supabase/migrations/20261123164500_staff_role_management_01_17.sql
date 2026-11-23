-- STAFF & ROLE MANAGEMENT 01.17 — preserve payment workflow while allowing explicitly authorized roles.
-- Proof-review-before-approval, transaction locking, and customer proof validation are unchanged.
CREATE OR REPLACE FUNCTION private.pay_change(p_id uuid, p_target text, p_reason text, p_actor uuid, p_hash text, p_path text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare o public.pay_orders; cfg public.pay_settings;
begin
 select * into strict o from public.pay_orders where id=p_id for update;
 select * into strict cfg from public.pay_settings where id=1;
 if p_actor is null then
  if o.secret_hash is distinct from p_hash or p_target not in ('cancelled','pending') then raise exception 'Access denied'; end if;
  if p_target='cancelled' and not cfg.cancellation then raise exception 'Cancellation disabled'; end if;
 elsif p_actor is distinct from auth.uid() OR
   NOT private.menu_has_permission(CASE p_target
     WHEN 'approved' THEN 'orders.approve'
     WHEN 'rejected' THEN 'orders.reject'
     WHEN 'cancelled' THEN 'orders.cancel'
     ELSE 'orders.update_status' END)
   then raise exception 'Access denied'; end if;
 if o.status=p_target and p_target<>'pending' then return; end if;
 if p_target='pending' then
  if o.status<>'rejected' or p_path is null then raise exception 'Proof cannot be replaced'; end if;
  insert into public.pay_proofs(path,order_id) values(p_path,p_id);
 elsif o.status<>'pending' or p_target not in ('approved','rejected','cancelled') then raise exception 'Decision already recorded';
 end if;
 if p_target='rejected' and length(trim(coalesce(p_reason,''))) not between 1 and 500 then raise exception 'Rejection reason required'; end if;
 update public.pay_orders set status=p_target,reason=coalesce(p_reason,''),
 approved_at=case when p_target='approved' then now() end,
 invoice=case when p_target='approved' then jsonb_build_object('number','SN-'||o.number,'restaurant',cfg.restaurant,'address',cfg.address,'phone',cfg.phone,'logo',cfg.logo,'paper',cfg.paper) end where id=p_id;
 insert into public.pay_history(order_id,status,actor,reason) values(p_id,p_target,p_actor,coalesce(p_reason,''));
 if cfg.live_updates then perform realtime.send('{}'::jsonb,'refresh','payment-'||o.topic,false); end if;
end $function$


CREATE OR REPLACE FUNCTION public.pay_decide(p_id uuid, p_target text, p_reason text DEFAULT ''::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  o public.pay_orders;
  latest_path text;
  latest_uploaded_at timestamptz;
BEGIN
  IF auth.uid() IS NULL OR NOT private.menu_has_permission(CASE p_target WHEN 'approved' THEN 'orders.approve' WHEN 'rejected' THEN 'orders.reject' WHEN 'cancelled' THEN 'orders.cancel' ELSE 'orders.update_status' END)
    OR p_target NOT IN ('approved','rejected','cancelled')
    THEN RAISE EXCEPTION 'Access denied'; END IF;

  SELECT * INTO STRICT o FROM public.pay_orders WHERE id=p_id FOR UPDATE;

  IF p_target='approved' THEN
    IF o.payment_mode='at_restaurant' THEN
      IF o.arrived_at IS NULL
        THEN RAISE EXCEPTION 'Confirm arrival before accepting restaurant payment'; END IF;
    ELSE
      SELECT path,uploaded_at INTO latest_path,latest_uploaded_at
        FROM public.pay_proofs
        WHERE order_id=p_id ORDER BY uploaded_at DESC,path DESC LIMIT 1;
      IF latest_path IS NULL
         OR o.proof_reviewed_path IS DISTINCT FROM latest_path
         OR o.proof_reviewed_by IS DISTINCT FROM auth.uid()
         OR o.proof_reviewed_at IS NULL
         OR o.proof_reviewed_at < latest_uploaded_at
      THEN
        RAISE EXCEPTION 'You must open and review the latest payment proof before approving this payment';
      END IF;
    END IF;
  END IF;
  PERFORM private.pay_change(p_id,p_target,p_reason,auth.uid(),NULL,NULL);
END $function$


CREATE OR REPLACE FUNCTION public.pay_mark_arrived(p_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE o public.pay_orders; cfg public.pay_settings;
BEGIN
 IF auth.uid() IS NULL OR NOT private.menu_has_permission('orders.update_status') THEN RAISE EXCEPTION 'Access denied'; END IF;
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
END $function$


CREATE OR REPLACE FUNCTION public.pay_mark_completed(p_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE o public.pay_orders; cfg public.pay_settings;
BEGIN
 IF auth.uid() IS NULL OR NOT private.menu_has_permission('orders.update_status') THEN RAISE EXCEPTION 'Access denied'; END IF;
 SELECT * INTO STRICT o FROM public.pay_orders WHERE id=p_id FOR UPDATE;
 IF o.fulfillment_status='completed' THEN RETURN; END IF;
 IF o.status<>'approved' THEN RAISE EXCEPTION 'Only approved orders can be completed'; END IF;
 IF o.service_type='dine_in' AND o.arrived_at IS NULL THEN RAISE EXCEPTION 'Confirm customer arrival first'; END IF;
 UPDATE public.pay_orders SET fulfillment_status='completed',completed_at=now() WHERE id=p_id;
 INSERT INTO public.pay_history(order_id,status,actor,reason)
 VALUES(p_id,'completed',auth.uid(),'تم تأكيد تسليم الطلب');
 SELECT * INTO cfg FROM public.pay_settings WHERE id=1;
 IF cfg.live_updates THEN PERFORM realtime.send('{}'::jsonb,'refresh','payment-'||o.topic,false); END IF;
END $function$


CREATE OR REPLACE FUNCTION public.pay_record_proof_review(p_id uuid, p_path text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE o public.pay_orders; recent_path text;
BEGIN
  IF auth.uid() IS NULL OR NOT private.menu_has_permission('orders.approve') OR NOT private.menu_has_permission('orders.view_receipts')
    THEN RAISE EXCEPTION 'Access denied'; END IF;
  SELECT * INTO STRICT o FROM public.pay_orders WHERE id=p_id FOR UPDATE;
  IF o.status <> 'pending' OR o.payment_mode = 'at_restaurant'
    THEN RAISE EXCEPTION 'Proof review is not applicable to this order'; END IF;
  SELECT path INTO recent_path FROM public.pay_proofs
    WHERE order_id=p_id ORDER BY uploaded_at DESC, path DESC LIMIT 1;
  IF recent_path IS NULL OR recent_path <> p_path
    THEN RAISE EXCEPTION 'Latest payment proof not found'; END IF;
  UPDATE public.pay_orders SET
    proof_reviewed_at=clock_timestamp(),
    proof_reviewed_by=auth.uid(),
    proof_reviewed_path=p_path
  WHERE id=p_id;
END $function$


CREATE OR REPLACE FUNCTION public.pay_resolve_report(p_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
BEGIN
 IF auth.uid() IS NULL OR NOT private.menu_has_permission('orders.update_status') THEN RAISE EXCEPTION 'Access denied'; END IF;
 UPDATE public.pay_order_reports SET resolved_at=now() WHERE id=p_id AND resolved_at IS NULL;
 IF NOT FOUND THEN RAISE EXCEPTION 'Report already resolved'; END IF;
END $function$

