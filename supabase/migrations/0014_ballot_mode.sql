-- Whether the ballot is secret is the agora's decision, taken once.
--
-- Until now every agora worked the same way: secret while a round runs, and attributed the moment the
-- proposal resolves. That is the right default for a flatshare, where knowing who wanted what is half the
-- conversation — but it is the wrong default for a group deciding something uncomfortable, where a name
-- next to a `down` is exactly what stops people voting honestly.
--
-- So each agora chooses at creation, and **the choice cannot be changed afterwards**. Not because a setter
-- would be hard to write, but because it would be a lie: flipping an agora from secret to open would
-- retroactively publish votes cast under a promise of secrecy, and flipping it the other way would not
-- unpublish the ones already read. There is deliberately no RPC that writes this column after the insert.
--
-- On the shape of `create_group`, and on what actually keeps the live app working through this migration.
-- Two things do, and the four-argument function is neither of them:
--
--   1. **The fifth argument has no `default`.** A default would make the four-argument call the deployed
--      frontend still makes ambiguous between the two signatures, and Postgres would refuse it outright:
--      "function agora.create_group(unknown, unknown, unknown, unknown) is not unique". Agoras would be
--      uncreatable for everyone in the window between this migration and the deploy. Without a default the
--      five-argument form is not a candidate for a four-argument call at all, so four arguments resolve to
--      the four-argument form and five to the five, with nothing to disambiguate.
--   2. **The column's `default true`.** That is what makes an insert that never mentions `ballot_open`
--      mean an open ballot, so every agora that already exists — and every one the old frontend creates
--      before the deploy — stays exactly as it is today.
--
-- The four-argument `create_group` is **not** a new wrapper and is not the safeguard: it has existed since
-- 0006:104 and has been granted to `anon` since 0006:169. What happens below is a `create or replace` of
-- it, and the only reason to do that is hygiene — one insert body instead of two that drift apart the
-- first time the insert changes. Deleting that replacement would leave 0006's body in place and the live
-- app working, which is precisely why it cannot be the thing protecting anybody.
--
-- So, for whoever revisits this: the no-default discipline is the safeguard. Do not relax it on the
-- grounds that the four-argument form is there to catch it. The four-argument form can be dropped in a
-- later migration, once nobody has the old bundle in cache, and that changes nothing about point 1.

alter table agora.groups
  add column if not exists ballot_open boolean not null default true;

comment on column agora.groups.ballot_open is
  'Whether a vote is published with its voter''s name once the proposal resolves. Chosen when the agora is created and never changed: changing it would retroactively publish votes cast under a promise of secrecy. When false, board_json omits participantId from votes entirely and orders them by a key uncorrelated with time.';

-- The real one. Five arguments, no default.
create or replace function agora.create_group(
  p_name text, p_slug text, p_creator_name text, p_device_token text, p_ballot_open boolean
) returns json language plpgsql security definer set search_path = '' as $$
declare v_group uuid; v_me uuid;
begin
  if p_slug !~ '^[a-z0-9]{8}$' then raise exception 'bad slug' using errcode = 'PT400'; end if;
  if char_length(btrim(p_name)) = 0 then
    raise exception 'an agora needs a name' using errcode = 'PT400';
  end if;

  begin
    insert into agora.groups (name, slug, ballot_open)
    values (btrim(p_name), p_slug, p_ballot_open)
    returning id into v_group;
  exception when unique_violation then
    raise exception 'slug taken' using errcode = 'PT409';
  end;

  insert into agora.participants (group_id, name, device_token_hash)
  values (v_group, btrim(p_creator_name), agora.token_hash(p_device_token, v_group::text))
  returning id into v_me;

  perform agora.log(v_group, null, v_me, 'agora_created', btrim(p_name));
  return json_build_object('ok', true, 'group_id', v_group, 'participant_id', v_me, 'slug', p_slug);
end;
$$;

-- The four-argument form the deployed frontend calls. It already existed (0006:104) and is already
-- granted to anon (0006:169); this is a `create or replace` of it, for hygiene alone — so there is one
-- insert body rather than two that drift. It is not what keeps the old frontend working: the absence of
-- a default on the fifth argument is, together with the column's own `default true`. See the header.
create or replace function agora.create_group(
  p_name text, p_slug text, p_creator_name text, p_device_token text
) returns json language sql security definer set search_path = '' as $$
  select agora.create_group(p_name, p_slug, p_creator_name, p_device_token, true);
$$;

-- board_json is the one definition (get_board and get_board_since are thin wrappers over it),
-- copied whole from 0012 with two changes and nothing else: the group object carries the mode,
-- and the votes array respects it.
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
           g.ballot_open,
           -- Whether everybody entitled to vote actually did. A proposal that resolves on its
           -- deadline resolves on a *partial* ballot, and that is the difference this whole
           -- redaction turns on.
           --
           -- Counted against the roster **as it was when the proposal closed**, which is what
           -- `resolve_proposal` itself counted. Against today's roster instead, `add_participant`
           -- retracts a reveal that already happened: the votes were published, somebody joins, and
           -- the same proposal goes back to grey. Worse than odd — `add_participant` bumps
           -- `board_version` without touching `proposals.updated_at`, so the delta carries the new
           -- roster and no proposals, and a device that already had the board keeps showing the
           -- reveal for ever while a fresh device shows stone. Two live clients, permanently
           -- disagreeing about whether a secret ballot was published.
           --
           -- `resolved_at` is null for a proposal the creator closed by hand, which never went
           -- through `resolve_proposal`; `updated_at` is that closure's own timestamp, and for an
           -- open proposal neither is consulted because `status = 'open'` gates all three readers.
           t.cast_total >= (select count(*) from agora.participants pa
                             where pa.group_id = p_group
                               and pa.created_at <= coalesce(p.resolved_at, p.updated_at))
             as complete,
           case p.status when 'approved' then 0
                         when 'open' then 1 when 'debating' then 1
                         when 'completed' then 2 else 3 end as bucket
      from agora.proposals p
      join tallies t on t.id = p.id
      join agora.groups g on g.id = p.group_id
     where p.group_id = p_group
  )
  select json_build_object(
    'version', agora.board_version(p_group),
    'group', (select json_build_object('id', g.id, 'slug', g.slug, 'name', g.name,
                                       'ballotOpen', g.ballot_open)
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
               -- The count is public, the breakdown is not — while a secret round is open.
               --
               -- `pending` names everyone who has not voted yet, deliberately: it is what unblocks a
               -- stalled round. So a running breakdown by sense is not an aggregate at all. Read the
               -- board between two votes and difference them, and the number that moved names the
               -- sense while the name that left `pending` names the voter; three reads reconstruct an
               -- entire secret ballot. `cast` alone cannot do that — it says somebody voted, which is
               -- the same thing `pending` already says, and nothing about which way.
               --
               -- The keys stay put and go to zero rather than disappearing: the payload has one shape,
               -- and a client that has to ask whether a key exists is a client that will one day
               -- forget to. Once the proposal leaves 'open' the real breakdown is published in both
               -- modes — that is the moment the senses become public — so this redaction never
               -- outlives the round it protects.
               'tally', case when pr.ballot_open or (pr.status <> 'open' and pr.complete)
                          then json_build_object('up', pr.up, 'down', pr.down, 'abstain', pr.abstain,
                                                 'cast', pr.cast_total, 'net', pr.net)
                          else json_build_object('up', 0, 'down', 0, 'abstain', 0,
                                                 'cast', pr.cast_total, 'net', 0) end,
               'myVote', (select v.value from agora.votes v
                           where v.proposal_id = pr.id and v.round = pr.round and v.participant_id = p_me),
               -- Revealed means revealed. In a secret agora a partial ballot is never published
               -- (see `votes` below), so this says false there and every reader of it — the net
               -- line on the card, the export — follows without being told twice.
               'votesRevealed', pr.status <> 'open' and (pr.ballot_open or pr.complete),
               -- Only once the vote is over. Before that this key is null, not filtered client-side.
               -- What being over reveals is the agora's choice, made when it was created. With an open
               -- ballot the payload attributes each vote and the UI prints the names, and cast order is
               -- deliberate: it leaks nothing that same payload does not already publish. With a secret
               -- ballot there is no participantId to leak, so the order becomes the leak — `pending`
               -- already names who has not voted, so anyone who watched the board during the round could
               -- read a chronological reveal back onto people. Hence v.id, a v4 uuid uncorrelated with
               -- time (0001:80), as the ordering key there. The two order keys are mutually exclusive by
               -- construction: for a given agora exactly one of them is ever non-null.
               --
               -- And a secret agora publishes nothing at all unless the ballot is complete. Stripping
               -- the names is enough only while the set of people who voted is unknown, and it is not:
               -- `pending` names the non-voters all through the round, on screen, to everyone. Anybody
               -- who opened the board once before the deadline holds that list; when the deadline then
               -- resolves a partial ballot, the reveal they get is exactly the votes of exactly the
               -- people that list left over. Two reads, no special access, names and votes paired. So
               -- the reveal waits for `complete`, which is what quorum means — everybody voted, so the
               -- voter set is the whole group and there is nothing left to subtract. The cost is real
               -- and deliberate: a secret proposal that dies on its deadline keeps its votes for ever.
               'votes', case when pr.status <> 'open' and (pr.ballot_open or pr.complete)
                        then coalesce((
                          select json_agg(case when pr.ballot_open
                                            then json_build_object('participantId', v.participant_id, 'value', v.value)
                                            else json_build_object('value', v.value) end
                                          order by case when pr.ballot_open then v.created_at end,
                                                   case when pr.ballot_open then null else v.id end)
                            from agora.votes v
                           where v.proposal_id = pr.id and v.round = pr.round), '[]'::json)
                        end,
               -- Who still has to vote: a name, never a leaning. This is what unblocks a vote — and
               -- it is a name and not a leaning only for as long as no vote data travels beside it.
               --
               -- A proposal that resolves because its deadline passed resolves on a *partial* ballot,
               -- and then the reveal and this list are in the same payload: `participants` minus
               -- `pending` is the set of people who voted, and if that set has one member and the
               -- reveal has one value, the secret ballot has just published a name and a vote. Two of
               -- three voting the same way names both at once. So in a secret agora the list stops
               -- once the proposal does. Nothing on screen misses it: both readers of `pending` are
               -- already inside a `status === 'open'` guard, because a list of who still has to vote
               -- is meaningless once nobody can. An open agora keeps it — there the names are
               -- published beside the votes anyway, which is what that mode is.
               'pending', case when pr.ballot_open or pr.status = 'open'
                            then coalesce((
                              select json_agg(pa.id order by pa.created_at) from agora.participants pa
                               where pa.group_id = p_group
                                 and not exists (select 1 from agora.votes v
                                                  where v.proposal_id = pr.id and v.round = pr.round
                                                    and v.participant_id = pa.id)), '[]'::json)
                            else '[]'::json end,
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

-- The verdict was the last field still carrying the sense.
--
-- `resolve_proposal` decides from `v_up - v_down` alone, so with one vote cast the outcome *is* that
-- person's vote: up gives 'approved', down gives 'rejected', abstain gives 'debating'. The board
-- names the single voter through `pending` all through the round, so an observer who looked once
-- reads the verdict straight back onto them. Withholding the votes array and the breakdown, as this
-- migration already does, left that one field publishing the same fact in a different shape — and at
-- `cast = 1` there is no way to publish the outcome and withhold the vote, because they are the same
-- fact.
--
-- So: in a secret agora, a proposal that closes without a complete ballot closes **undecided**. The
-- rule that falls out is better than the one it replaces. A secret agora decides when the whole
-- group has voted, and a deadline arriving first closes the proposal without a decision — where
-- before it would approve a flatshare's spending on one vote out of four while announcing which way
-- that one person voted. The open mode is untouched: it keeps deciding on a partial ballot and
-- publishing the names, which is 0.22.0's behaviour and what the spec pins.
--
-- Note the quorum test is `v_cast >= v_people`: everybody, not a majority. Copy of 0002:104-127 with
-- the ballot mode read and one branch added; nothing else changed.
create or replace function agora.resolve_proposal(p_proposal uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_status agora.proposal_status; v_round int; v_deadline timestamptz; v_group uuid;
  v_up int; v_down int; v_cast int; v_people int; v_next agora.proposal_status;
  v_ballot_open boolean;
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
  select ballot_open into v_ballot_open from agora.groups where id = v_group;

  if not (v_cast >= v_people or (v_deadline is not null and now() > v_deadline)) then return; end if;

  v_next := case when v_up - v_down > 0 then 'approved'
                 when v_up - v_down < 0 then 'rejected'
                 else 'debating' end;

  -- The one branch. An incomplete secret ballot yields no verdict, because the verdict would be the
  -- ballot. 'debating' is the existing "closed without deciding" state, which is what this is.
  if not v_ballot_open and v_cast < v_people then
    v_next := 'debating';
  end if;

  update agora.proposals
     set status = v_next, resolved_at = now(), updated_at = now()
   where id = p_proposal;

  perform agora.log(v_group, p_proposal, null, 'resolved', v_next::text);
end;
$$;
revoke all on function agora.resolve_proposal(uuid) from public, anon, authenticated;

grant execute on function agora.create_group(text, text, text, text, boolean) to anon;
grant execute on function agora.create_group(text, text, text, text) to anon;
