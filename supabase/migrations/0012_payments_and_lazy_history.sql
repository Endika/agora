-- Two changes that came from using the thing.
--
-- 1. **The expense made no sense.** "Am I in?" and "record a payment" were two unrelated mechanics, and
--    neither answered the only question a group asks: how much of *my* share is left. A payment is now
--    simply money you put in, counted against your share of the total. The manual-liquidation machinery
--    ported from EventSplit (a payment split among an `affects` list with ticked `paid_shares`) modelled a
--    different problem and is dropped rather than left around to confuse the next reader.
--
-- 2. **History was loaded on every read.** It is the field that grows per action, so shipping the last 50
--    rows with every board was paying egress for something almost nobody opens. It now has its own call.

create table if not exists agora.payments (
  id             uuid        primary key,
  proposal_id    uuid        not null references agora.proposals(id) on delete cascade,
  participant_id uuid        not null references agora.participants(id) on delete cascade,
  cents          int         not null check (cents > 0 and cents <= 99999999),
  created_at     timestamptz not null default now()
);
create index if not exists payments_proposal_idx on agora.payments (proposal_id, created_at);

alter table agora.payments enable row level security;
revoke all on agora.payments from anon, authenticated;

comment on table agora.payments is
  'Money a participant has put in towards their share of a proposal. Financial record the group revisits; erased with the agora.';

-- You record your own payments: "I put in 100". Recording somebody else's would be a claim about them.
create or replace function agora.add_payment(
  p_device_token text, p_id uuid, p_proposal uuid, p_cents int
) returns void language plpgsql security definer set search_path = '' as $$
declare v_group uuid; v_me uuid;
begin
  v_group := agora.group_of_proposal(p_proposal);
  v_me := agora.actor(p_device_token, v_group);
  if p_cents is null or p_cents <= 0 then
    raise exception 'a payment needs an amount' using errcode = 'PT400';
  end if;

  insert into agora.payments (id, proposal_id, participant_id, cents)
  values (p_id, p_proposal, v_me, p_cents)
  on conflict (id) do nothing;

  update agora.proposals set updated_at = now() where id = p_proposal;
  perform agora.log(v_group, p_proposal, v_me, 'payment_added', p_cents::text);
end;
$$;

-- Typos happen, and only to your own.
create or replace function agora.remove_payment(p_device_token text, p_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare v_group uuid; v_me uuid; v_proposal uuid; v_owner uuid;
begin
  select proposal_id, participant_id into v_proposal, v_owner from agora.payments where id = p_id;
  if v_proposal is null then raise exception 'unknown payment' using errcode = 'PT404'; end if;
  v_group := agora.group_of_proposal(v_proposal);
  v_me := agora.actor(p_device_token, v_group);
  if v_me <> v_owner then
    raise exception 'only your own payments' using errcode = 'PT403';
  end if;

  delete from agora.payments where id = p_id;
  update agora.proposals set updated_at = now() where id = v_proposal;
end;
$$;

-- History, on demand.
create or replace function agora.get_history(p_slug text, p_device_token text, p_limit int)
returns json language plpgsql security definer set search_path = '' as $$
declare v_group uuid;
begin
  v_group := agora.group_by_slug(p_slug);
  perform agora.actor(p_device_token, v_group);
  return coalesce((
    select json_agg(json_build_object('id', h.id, 'proposalId', h.proposal_id,
                                      'participantId', h.participant_id, 'type', h.type,
                                      'description', h.description, 'createdAt', h.created_at)
                    order by h.created_at desc)
      from (select * from agora.history where group_id = v_group
             order by created_at desc limit least(coalesce(p_limit, 50), 200)) h), '[]'::json);
end;
$$;

grant execute on function agora.add_payment(text, uuid, uuid, int) to anon;
grant execute on function agora.remove_payment(text, uuid) to anon;
grant execute on function agora.get_history(text, text, int) to anon;

drop function if exists agora.add_liquidation(text, uuid, uuid, int, uuid[]);
drop function if exists agora.set_liquidation_share_paid(text, uuid, uuid, boolean);
drop table if exists agora.manual_liquidations;

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
    'version', agora.board_version(p_group),
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
               'payments', coalesce((
                 select json_agg(json_build_object('id', pay.id, 'participantId', pay.participant_id,
                                                   'cents', pay.cents, 'createdAt', pay.created_at)
                                 order by pay.created_at)
                   from agora.payments pay where pay.proposal_id = pr.id), '[]'::json),
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
         -- updated_at, not created_at: resolving a thread changes neither its creation time nor its
         -- comments, and a delta that misses it leaves the cached board showing it open for ever.
         and (p_since is null or th.updated_at > p_since
              or exists (select 1 from agora.comments c where c.thread_id = th.id and c.created_at > p_since))),
      '[]'::json),
    -- History is not here on purpose: it grows per action, and shipping 50 rows with every board read was
    -- paying egress for something almost nobody opens. get_history serves it when somebody asks.
    'history', '[]'::json
  );
$$;
