-- Each turn contains a complete question/reply pair. Deleting its parent removes all turns.
create table private.snounu_chats (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users on delete cascade,
  title text not null,
  updated_at timestamptz not null default now(),
  revision integer not null default 0
);
create index on private.snounu_chats (owner_id, updated_at desc, id);
create table private.snounu_chat_turns (
  chat_id uuid not null references private.snounu_chats on delete cascade,
  turn_number integer not null,
  question text not null,
  answer text not null,
  primary key (chat_id, turn_number)
);
revoke all on private.snounu_chats, private.snounu_chat_turns from public, anon, authenticated;

create function public.snounu_chats_list(p_offset integer default 0)
returns jsonb language sql stable security definer set search_path='' as $$
  select coalesce(jsonb_agg(to_jsonb(t) order by updated_at desc,id),'[]'::jsonb) from (
    select id,title,updated_at,revision from private.snounu_chats
    where owner_id=auth.uid() and private.menu_role()='owner'
    order by updated_at desc,id limit 31 offset greatest(p_offset,0)
  ) t
$$;

create function public.snounu_chat_read(p_id uuid, p_recent boolean default false)
returns jsonb language sql stable security definer set search_path='' as $$
  select jsonb_build_object('id',c.id,'title',c.title,'revision',c.revision,'turns',(
    select coalesce(jsonb_agg(to_jsonb(t) order by turn_number),'[]'::jsonb) from (
      select turn_number,question,answer from private.snounu_chat_turns
      where chat_id=c.id and (not p_recent or turn_number>c.revision-12)
    ) t))
  from private.snounu_chats c where c.id=p_id and c.owner_id=auth.uid() and private.menu_role()='owner'
$$;

create function public.snounu_chat_save(p_id uuid,p_revision integer,p_question text,p_answer text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare chat private.snounu_chats;
begin
  if auth.uid() is null or private.menu_role() is distinct from 'owner' then raise insufficient_privilege; end if;
  if p_question is null or length(p_question) not between 1 and 2000 or
     p_answer is null or length(p_answer) not between 1 and 32000 then raise exception 'invalid_turn'; end if;
  if p_id is null and p_revision=0 then
    insert into private.snounu_chats(owner_id,title) values(auth.uid(),left(trim(p_question),72)) returning * into chat;
  else
    select * into chat from private.snounu_chats where id=p_id and owner_id=auth.uid() for update;
    if not found or chat.revision is distinct from p_revision then return jsonb_build_object('error','chat_changed'); end if;
  end if;
  if not public.snounu_ai_consume_daily_quota() then raise exception 'quota_exhausted' using errcode='P0429'; end if;
  update private.snounu_chats set revision=revision+1,updated_at=clock_timestamp() where id=chat.id returning * into chat;
  insert into private.snounu_chat_turns values(chat.id,chat.revision,p_question,p_answer);
  return jsonb_build_object('id',chat.id,'revision',chat.revision,'title',chat.title,'updated_at',chat.updated_at);
end
$$;

create function public.snounu_chat_delete(p_id uuid)
returns boolean language plpgsql security definer set search_path='' as $$
begin
  delete from private.snounu_chats where id=p_id and owner_id=auth.uid() and private.menu_role()='owner';
  return found;
end
$$;
revoke all on function public.snounu_chats_list(integer),public.snounu_chat_read(uuid,boolean),
 public.snounu_chat_save(uuid,integer,text,text),public.snounu_chat_delete(uuid) from public,anon;
grant execute on function public.snounu_chats_list(integer),public.snounu_chat_read(uuid,boolean),
 public.snounu_chat_save(uuid,integer,text,text),public.snounu_chat_delete(uuid) to authenticated;
