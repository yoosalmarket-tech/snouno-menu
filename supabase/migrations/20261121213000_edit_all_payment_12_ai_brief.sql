-- EDIT ALL PAYMENT 12 — owner editable, private restaurant strategy context for AI.
-- The assistant can READ this note. It cannot write it; only an owner clicking Save can.
create table if not exists private.snounu_ai_brief (
  id smallint primary key default 1 check (id = 1),
  brief text not null default '' check (char_length(brief) <= 3000),
  updated_at timestamptz not null default now()
);
revoke all on private.snounu_ai_brief from public, anon, authenticated;

create or replace function public.snounu_ai_get_brief()
returns text
language plpgsql stable security definer
set search_path = ''
as $$
begin
  if auth.uid() is null or private.menu_role() is distinct from 'owner' then
    raise exception 'owner_only' using errcode='42501';
  end if;
  return coalesce((select b.brief from private.snounu_ai_brief b where b.id=1),'');
end;
$$;

create or replace function public.snounu_ai_set_brief(p_brief text)
returns text
language plpgsql volatile security definer
set search_path = ''
as $$
begin
  if auth.uid() is null or private.menu_role() is distinct from 'owner' then
    raise exception 'owner_only' using errcode='42501';
  end if;
  if p_brief is null or char_length(p_brief) > 3000 then
    raise exception 'brief_invalid' using errcode='22023';
  end if;
  insert into private.snounu_ai_brief(id,brief,updated_at)
  values(1,p_brief,now())
  on conflict (id) do update
    set brief=excluded.brief, updated_at=excluded.updated_at;
  return p_brief;
end;
$$;
revoke all on function public.snounu_ai_get_brief() from public, anon;
revoke all on function public.snounu_ai_set_brief(text) from public, anon;
grant execute on function public.snounu_ai_get_brief() to authenticated;
grant execute on function public.snounu_ai_set_brief(text) to authenticated;
