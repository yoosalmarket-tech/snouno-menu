-- Record staff identity on each payment decision without exposing it in guest tracking.
ALTER TABLE public.pay_history ADD COLUMN employee_name text, ADD COLUMN employee_role text;
CREATE OR REPLACE FUNCTION public.pay_decide(p_id uuid, p_target text, p_reason text, p_employee_name text)
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
  IF auth.uid() IS NULL OR coalesce(private.menu_role(),'') NOT IN ('owner','customer_service')
    OR p_target IS NULL OR p_target NOT IN ('approved','rejected','cancelled')
    THEN RAISE EXCEPTION 'Access denied'; END IF;

  IF p_target IN ('approved','rejected') AND length(trim(coalesce(p_employee_name,''))) NOT BETWEEN 2 AND 120 THEN RAISE EXCEPTION 'Employee name required'; END IF;
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
  IF p_target IN ('approved','rejected') AND o.status='pending' THEN
    UPDATE public.pay_history SET employee_name=trim(p_employee_name),employee_role=coalesce((select label from public.menu_roles where role=private.menu_role()),private.menu_role()) WHERE id=(SELECT id FROM public.pay_history WHERE order_id=p_id AND status=p_target AND actor=auth.uid() ORDER BY id DESC LIMIT 1);
  END IF;
  IF p_target='approved' AND o.status='pending' THEN
    UPDATE public.pay_orders SET invoice=invoice || jsonb_build_object('employee_name',trim(p_employee_name)) WHERE id=p_id;
  END IF;
END $function$
;
