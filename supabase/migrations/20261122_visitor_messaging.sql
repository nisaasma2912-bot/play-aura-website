-- Play Aura Visitor Messaging, Admin Replies & Notification Inbox Migration
-- Safe, backward-compatible migration: preserves all existing suggestions, blocks, games, and admin authorization.

-- 1. Track when an admin has read a visitor's original suggestion
alter table public.game_suggestions
  add column if not exists admin_read_at timestamptz;

-- Mark previously reviewed/archived suggestions as read by admin while leaving 'new' unread
update public.game_suggestions
set admin_read_at = created_at
where admin_read_at is null
  and status in ('reviewed', 'archived');

-- 2. Suggestion replies / conversation messages table
create table if not exists public.suggestion_replies (
  id uuid primary key default gen_random_uuid(),
  suggestion_id uuid not null references public.game_suggestions(id) on delete cascade,
  sender_type text not null default 'admin' check (sender_type in ('admin', 'visitor')),
  body text not null check (char_length(trim(body)) between 1 and 2000),
  admin_user_id uuid references auth.users(id) on delete set null,
  visitor_read_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_suggestion_replies_suggestion_created
  on public.suggestion_replies (suggestion_id, created_at asc);

create index if not exists idx_suggestion_replies_unread_visitor
  on public.suggestion_replies (suggestion_id)
  where sender_type = 'admin' and visitor_read_at is null;

-- 3. Strict Row Level Security on suggestion_replies
-- Public / anonymous visitors NEVER get direct table SELECT/INSERT/UPDATE/DELETE access.
-- They read and mark-read ONLY their own conversations through validated SECURITY DEFINER RPCs below.
alter table public.suggestion_replies enable row level security;

revoke all on table public.suggestion_replies from public, anon;
grant select, insert, update, delete on table public.suggestion_replies to authenticated;

drop policy if exists "Admins can view suggestion replies" on public.suggestion_replies;
create policy "Admins can view suggestion replies"
on public.suggestion_replies for select
to authenticated
using (public.is_playaura_admin());

drop policy if exists "Admins can create suggestion replies" on public.suggestion_replies;
create policy "Admins can create suggestion replies"
on public.suggestion_replies for insert
to authenticated
with check (public.is_playaura_admin() and sender_type = 'admin');

drop policy if exists "Admins can update suggestion replies" on public.suggestion_replies;
create policy "Admins can update suggestion replies"
on public.suggestion_replies for update
to authenticated
using (public.is_playaura_admin())
with check (public.is_playaura_admin());

drop policy if exists "Admins can delete suggestion replies" on public.suggestion_replies;
create policy "Admins can delete suggestion replies"
on public.suggestion_replies for delete
to authenticated
using (public.is_playaura_admin());

-- 4. Admin RPC: mark a visitor suggestion as read by admin
create or replace function public.mark_suggestion_read_admin(
  p_suggestion_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_read_at timestamptz;
begin
  if not public.is_playaura_admin() then
    return jsonb_build_object(
      'ok', false,
      'code', 'unauthorized',
      'error', 'Only Play Aura administrators can perform this action.'
    );
  end if;

  update public.game_suggestions
  set admin_read_at = coalesce(admin_read_at, now())
  where id = p_suggestion_id
  returning admin_read_at into v_read_at;

  if v_read_at is null then
    return jsonb_build_object(
      'ok', false,
      'code', 'not_found',
      'error', 'Suggestion not found.'
    );
  end if;

  return jsonb_build_object(
    'ok', true,
    'id', p_suggestion_id,
    'admin_read_at', v_read_at
  );
end;
$$;

revoke all on function public.mark_suggestion_read_admin(uuid) from public, anon;
grant execute on function public.mark_suggestion_read_admin(uuid) to authenticated;

-- 5. Admin RPC: send a permanent admin reply to a suggestion conversation
create or replace function public.send_admin_suggestion_reply(
  p_suggestion_id uuid,
  p_body text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_clean_body text;
  v_reply public.suggestion_replies%rowtype;
  v_suggestion public.game_suggestions%rowtype;
begin
  if not public.is_playaura_admin() then
    return jsonb_build_object(
      'ok', false,
      'code', 'unauthorized',
      'error', 'Only Play Aura administrators can send replies.'
    );
  end if;

  v_clean_body := btrim(coalesce(p_body, ''), E' \t\r\n');

  if char_length(v_clean_body) < 1 then
    return jsonb_build_object(
      'ok', false,
      'code', 'empty_reply',
      'error', 'Please enter a reply message before sending.'
    );
  end if;

  if char_length(v_clean_body) > 2000 then
    return jsonb_build_object(
      'ok', false,
      'code', 'too_long',
      'error', 'Replies must be 2000 characters or fewer.'
    );
  end if;

  select *
    into v_suggestion
  from public.game_suggestions
  where id = p_suggestion_id;

  if not found then
    return jsonb_build_object(
      'ok', false,
      'code', 'not_found',
      'error', 'This visitor message no longer exists.'
    );
  end if;

  insert into public.suggestion_replies (
    suggestion_id,
    sender_type,
    body,
    admin_user_id
  )
  values (
    p_suggestion_id,
    'admin',
    v_clean_body,
    auth.uid()
  )
  returning * into v_reply;

  update public.game_suggestions
  set
    admin_read_at = coalesce(admin_read_at, now()),
    status = case when status = 'new' then 'reviewed' else status end
  where id = p_suggestion_id
  returning * into v_suggestion;

  return jsonb_build_object(
    'ok', true,
    'reply', jsonb_build_object(
      'id', v_reply.id,
      'suggestion_id', v_reply.suggestion_id,
      'sender_type', v_reply.sender_type,
      'body', v_reply.body,
      'admin_user_id', v_reply.admin_user_id,
      'visitor_read_at', v_reply.visitor_read_at,
      'created_at', v_reply.created_at
    ),
    'suggestion', jsonb_build_object(
      'id', v_suggestion.id,
      'status', v_suggestion.status,
      'admin_read_at', v_suggestion.admin_read_at
    )
  );
end;
$$;

revoke all on function public.send_admin_suggestion_reply(uuid, text) from public, anon;
grant execute on function public.send_admin_suggestion_reply(uuid, text) to authenticated;

-- 6. Visitor RPC: fetch ONLY this visitor's own suggestions, admin replies, and unread count
create or replace function public.get_visitor_inbox(
  p_visitor_token_hash text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_clean_hash text;
  v_conversations jsonb;
  v_unread_count integer;
begin
  v_clean_hash := lower(btrim(coalesce(p_visitor_token_hash, '')));

  if v_clean_hash !~ '^[a-f0-9]{64}$' then
    return jsonb_build_object(
      'ok', false,
      'code', 'invalid_visitor',
      'unread_count', 0,
      'conversations', '[]'::jsonb
    );
  end if;

  select coalesce(count(*), 0)::integer
    into v_unread_count
  from public.suggestion_replies sr
  join public.game_suggestions gs on gs.id = sr.suggestion_id
  where gs.visitor_token_hash = v_clean_hash
    and sr.sender_type = 'admin'
    and sr.visitor_read_at is null;

  select coalesce(
    jsonb_agg(conv_row.payload order by conv_row.sort_at desc),
    '[]'::jsonb
  )
    into v_conversations
  from (
    select
      coalesce(max(sr.created_at), gs.created_at) as sort_at,
      jsonb_build_object(
        'id', gs.id,
        'message', gs.message,
        'status', gs.status,
        'created_at', gs.created_at,
        'reply_count', count(sr.id)::integer,
        'unread_reply_count', count(sr.id) filter (where sr.sender_type = 'admin' and sr.visitor_read_at is null)::integer,
        'latest_activity_at', coalesce(max(sr.created_at), gs.created_at),
        'replies', coalesce(
          jsonb_agg(
            jsonb_build_object(
              'id', sr.id,
              'suggestion_id', sr.suggestion_id,
              'sender_type', sr.sender_type,
              'body', sr.body,
              'created_at', sr.created_at,
              'visitor_read_at', sr.visitor_read_at
            )
            order by sr.created_at asc
          ) filter (where sr.id is not null),
          '[]'::jsonb
        )
      ) as payload
    from public.game_suggestions gs
    left join public.suggestion_replies sr on sr.suggestion_id = gs.id
    where gs.visitor_token_hash = v_clean_hash
    group by gs.id, gs.message, gs.status, gs.created_at
  ) as conv_row;

  return jsonb_build_object(
    'ok', true,
    'unread_count', v_unread_count,
    'conversations', v_conversations
  );
end;
$$;

revoke all on function public.get_visitor_inbox(text) from public;
grant execute on function public.get_visitor_inbox(text) to anon, authenticated;

-- 7. Visitor RPC: fetch a single conversation ONLY if it belongs to p_visitor_token_hash
create or replace function public.get_visitor_conversation(
  p_suggestion_id uuid,
  p_visitor_token_hash text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_clean_hash text;
  v_conversation jsonb;
begin
  v_clean_hash := lower(btrim(coalesce(p_visitor_token_hash, '')));

  if p_suggestion_id is null or v_clean_hash !~ '^[a-f0-9]{64}$' then
    return jsonb_build_object(
      'ok', false,
      'code', 'invalid_request',
      'error', 'Unable to verify conversation ownership.'
    );
  end if;

  select
    jsonb_build_object(
      'id', gs.id,
      'message', gs.message,
      'status', gs.status,
      'created_at', gs.created_at,
      'reply_count', count(sr.id)::integer,
      'unread_reply_count', count(sr.id) filter (where sr.sender_type = 'admin' and sr.visitor_read_at is null)::integer,
      'latest_activity_at', coalesce(max(sr.created_at), gs.created_at),
      'replies', coalesce(
        jsonb_agg(
          jsonb_build_object(
            'id', sr.id,
            'suggestion_id', sr.suggestion_id,
            'sender_type', sr.sender_type,
            'body', sr.body,
            'created_at', sr.created_at,
            'visitor_read_at', sr.visitor_read_at
          )
          order by sr.created_at asc
        ) filter (where sr.id is not null),
        '[]'::jsonb
      )
    )
    into v_conversation
  from public.game_suggestions gs
  left join public.suggestion_replies sr on sr.suggestion_id = gs.id
  where gs.id = p_suggestion_id
    and gs.visitor_token_hash = v_clean_hash
  group by gs.id, gs.message, gs.status, gs.created_at;

  if v_conversation is null then
    return jsonb_build_object(
      'ok', false,
      'code', 'not_found',
      'error', 'Conversation not found.'
    );
  end if;

  return jsonb_build_object(
    'ok', true,
    'conversation', v_conversation
  );
end;
$$;

revoke all on function public.get_visitor_conversation(uuid, text) from public;
grant execute on function public.get_visitor_conversation(uuid, text) to anon, authenticated;

-- 8. Visitor RPC: mark admin replies as read ONLY for this visitor's own conversations
create or replace function public.mark_visitor_replies_read(
  p_visitor_token_hash text,
  p_suggestion_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_clean_hash text;
  v_now timestamptz := now();
  v_marked_count integer := 0;
  v_remaining_unread integer := 0;
begin
  v_clean_hash := lower(btrim(coalesce(p_visitor_token_hash, '')));

  if v_clean_hash !~ '^[a-f0-9]{64}$' then
    return jsonb_build_object(
      'ok', false,
      'code', 'invalid_visitor',
      'marked_count', 0,
      'unread_count', 0
    );
  end if;

  with updated as (
    update public.suggestion_replies sr
    set visitor_read_at = v_now
    from public.game_suggestions gs
    where sr.suggestion_id = gs.id
      and gs.visitor_token_hash = v_clean_hash
      and (p_suggestion_id is null or gs.id = p_suggestion_id)
      and sr.sender_type = 'admin'
      and sr.visitor_read_at is null
    returning sr.id
  )
  select count(*)::integer into v_marked_count from updated;

  select coalesce(count(*), 0)::integer
    into v_remaining_unread
  from public.suggestion_replies sr
  join public.game_suggestions gs on gs.id = sr.suggestion_id
  where gs.visitor_token_hash = v_clean_hash
    and sr.sender_type = 'admin'
    and sr.visitor_read_at is null;

  return jsonb_build_object(
    'ok', true,
    'marked_count', v_marked_count,
    'unread_count', v_remaining_unread,
    'read_at', v_now
  );
end;
$$;

revoke all on function public.mark_visitor_replies_read(text, uuid) from public;
grant execute on function public.mark_visitor_replies_read(text, uuid) to anon, authenticated;

-- Refresh PostgREST schema cache immediately
notify pgrst, 'reload schema';
