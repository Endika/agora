-- supabase/migrations/0002_agora_rpc.sql
--
-- The only way in. Every function is SECURITY DEFINER with an empty search_path, so anon can read
-- and write exactly what these allow and nothing else. The PIN guard, throttle and salt pattern is
-- ported from EventSplit's 0002_rpc_layer.sql, re-salted for this app.
--
-- Rules that live here and not in the UI: one vote per participant and round, who may reopen or
-- close a tie, a close reason of at least 10 characters, the ten-image cap, and above all that a
-- vote's sentiment never leaves the server while the proposal is open.

create extension if not exists pgcrypto with schema extensions;

-- ---- helpers ------------------------------------------------------------------------------
-- sha256("<secret>|<id>|agora-v1"): used for both the edit PIN and the device token, always
-- salted with the agora id so the same phone is a different identity in a different agora.
create or replace function agora.pin_hash(p_secret text, p_id text)
returns text language sql immutable set search_path = extensions, public as $$
  select encode(digest(p_secret || '|' || p_id || '|agora-v1', 'sha256'), 'hex');
$$;

create or replace function agora.pin_guard(p_participant uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare v_fails int; v_start timestamptz;
begin
  select fails, window_start into v_fails, v_start
    from agora.pin_attempts where participant_id = p_participant;
  if found and now() - v_start <= interval '15 minutes' and v_fails >= 10 then
    raise exception 'too many pin attempts' using errcode = 'PT429';
  end if;
end;
$$;

create or replace function agora.pin_fail(p_participant uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  insert into agora.pin_attempts (participant_id, fails, window_start)
  values (p_participant, 1, now())
  on conflict (participant_id) do update
    set fails = case when now() - agora.pin_attempts.window_start > interval '15 minutes'
                     then 1 else agora.pin_attempts.fails + 1 end,
        window_start = case when now() - agora.pin_attempts.window_start > interval '15 minutes'
                           then now() else agora.pin_attempts.window_start end;
end;
$$;

create or replace function agora.pin_ok(p_participant uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  delete from agora.pin_attempts where participant_id = p_participant;
end;
$$;

-- Whoever is calling. An unknown device token is an error, never a silent no-op.
create or replace function agora.actor(p_device_token text, p_group uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_id uuid;
begin
  select id into v_id from agora.participants
   where group_id = p_group
     and device_token_hash = agora.pin_hash(p_device_token, p_group::text);
  if v_id is null then raise exception 'unknown participant' using errcode = 'PT403'; end if;
  return v_id;
end;
$$;

create or replace function agora.group_by_slug(p_slug text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_id uuid;
begin
  select id into v_id from agora.groups where slug = p_slug;
  if v_id is null then raise exception 'unknown agora' using errcode = 'PT404'; end if;
  return v_id;
end;
$$;

create or replace function agora.log(
  p_group uuid, p_proposal uuid, p_actor uuid, p_type text, p_description text
) returns void language sql security definer set search_path = '' as $$
  insert into agora.history (group_id, proposal_id, participant_id, type, description)
  values (p_group, p_proposal, p_actor, p_type, p_description);
$$;

-- Cheap per-participant write throttle (spec §8). Counts rows already written in the window, so it
-- needs no extra bookkeeping table.
create or replace function agora.throttle(p_count int, p_max int, p_what text)
returns void language plpgsql immutable set search_path = '' as $$
begin
  if p_count >= p_max then
    raise exception 'rate limit: too many % in the last hour', p_what using errcode = 'PT429';
  end if;
end;
$$;

-- ---- quorum -------------------------------------------------------------------------------
-- Mirror of QuorumResolver.resolve in TypeScript. Both must agree; tests/sql/0002_rpc.sql and
-- tests/domain/services/QuorumResolver.test.ts check the same cases on each side.
create or replace function agora.resolve_proposal(p_proposal uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_status agora.proposal_status; v_round int; v_deadline timestamptz; v_group uuid;
  v_up int; v_down int; v_cast int; v_people int; v_next agora.proposal_status;
begin
  select status, round, deadline, group_id into v_status, v_round, v_deadline, v_group
    from agora.proposals where id = p_proposal for update;
  if v_status is distinct from 'open' then return; end if;

  select count(*) filter (where value = 'up'),
         count(*) filter (where value = 'down'),
         count(*)
    into v_up, v_down, v_cast
    from agora.votes where proposal_id = p_proposal and round = v_round;

  select count(*) into v_people from agora.participants where group_id = v_group;

  if not (v_cast >= v_people or (v_deadline is not null and now() > v_deadline)) then return; end if;

  v_next := case when v_up - v_down > 0 then 'approved'
                 when v_up - v_down < 0 then 'rejected'
                 else 'debating' end;

  update agora.proposals
     set status = v_next, resolved_at = now(), updated_at = now()
   where id = p_proposal;

  perform agora.log(v_group, p_proposal, null, 'resolved', v_next::text);
end;
$$;

-- ---- identity -----------------------------------------------------------------------------
create or replace function agora.create_group(
  p_name text, p_slug text, p_creator_name text, p_device_token text, p_pin text
) returns json language plpgsql security definer set search_path = '' as $$
declare v_group uuid; v_me uuid;
begin
  if p_pin !~ '^\d{4,6}$' then raise exception 'pin must be 4-6 digits' using errcode = 'PT400'; end if;
  if p_slug !~ '^[a-z0-9]{8}$' then raise exception 'bad slug' using errcode = 'PT400'; end if;

  begin
    insert into agora.groups (name, slug) values (p_name, p_slug) returning id into v_group;
  exception when unique_violation then
    -- The client generates the slug, so a collision is its cue to retry with another one.
    raise exception 'slug taken' using errcode = 'PT409';
  end;

  insert into agora.participants (group_id, name, device_token_hash, pin_hash)
  values (v_group, p_creator_name,
          agora.pin_hash(p_device_token, v_group::text),
          agora.pin_hash(p_pin, v_group::text))
  returning id into v_me;

  perform agora.log(v_group, null, v_me, 'agora_created', p_name);
  return json_build_object('ok', true, 'group_id', v_group, 'participant_id', v_me, 'slug', p_slug);
end;
$$;

create or replace function agora.join_group(
  p_slug text, p_name text, p_device_token text, p_pin text
) returns json language plpgsql security definer set search_path = '' as $$
declare v_group uuid; v_me uuid;
begin
  if p_pin !~ '^\d{4,6}$' then raise exception 'pin must be 4-6 digits' using errcode = 'PT400'; end if;
  v_group := agora.group_by_slug(p_slug);

  -- Same device coming back: idempotent, so a queued replay cannot create a second participant.
  select id into v_me from agora.participants
   where group_id = v_group and device_token_hash = agora.pin_hash(p_device_token, v_group::text);
  if v_me is not null then
    return json_build_object('ok', true, 'group_id', v_group, 'participant_id', v_me, 'slug', p_slug);
  end if;

  begin
    insert into agora.participants (group_id, name, device_token_hash, pin_hash)
    values (v_group, p_name,
            agora.pin_hash(p_device_token, v_group::text),
            agora.pin_hash(p_pin, v_group::text))
    returning id into v_me;
  exception when unique_violation then
    -- That name is taken: from another device it is a recovery, not a join.
    raise exception 'name taken' using errcode = 'PT409';
  end;

  perform agora.log(v_group, null, v_me, 'joined', p_name);
  return json_build_object('ok', true, 'group_id', v_group, 'participant_id', v_me, 'slug', p_slug);
end;
$$;

-- Moving an identity to another device: the PIN is what proves it, checked here and throttled.
create or replace function agora.recover_participant(
  p_slug text, p_name text, p_pin text, p_device_token text
) returns json language plpgsql security definer set search_path = '' as $$
declare v_group uuid; v_me uuid; v_hash text;
begin
  v_group := agora.group_by_slug(p_slug);
  select id, pin_hash into v_me, v_hash from agora.participants
   where group_id = v_group and lower(name) = lower(p_name);
  if v_me is null then raise exception 'unknown participant' using errcode = 'PT404'; end if;

  -- Throttled first: pin_guard only reads, so raising here loses no bookkeeping.
  perform agora.pin_guard(v_me);

  -- A wrong PIN *returns*, it does not raise. Raising would roll back the pin_fail counter in the
  -- same transaction and the throttle would never count a single failure — the exact bug this
  -- shape avoids, and the reason EventSplit's verify_event_pin returns a boolean too.
  if v_hash is null or v_hash <> agora.pin_hash(p_pin, v_group::text) then
    perform agora.pin_fail(v_me);
    return json_build_object('ok', false, 'error', 'wrong_pin');
  end if;
  perform agora.pin_ok(v_me);

  update agora.participants
     set device_token_hash = agora.pin_hash(p_device_token, v_group::text)
   where id = v_me;

  perform agora.log(v_group, null, v_me, 'recovered', p_name);
  return json_build_object('ok', true, 'group_id', v_group, 'participant_id', v_me, 'slug', p_slug);
end;
$$;

-- ---- reads --------------------------------------------------------------------------------
create or replace function agora.group_of_proposal(p_proposal uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_group uuid;
begin
  select group_id into v_group from agora.proposals where id = p_proposal;
  if v_group is null then raise exception 'unknown proposal' using errcode = 'PT404'; end if;
  return v_group;
end;
$$;

-- One builder for the full board and for a delta: p_since null means everything.
--
-- Criterion 10 is enforced right here. While a proposal is open the payload carries counts, the
-- caller's own vote and who is still missing — never anybody else's sentiment. Hiding it in the UI
-- would not count, because the JSON is what crosses the wire.
create or replace function agora.board_json(p_group uuid, p_me uuid, p_since timestamptz)
returns json language sql security definer set search_path = '' as $$
  with tallies as (
    select p.id,
           count(v.*) filter (where v.value = 'up')      as up,
           count(v.*) filter (where v.value = 'down')    as down,
           count(v.*) filter (where v.value = 'abstain') as abstain,
           count(v.*)                                    as cast_total
      from agora.proposals p
      left join agora.votes v on v.proposal_id = p.id and v.round = p.round
     where p.group_id = p_group
     group by p.id
  ),
  proposals as (
    select p.*,
           t.up, t.down, t.abstain, t.cast_total,
           t.up - t.down as net,
           case p.status when 'approved' then 0
                         when 'open' then 1 when 'debating' then 1
                         when 'completed' then 2 else 3 end as bucket
      from agora.proposals p join tallies t on t.id = p.id
     where p.group_id = p_group
  )
  select json_build_object(
    'group', (select json_build_object('id', g.id, 'slug', g.slug, 'name', g.name)
                from agora.groups g where g.id = p_group),
    'me', (select json_build_object('id', pa.id, 'name', pa.name)
             from agora.participants pa where pa.id = p_me),
    'participants', coalesce((
      select json_agg(json_build_object('id', pa.id, 'name', pa.name) order by pa.created_at)
        from agora.participants pa where pa.group_id = p_group), '[]'::json),
    'proposals', coalesce((
      select json_agg(json_build_object(
               'id', pr.id,
               'groupId', pr.group_id,
               'createdBy', pr.created_by,
               'title', pr.title,
               'description', pr.description,
               'status', pr.status,
               'round', pr.round,
               'deadline', pr.deadline,
               'closedReason', pr.closed_reason,
               'estimatedCents', pr.estimated_cents,
               'actualCents', pr.actual_cents,
               'createdAt', pr.created_at,
               'updatedAt', pr.updated_at,
               'completedAt', pr.completed_at,
               'tags', coalesce((select json_agg(tg.tag order by tg.tag)
                                   from agora.proposal_tags tg where tg.proposal_id = pr.id), '[]'::json),
               'tally', json_build_object('up', pr.up, 'down', pr.down, 'abstain', pr.abstain,
                                          'cast', pr.cast_total, 'net', pr.net),
               'myVote', (select v.value from agora.votes v
                           where v.proposal_id = pr.id and v.round = pr.round and v.participant_id = p_me),
               'votesRevealed', pr.status <> 'open',
               -- Only once the vote is over. Before that this key is null, not filtered client-side.
               'votes', case when pr.status <> 'open' then coalesce((
                          select json_agg(json_build_object('participantId', v.participant_id, 'value', v.value)
                                          order by v.created_at)
                            from agora.votes v where v.proposal_id = pr.id and v.round = pr.round), '[]'::json)
                        end,
               -- Who still has to vote: a name, never a leaning. This is what unblocks a vote.
               'pending', coalesce((
                 select json_agg(pa.id order by pa.created_at) from agora.participants pa
                  where pa.group_id = p_group
                    and not exists (select 1 from agora.votes v
                                     where v.proposal_id = pr.id and v.round = pr.round
                                       and v.participant_id = pa.id)), '[]'::json),
               'images', coalesce((
                 select json_agg(json_build_object('id', im.id, 'path', im.path, 'thumbPath', im.thumb_path,
                                                   'width', im.width, 'height', im.height, 'position', im.position)
                                 order by im.position)
                   from agora.proposal_images im where im.proposal_id = pr.id), '[]'::json),
               'shares', coalesce((
                 select json_agg(json_build_object('participantId', es.participant_id, 'optedIn', es.opted_in))
                   from agora.expense_shares es where es.proposal_id = pr.id), '[]'::json),
               'liquidations', coalesce((
                 select json_agg(json_build_object('id', ml.id, 'cents', ml.cents, 'paidBy', ml.paid_by,
                                                   'affects', ml.affects, 'paidShares', ml.paid_shares,
                                                   'createdAt', ml.created_at) order by ml.created_at)
                   from agora.manual_liquidations ml where ml.proposal_id = pr.id), '[]'::json),
               'links', coalesce((
                 select json_agg(json_build_object('toId', pl.to_id, 'kind', pl.kind))
                   from agora.proposal_links pl where pl.from_id = pr.id), '[]'::json)
             ) order by pr.bucket,
                        case when pr.bucket = 0 then -pr.net end,
                        case when pr.bucket in (0, 1) then pr.created_at end asc,
                        case when pr.bucket = 2 then pr.completed_at end desc,
                        case when pr.bucket = 3 then pr.created_at end desc,
                        pr.id)
        from proposals pr
       where p_since is null or pr.updated_at > p_since), '[]'::json),
    'threads', coalesce((
      select json_agg(json_build_object(
               'id', th.id, 'proposalId', th.proposal_id, 'authorId', th.author_id,
               'resolvedAt', th.resolved_at, 'resolvedBy', th.resolved_by, 'createdAt', th.created_at,
               'commentCount', (select count(*) from agora.comments c where c.thread_id = th.id),
               -- Capped at three: the rest is fetched when someone opens the thread (egress budget).
               'comments', coalesce((
                 select json_agg(json_build_object('id', c.id, 'authorId', c.author_id,
                                                   'body', c.body, 'createdAt', c.created_at)
                                 order by c.created_at)
                   from (select * from agora.comments c2 where c2.thread_id = th.id
                          order by c2.created_at limit 3) c), '[]'::json))
             order by th.created_at)
        from agora.comment_threads th
        join agora.proposals pr2 on pr2.id = th.proposal_id
       where pr2.group_id = p_group
         and (p_since is null or th.created_at > p_since
              or exists (select 1 from agora.comments c where c.thread_id = th.id and c.created_at > p_since))),
      '[]'::json),
    -- Capped at 50: history grows per action, and an uncapped list is what blows an egress budget.
    'history', coalesce((
      select json_agg(json_build_object('id', h.id, 'proposalId', h.proposal_id,
                                        'participantId', h.participant_id, 'type', h.type,
                                        'description', h.description, 'createdAt', h.created_at)
                      order by h.created_at desc)
        from (select * from agora.history h2 where h2.group_id = p_group
               order by h2.created_at desc limit 50) h), '[]'::json)
  );
$$;

create or replace function agora.get_board(p_slug text, p_device_token text)
returns json language plpgsql security definer set search_path = '' as $$
declare v_group uuid; v_me uuid; v_id uuid;
begin
  v_group := agora.group_by_slug(p_slug);
  v_me := agora.actor(p_device_token, v_group);
  -- Lazy resolution: a passed deadline resolves on the next read, so no scheduler is needed.
  for v_id in select id from agora.proposals
               where group_id = v_group and status = 'open' and deadline is not null and now() > deadline
  loop
    perform agora.resolve_proposal(v_id);
  end loop;
  return agora.board_json(v_group, v_me, null);
end;
$$;

create or replace function agora.get_board_since(p_slug text, p_device_token text, p_since timestamptz)
returns json language plpgsql security definer set search_path = '' as $$
declare v_group uuid; v_me uuid; v_id uuid;
begin
  v_group := agora.group_by_slug(p_slug);
  v_me := agora.actor(p_device_token, v_group);
  for v_id in select id from agora.proposals
               where group_id = v_group and status = 'open' and deadline is not null and now() > deadline
  loop
    perform agora.resolve_proposal(v_id);
  end loop;
  return agora.board_json(v_group, v_me, p_since);
end;
$$;

-- Tens of bytes: the client polls this on focus and only fetches a board when it moved.
create or replace function agora.get_board_version(p_slug text)
returns json language plpgsql security definer set search_path = '' as $$
declare v_group uuid; v_version timestamptz; v_rows bigint;
begin
  v_group := agora.group_by_slug(p_slug);
  select greatest(
           coalesce((select max(updated_at) from agora.proposals where group_id = v_group), 'epoch'),
           coalesce((select max(created_at) from agora.participants where group_id = v_group), 'epoch'),
           coalesce((select max(h.created_at) from agora.history h where h.group_id = v_group), 'epoch'))
    into v_version;
  select count(*) into v_rows from agora.proposals where group_id = v_group;
  return json_build_object('version', v_version, 'proposals', v_rows);
end;
$$;

-- ---- writes -------------------------------------------------------------------------------
create or replace function agora.create_proposal(p_device_token text, p_slug text, p_payload json)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_group uuid; v_me uuid; v_id uuid; v_recent int; v_tag text; v_tags json;
begin
  v_group := agora.group_by_slug(p_slug);
  v_me := agora.actor(p_device_token, v_group);

  select count(*) into v_recent from agora.proposals
   where created_by = v_me and created_at > now() - interval '1 hour';
  perform agora.throttle(v_recent, 20, 'proposals');

  insert into agora.proposals (group_id, created_by, title, description, deadline, estimated_cents)
  values (v_group, v_me,
          p_payload->>'title',
          coalesce(p_payload->>'description', ''),
          (p_payload->>'deadline')::timestamptz,
          (p_payload->>'estimatedCents')::int)
  returning id into v_id;

  v_tags := coalesce(p_payload->'tags', '[]'::json);
  if json_array_length(v_tags) > 12 then
    raise exception 'at most 12 tags' using errcode = 'PT400';
  end if;
  for v_tag in select json_array_elements_text(v_tags) loop
    insert into agora.proposal_tags (proposal_id, tag) values (v_id, v_tag) on conflict do nothing;
  end loop;

  perform agora.log(v_group, v_id, v_me, 'proposal_created', p_payload->>'title');
  return v_id;
end;
$$;

create or replace function agora.update_proposal(p_device_token text, p_proposal uuid, p_payload json)
returns void language plpgsql security definer set search_path = '' as $$
declare v_group uuid; v_me uuid; v_status agora.proposal_status; v_tag text; v_tags json;
begin
  v_group := agora.group_of_proposal(p_proposal);
  v_me := agora.actor(p_device_token, v_group);
  select status into v_status from agora.proposals where id = p_proposal;
  if v_status in ('completed', 'closed', 'rejected') then
    raise exception 'proposal is closed for edits' using errcode = 'PT409';
  end if;

  update agora.proposals
     set title = coalesce(p_payload->>'title', title),
         description = coalesce(p_payload->>'description', description),
         deadline = case when p_payload ? 'deadline' then (p_payload->>'deadline')::timestamptz else deadline end,
         estimated_cents = case when p_payload ? 'estimatedCents'
                                then (p_payload->>'estimatedCents')::int else estimated_cents end,
         updated_at = now()
   where id = p_proposal;

  if p_payload ? 'tags' then
    v_tags := p_payload->'tags';
    if json_array_length(v_tags) > 12 then
      raise exception 'at most 12 tags' using errcode = 'PT400';
    end if;
    delete from agora.proposal_tags where proposal_id = p_proposal;
    for v_tag in select json_array_elements_text(v_tags) loop
      insert into agora.proposal_tags (proposal_id, tag) values (p_proposal, v_tag) on conflict do nothing;
    end loop;
  end if;

  perform agora.log(v_group, p_proposal, v_me, 'proposal_edited', '');
end;
$$;

-- An upsert, so replaying a vote queued while offline can never produce a second one, and
-- changing your mind while the vote is open just overwrites it.
create or replace function agora.cast_vote(
  p_device_token text, p_proposal uuid, p_round int, p_value agora.vote_value
) returns json language plpgsql security definer set search_path = '' as $$
declare v_group uuid; v_me uuid; v_status agora.proposal_status; v_round int;
begin
  v_group := agora.group_of_proposal(p_proposal);
  v_me := agora.actor(p_device_token, v_group);
  select status, round into v_status, v_round from agora.proposals where id = p_proposal;

  if v_status <> 'open' then raise exception 'the vote is closed' using errcode = 'PT409'; end if;
  if p_round <> v_round then
    raise exception 'stale round: the vote moved on' using errcode = 'PT409';
  end if;

  insert into agora.votes (proposal_id, participant_id, round, value)
  values (p_proposal, v_me, v_round, p_value)
  on conflict (proposal_id, participant_id, round)
    do update set value = excluded.value, updated_at = now();

  -- Bumping the proposal is what lets a delta read pick the new tally up.
  update agora.proposals set updated_at = now() where id = p_proposal;
  perform agora.resolve_proposal(p_proposal);

  select status into v_status from agora.proposals where id = p_proposal;
  return json_build_object('status', v_status);
end;
$$;

create or replace function agora.reopen_proposal(p_device_token text, p_proposal uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare v_group uuid; v_me uuid; v_creator uuid; v_status agora.proposal_status;
begin
  v_group := agora.group_of_proposal(p_proposal);
  v_me := agora.actor(p_device_token, v_group);
  select created_by, status into v_creator, v_status from agora.proposals where id = p_proposal;

  if v_status <> 'debating' then raise exception 'not in debate' using errcode = 'PT409'; end if;
  if v_me <> v_creator then raise exception 'only the creator may reopen' using errcode = 'PT403'; end if;

  -- The round goes up and the old votes stay: reopening must never destroy what was decided.
  update agora.proposals
     set round = round + 1, status = 'open', resolved_at = null, updated_at = now()
   where id = p_proposal;

  perform agora.log(v_group, p_proposal, v_me, 'reopened', '');
end;
$$;

create or replace function agora.close_proposal(p_device_token text, p_proposal uuid, p_reason text)
returns void language plpgsql security definer set search_path = '' as $$
declare v_group uuid; v_me uuid; v_creator uuid; v_status agora.proposal_status;
begin
  v_group := agora.group_of_proposal(p_proposal);
  v_me := agora.actor(p_device_token, v_group);
  select created_by, status into v_creator, v_status from agora.proposals where id = p_proposal;

  if v_status <> 'debating' then raise exception 'not in debate' using errcode = 'PT409'; end if;
  if v_me <> v_creator then raise exception 'only the creator may close' using errcode = 'PT403'; end if;
  -- Criterion 4: refused here, not only by the form.
  if p_reason is null or char_length(btrim(p_reason)) < 10 then
    raise exception 'a closing reason needs at least 10 characters' using errcode = 'PT400';
  end if;

  update agora.proposals
     set status = 'closed', closed_reason = p_reason, updated_at = now()
   where id = p_proposal;

  perform agora.log(v_group, p_proposal, v_me, 'closed', p_reason);
end;
$$;

create or replace function agora.complete_proposal(
  p_device_token text, p_proposal uuid, p_actual_cents int
) returns void language plpgsql security definer set search_path = '' as $$
declare v_group uuid; v_me uuid; v_status agora.proposal_status;
begin
  v_group := agora.group_of_proposal(p_proposal);
  v_me := agora.actor(p_device_token, v_group);
  select status into v_status from agora.proposals where id = p_proposal;
  if v_status <> 'approved' then
    raise exception 'only an approved proposal can be marked done' using errcode = 'PT409';
  end if;

  update agora.proposals
     set status = 'completed', completed_at = now(), actual_cents = p_actual_cents, updated_at = now()
   where id = p_proposal;

  perform agora.log(v_group, p_proposal, v_me, 'completed', '');
end;
$$;

-- Threads and comments carry the id the client made, so a replayed queue inserts nothing twice.
create or replace function agora.add_thread(
  p_device_token text, p_thread uuid, p_proposal uuid, p_comment uuid, p_body text
) returns void language plpgsql security definer set search_path = '' as $$
declare v_group uuid; v_me uuid; v_recent int;
begin
  v_group := agora.group_of_proposal(p_proposal);
  v_me := agora.actor(p_device_token, v_group);

  select count(*) into v_recent from agora.comments
   where author_id = v_me and created_at > now() - interval '1 hour';
  perform agora.throttle(v_recent, 120, 'comments');

  insert into agora.comment_threads (id, proposal_id, author_id)
  values (p_thread, p_proposal, v_me) on conflict (id) do nothing;
  insert into agora.comments (id, thread_id, author_id, body)
  values (p_comment, p_thread, v_me, p_body) on conflict (id) do nothing;

  perform agora.log(v_group, p_proposal, v_me, 'thread_opened', '');
end;
$$;

create or replace function agora.add_comment(
  p_device_token text, p_comment uuid, p_thread uuid, p_body text
) returns void language plpgsql security definer set search_path = '' as $$
declare v_group uuid; v_me uuid; v_proposal uuid; v_recent int;
begin
  select proposal_id into v_proposal from agora.comment_threads where id = p_thread;
  if v_proposal is null then raise exception 'unknown thread' using errcode = 'PT404'; end if;
  v_group := agora.group_of_proposal(v_proposal);
  v_me := agora.actor(p_device_token, v_group);

  select count(*) into v_recent from agora.comments
   where author_id = v_me and created_at > now() - interval '1 hour';
  perform agora.throttle(v_recent, 120, 'comments');

  insert into agora.comments (id, thread_id, author_id, body)
  values (p_comment, p_thread, v_me, p_body) on conflict (id) do nothing;

  update agora.proposals set updated_at = now() where id = v_proposal;
end;
$$;

create or replace function agora.set_thread_resolved(
  p_device_token text, p_thread uuid, p_resolved boolean
) returns void language plpgsql security definer set search_path = '' as $$
declare v_group uuid; v_me uuid; v_proposal uuid; v_author uuid; v_owner uuid;
begin
  select th.proposal_id, th.author_id, pr.created_by into v_proposal, v_author, v_owner
    from agora.comment_threads th join agora.proposals pr on pr.id = th.proposal_id
   where th.id = p_thread;
  if v_proposal is null then raise exception 'unknown thread' using errcode = 'PT404'; end if;

  v_group := agora.group_of_proposal(v_proposal);
  v_me := agora.actor(p_device_token, v_group);
  if v_me <> v_author and v_me <> v_owner then
    raise exception 'only the thread author or the proposal author may resolve it' using errcode = 'PT403';
  end if;

  update agora.comment_threads
     set resolved_at = case when p_resolved then now() else null end,
         resolved_by = case when p_resolved then v_me else null end
   where id = p_thread;

  update agora.proposals set updated_at = now() where id = v_proposal;
end;
$$;

create or replace function agora.set_expense_share(
  p_device_token text, p_proposal uuid, p_opted_in boolean
) returns void language plpgsql security definer set search_path = '' as $$
declare v_group uuid; v_me uuid; v_status agora.proposal_status;
begin
  v_group := agora.group_of_proposal(p_proposal);
  v_me := agora.actor(p_device_token, v_group);
  select status into v_status from agora.proposals where id = p_proposal;
  if v_status = 'completed' then
    raise exception 'the expense is frozen once the proposal is done' using errcode = 'PT409';
  end if;

  insert into agora.expense_shares (proposal_id, participant_id, opted_in)
  values (p_proposal, v_me, p_opted_in)
  on conflict (proposal_id, participant_id) do update set opted_in = excluded.opted_in;

  update agora.proposals set updated_at = now() where id = p_proposal;
end;
$$;

create or replace function agora.add_liquidation(
  p_device_token text, p_id uuid, p_proposal uuid, p_cents int, p_affects uuid[]
) returns void language plpgsql security definer set search_path = '' as $$
declare v_group uuid; v_me uuid;
begin
  v_group := agora.group_of_proposal(p_proposal);
  v_me := agora.actor(p_device_token, v_group);

  insert into agora.manual_liquidations (id, proposal_id, cents, paid_by, affects)
  values (p_id, p_proposal, p_cents, v_me, coalesce(p_affects, '{}'))
  on conflict (id) do nothing;

  update agora.proposals set updated_at = now() where id = p_proposal;
  perform agora.log(v_group, p_proposal, v_me, 'liquidation_added', p_cents::text);
end;
$$;

create or replace function agora.set_liquidation_share_paid(
  p_device_token text, p_liquidation uuid, p_participant uuid, p_paid boolean
) returns void language plpgsql security definer set search_path = '' as $$
declare v_group uuid; v_me uuid; v_proposal uuid;
begin
  select proposal_id into v_proposal from agora.manual_liquidations where id = p_liquidation;
  if v_proposal is null then raise exception 'unknown liquidation' using errcode = 'PT404'; end if;
  v_group := agora.group_of_proposal(v_proposal);
  v_me := agora.actor(p_device_token, v_group);

  update agora.manual_liquidations
     set paid_shares = case
           when p_paid then (select array_agg(distinct x) from unnest(paid_shares || p_participant) x)
           else array_remove(paid_shares, p_participant) end
   where id = p_liquidation;

  update agora.proposals set updated_at = now() where id = v_proposal;
end;
$$;

create or replace function agora.attach_image(
  p_device_token text, p_id uuid, p_proposal uuid, p_path text, p_thumb_path text,
  p_width int, p_height int, p_bytes int
) returns void language plpgsql security definer set search_path = '' as $$
declare v_group uuid; v_me uuid; v_count int;
begin
  v_group := agora.group_of_proposal(p_proposal);
  v_me := agora.actor(p_device_token, v_group);

  select count(*) into v_count from agora.proposal_images where proposal_id = p_proposal;
  if v_count >= 10 then
    raise exception 'at most 10 images per proposal' using errcode = 'PT400';
  end if;

  insert into agora.proposal_images (id, proposal_id, path, thumb_path, width, height, bytes, position)
  values (p_id, p_proposal, p_path, p_thumb_path, p_width, p_height, p_bytes, v_count)
  on conflict (id) do nothing;

  update agora.proposals set updated_at = now() where id = p_proposal;
end;
$$;

-- Erasure (GDPR): the rows go, and the caller is told which Storage objects to delete with them.
create or replace function agora.delete_group(p_device_token text, p_slug text, p_pin text)
returns json language plpgsql security definer set search_path = '' as $$
declare v_group uuid; v_me uuid; v_hash text; v_paths json;
begin
  v_group := agora.group_by_slug(p_slug);
  v_me := agora.actor(p_device_token, v_group);
  select pin_hash into v_hash from agora.participants where id = v_me;

  perform agora.pin_guard(v_me);
  -- Same shape as recover_participant: return, so the failed attempt is actually recorded.
  if v_hash is null or v_hash <> agora.pin_hash(p_pin, v_group::text) then
    perform agora.pin_fail(v_me);
    return json_build_object('ok', false, 'error', 'wrong_pin');
  end if;
  perform agora.pin_ok(v_me);

  select coalesce(json_agg(x.path), '[]'::json) into v_paths
    from (select im.path from agora.proposal_images im
            join agora.proposals pr on pr.id = im.proposal_id where pr.group_id = v_group
          union all
          select im.thumb_path from agora.proposal_images im
            join agora.proposals pr on pr.id = im.proposal_id where pr.group_id = v_group) x;

  delete from agora.groups where id = v_group;
  return json_build_object('ok', true, 'storage_paths', v_paths);
end;
$$;

-- ---- grants -------------------------------------------------------------------------------
-- anon gets usage on the schema and execute on these functions. Nothing else, ever: no table
-- grants, and the internal helpers stay unreachable.
grant usage on schema agora to anon;

grant execute on function agora.create_group(text, text, text, text, text) to anon;
grant execute on function agora.join_group(text, text, text, text) to anon;
grant execute on function agora.recover_participant(text, text, text, text) to anon;
grant execute on function agora.get_board(text, text) to anon;
grant execute on function agora.get_board_since(text, text, timestamptz) to anon;
grant execute on function agora.get_board_version(text) to anon;
grant execute on function agora.create_proposal(text, text, json) to anon;
grant execute on function agora.update_proposal(text, uuid, json) to anon;
grant execute on function agora.cast_vote(text, uuid, int, agora.vote_value) to anon;
grant execute on function agora.reopen_proposal(text, uuid) to anon;
grant execute on function agora.close_proposal(text, uuid, text) to anon;
grant execute on function agora.complete_proposal(text, uuid, int) to anon;
grant execute on function agora.add_thread(text, uuid, uuid, uuid, text) to anon;
grant execute on function agora.add_comment(text, uuid, uuid, text) to anon;
grant execute on function agora.set_thread_resolved(text, uuid, boolean) to anon;
grant execute on function agora.set_expense_share(text, uuid, boolean) to anon;
grant execute on function agora.add_liquidation(text, uuid, uuid, int, uuid[]) to anon;
grant execute on function agora.set_liquidation_share_paid(text, uuid, uuid, boolean) to anon;
grant execute on function agora.attach_image(text, uuid, uuid, text, text, int, int, int) to anon;
grant execute on function agora.delete_group(text, text, text) to anon;

revoke all on function agora.pin_hash(text, text) from public, anon, authenticated;
revoke all on function agora.pin_guard(uuid) from public, anon, authenticated;
revoke all on function agora.pin_fail(uuid) from public, anon, authenticated;
revoke all on function agora.pin_ok(uuid) from public, anon, authenticated;
revoke all on function agora.actor(text, uuid) from public, anon, authenticated;
revoke all on function agora.group_by_slug(text) from public, anon, authenticated;
revoke all on function agora.group_of_proposal(uuid) from public, anon, authenticated;
revoke all on function agora.board_json(uuid, uuid, timestamptz) from public, anon, authenticated;
revoke all on function agora.resolve_proposal(uuid) from public, anon, authenticated;
revoke all on function agora.log(uuid, uuid, uuid, text, text) from public, anon, authenticated;
revoke all on function agora.throttle(int, int, text) from public, anon, authenticated;
