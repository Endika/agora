-- The cached snapshot has to know its own version, or the client needs a second call to find out
-- what it already has. One expression, shared by the board payload and the cheap probe.

create or replace function agora.board_version(p_group uuid)
returns timestamptz language sql security definer set search_path = '' as $$
  select greatest(
    coalesce((select max(updated_at) from agora.proposals where group_id = p_group), 'epoch'),
    coalesce((select max(created_at) from agora.participants where group_id = p_group), 'epoch'),
    coalesce((select max(created_at) from agora.history where group_id = p_group), 'epoch'));
$$;
revoke all on function agora.board_version(uuid) from public, anon, authenticated;

create or replace function agora.get_board_version(p_slug text)
returns json language plpgsql security definer set search_path = '' as $$
declare v_group uuid;
begin
  v_group := agora.group_by_slug(p_slug);
  return json_build_object(
    'version', agora.board_version(v_group),
    'proposals', (select count(*) from agora.proposals where group_id = v_group));
end;
$$;

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
