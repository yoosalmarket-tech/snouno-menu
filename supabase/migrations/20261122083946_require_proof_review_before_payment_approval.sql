-- Require owner review of the latest uploaded proof before electronic payment approval.
-- At-restaurant payments still require confirmed arrival instead.
alter table public.pay_orders add column if not exists proof_reviewed_at timestamptz;
alter table public.pay_orders add column if not exists proof_reviewed_by uuid;
alter table public.pay_orders add column if not exists proof_reviewed_path text;

create or replace function public.pay_record_proof_review(p_id uuid,p_path text)
returns void language plpgsql security definer set search_path to ''
as $function$
declare o public.pay_orders; recent_path text;
begin
 if auth.uid() is null or private.menu_role() is distinct from 'owner'
   then raise exception 'Access denied'; end if;
 select * into strict o from public.pay_orders where id=p_id for update;
 if o.status <> 'pending' or o.payment_mode='at_restaurant'
   then raise exception 'Proof review is not applicable to this order'; end if;
 select path into recent_path from public.pay_proofs
   where order_id=p_id order by uploaded_at desc,path desc limit 1;
 if recent_path is null or recent_path <> p_path
   then raise exception 'Latest payment proof not found'; end if;
 update public.pay_orders set proof_reviewed_at=clock_timestamp(),
   proof_reviewed_by=auth.uid(),proof_reviewed_path=p_path where id=p_id;
end $function$;
revoke all on function public.pay_record_proof_review(uuid,text) from public,anon,authenticated;
grant execute on function public.pay_record_proof_review(uuid,text) to authenticated;

create or replace function public.pay_decide(p_id uuid,p_target text,p_reason text default ''::text)
returns void language plpgsql security definer set search_path to ''
as $function$
declare o public.pay_orders; latest_path text; latest_uploaded_at timestamptz;
begin
 if auth.uid() is null or private.menu_role() is distinct from 'owner'
   or p_target not in ('approved','rejected','cancelled')
   then raise exception 'Access denied'; end if;
 select * into strict o from public.pay_orders where id=p_id for update;
 if p_target='approved' then
   if o.payment_mode='at_restaurant' then
     if o.arrived_at is null
       then raise exception 'Confirm arrival before accepting restaurant payment'; end if;
   else
     select path,uploaded_at into latest_path,latest_uploaded_at
       from public.pay_proofs
       where order_id=p_id order by uploaded_at desc,path desc limit 1;
     if latest_path is null
        or o.proof_reviewed_path is distinct from latest_path
        or o.proof_reviewed_by is distinct from auth.uid()
        or o.proof_reviewed_at is null
        or o.proof_reviewed_at < latest_uploaded_at
       then raise exception 'You must open and review the latest payment proof before approving this payment';
     end if;
   end if;
 end if;
 perform private.pay_change(p_id,p_target,p_reason,auth.uid(),null,null);
end $function$;
revoke all on function public.pay_decide(uuid,text,text) from public,anon;
grant execute on function public.pay_decide(uuid,text,text) to authenticated;
