-- Each agora chooses at creation whether its ballot is secret for ever or open once a proposal
-- resolves. The choice is made once and there is no way back: flipping it later would retroactively
-- publish votes cast under a promise of secrecy. These are the server-side guarantees behind that
-- promise, asserted on the payload rather than on anything the UI chooses to draw.

-- The four-argument call the live frontend makes keeps working, and keeps meaning "open".
do $$
declare v_open boolean; v_defaults int;
begin
  -- The moment a fifth argument gains a `default`, this very call becomes ambiguous between the two
  -- signatures and Postgres refuses it. That is the production breakage — agoras uncreatable in the
  -- window between this migration and the new frontend — that this block exists to catch.
  perform agora.create_group('Legacy agora', 'ballot01', 'alice', 'tok-a1');
  select ballot_open into v_open from agora.groups where slug = 'ballot01';
  if v_open is not true then
    raise exception 'FAIL: the four-argument wrapper did not leave the ballot open (got %)', v_open;
  end if;

  -- And the same thing said directly, so the reason is on record and not just the symptom.
  if to_regprocedure('agora.create_group(text, text, text, text, boolean)') is null then
    raise exception 'FAIL: there is no five-argument agora.create_group';
  end if;
  select p.pronargdefaults into v_defaults from pg_proc p
   where p.oid = to_regprocedure('agora.create_group(text, text, text, text, boolean)');
  if v_defaults is distinct from 0 then
    raise exception 'FAIL: the five-argument create_group has % default(s), which makes a four-argument call ambiguous', v_defaults;
  end if;

  -- Both forms are reachable from the client role, or one of the two frontends cannot create.
  if not has_function_privilege('anon', 'agora.create_group(text, text, text, text)', 'execute')
     or not has_function_privilege('anon', 'agora.create_group(text, text, text, text, boolean)', 'execute') then
    raise exception 'FAIL: anon cannot call both forms of create_group';
  end if;

  raise notice 'PASS the four-argument create_group still resolves and still means an open ballot';
end $$;

-- Choosing secrecy is a fifth argument, positional or named — PostgREST sends it named.
do $$
declare v_open boolean;
begin
  perform agora.create_group('Secret agora', 'ballot02', 'alice', 'tok-a2', false);
  select ballot_open into v_open from agora.groups where slug = 'ballot02';
  if v_open is not false then
    raise exception 'FAIL: p_ballot_open => false did not make the ballot secret (got %)', v_open;
  end if;

  perform agora.create_group('Named agora', 'ballot03', 'alice', 'tok-a3', p_ballot_open => false);
  select ballot_open into v_open from agora.groups where slug = 'ballot03';
  if v_open is not false then
    raise exception 'FAIL: named notation did not make the ballot secret (got %)', v_open;
  end if;

  perform agora.create_group('Open agora', 'ballot04', 'alice', 'tok-a4', p_ballot_open => true);
  select ballot_open into v_open from agora.groups where slug = 'ballot04';
  if v_open is not true then
    raise exception 'FAIL: p_ballot_open => true did not leave the ballot open (got %)', v_open;
  end if;

  raise notice 'PASS an agora is created secret or open and the column records which';
end $$;

-- The invariant: in a secret agora a resolved proposal ships no attribution at all.
do $$
declare v_prop uuid; v_board json; v_votes json; v_text text; i int;
        v_order text[]; v_by_id text[]; v_by_time text[];
begin
  perform agora.create_group('Secret board', 'ballot05', 'alice', 'tok-a5', false);
  perform agora.add_participant('ballot05', 'bob', 'tok-b5');
  perform agora.add_participant('ballot05', 'carol', 'tok-c5');
  perform agora.add_participant('ballot05', 'dave', 'tok-d5');
  -- No amount and no payment on purpose: `shares` and `payments` carry a participantId of their own,
  -- so the whole-payload check below would say nothing with a priced proposal in the agora.
  v_prop := agora.create_proposal('tok-a5', 'ballot05', json_build_object('title', 'Buy a projector'));

  perform agora.cast_vote('tok-a5', v_prop, 1, 'up');
  perform agora.cast_vote('tok-b5', v_prop, 1, 'up');
  perform agora.cast_vote('tok-c5', v_prop, 1, 'up');
  perform agora.cast_vote('tok-d5', v_prop, 1, 'abstain');
  if coalesce((select status::text from agora.proposals where id = v_prop), 'open') = 'open' then
    raise exception 'FAIL: the proposal did not resolve, so this proves nothing about a resolved one';
  end if;

  v_board := agora.get_board('ballot05', 'tok-a5');
  v_text := v_board::text;
  -- The point of the feature, on the payload: never sent, not hidden client-side.
  if v_text like '%participantId%' then
    raise exception 'FAIL: a secret agora published attribution: %', v_text;
  end if;

  -- The votes themselves are still there, they just have no name on them.
  v_votes := v_board->'proposals'->0->'votes';
  if json_array_length(v_votes) is distinct from 4 then
    raise exception 'FAIL: a secret ballot lost its votes (got %)', v_votes;
  end if;
  for i in 0..3 loop
    if (v_votes->i->>'value') is null then
      raise exception 'FAIL: a secret vote lost its value';
    end if;
    if jsonb_exists((v_votes->i)::jsonb, 'participantId') then
      raise exception 'FAIL: a secret vote carries a participantId key';
    end if;
  end loop;
  if (v_board->'proposals'->0->>'votesRevealed') is distinct from 'true' then
    raise exception 'FAIL: the tally is still revealed in a secret agora, only the names are not';
  end if;
  -- Your own vote is yours to see: it is the only one the client may attribute.
  if (v_board->'proposals'->0->>'myVote') is distinct from 'up' then
    raise exception 'FAIL: myVote went missing in a secret agora';
  end if;

  -- Stripping the name is not enough: `pending` names the people who have not voted yet, so anyone
  -- watching the board during the round can pair a chronological reveal back onto them. The reveal
  -- must therefore be ordered by something uncorrelated with time, and v.id is a v4 uuid.
  --
  -- now() is frozen inside this transaction, so the four votes share one instant and any order would
  -- look right. The fixture is forced instead: values assigned by id order, cast times in the exact
  -- reverse. The two orders now disagree, so reading them apart is the whole assertion.
  with ranked as (
    select v.id, row_number() over (order by v.id) as r
      from agora.votes v where v.proposal_id = v_prop and v.round = 1)
  update agora.votes v
     set value = (array['up', 'up', 'up', 'abstain']::agora.vote_value[])[ranked.r],
         created_at = now() + (5 - ranked.r) * interval '1 minute'
    from ranked where ranked.id = v.id;

  select array_agg(v.value::text order by v.id) into v_by_id
    from agora.votes v where v.proposal_id = v_prop and v.round = 1;
  select array_agg(v.value::text order by v.created_at) into v_by_time
    from agora.votes v where v.proposal_id = v_prop and v.round = 1;
  if v_by_id is not distinct from v_by_time then
    raise exception 'FAIL: the fixture is degenerate, both orders read the same and prove nothing';
  end if;

  v_board := agora.get_board('ballot05', 'tok-a5');
  select array_agg(e->>'value' order by ord) into v_order
    from json_array_elements(v_board->'proposals'->0->'votes') with ordinality as t(e, ord);
  if v_order is not distinct from v_by_time then
    raise exception 'FAIL: a secret reveal is in cast order, which hands the names back: %', v_order;
  end if;
  if v_order is distinct from v_by_id then
    raise exception 'FAIL: expected a secret reveal ordered by vote id, got % want %', v_order, v_by_id;
  end if;

  raise notice 'PASS a secret agora reveals unattributed votes, out of cast order';
end $$;

-- And in an open agora nothing changed: attribution and cast order are what it published before.
do $$
declare v_prop uuid; v_board json; v_votes json; v_ids text[];
        v_order text[]; v_by_id text[]; v_by_time text[];
begin
  perform agora.create_group('Open board', 'ballot06', 'alice', 'tok-a6', true);
  perform agora.add_participant('ballot06', 'bob', 'tok-b6');
  perform agora.add_participant('ballot06', 'carol', 'tok-c6');
  perform agora.add_participant('ballot06', 'dave', 'tok-d6');
  v_prop := agora.create_proposal('tok-a6', 'ballot06', json_build_object('title', 'Buy a projector'));

  perform agora.cast_vote('tok-a6', v_prop, 1, 'up');
  perform agora.cast_vote('tok-b6', v_prop, 1, 'up');
  perform agora.cast_vote('tok-c6', v_prop, 1, 'up');
  perform agora.cast_vote('tok-d6', v_prop, 1, 'abstain');

  v_board := agora.get_board('ballot06', 'tok-a6');
  if v_board::text not like '%participantId%' then
    raise exception 'FAIL: an open agora stopped attributing its votes';
  end if;

  v_votes := v_board->'proposals'->0->'votes';
  if json_array_length(v_votes) is distinct from 4 then
    raise exception 'FAIL: an open ballot lost its votes (got %)', v_votes;
  end if;
  select array_agg(distinct e->>'participantId') into v_ids
    from json_array_elements(v_votes) e;
  if array_length(v_ids, 1) is distinct from 4 or v_ids @> array[null]::text[] then
    raise exception 'FAIL: expected one attributed vote per participant, got %', v_ids;
  end if;
  if not (select bool_and(exists (select 1 from agora.participants pa where pa.id::text = t.voter))
            from unnest(v_ids) as t(voter)) then
    raise exception 'FAIL: an attributed vote names somebody who is not a participant';
  end if;

  -- Same forced fixture as the secret block, asserting the opposite: with an open ballot the reveal
  -- names everybody anyway, so cast order leaks nothing and stays the order the group reads it in.
  with ranked as (
    select v.id, row_number() over (order by v.id) as r
      from agora.votes v where v.proposal_id = v_prop and v.round = 1)
  update agora.votes v
     set value = (array['up', 'up', 'up', 'abstain']::agora.vote_value[])[ranked.r],
         created_at = now() + (5 - ranked.r) * interval '1 minute'
    from ranked where ranked.id = v.id;

  select array_agg(v.value::text order by v.id) into v_by_id
    from agora.votes v where v.proposal_id = v_prop and v.round = 1;
  select array_agg(v.value::text order by v.created_at) into v_by_time
    from agora.votes v where v.proposal_id = v_prop and v.round = 1;
  if v_by_id is not distinct from v_by_time then
    raise exception 'FAIL: the fixture is degenerate, both orders read the same and prove nothing';
  end if;

  v_board := agora.get_board('ballot06', 'tok-a6');
  select array_agg(e->>'value' order by ord) into v_order
    from json_array_elements(v_board->'proposals'->0->'votes') with ordinality as t(e, ord);
  if v_order is distinct from v_by_time then
    raise exception 'FAIL: an open reveal left cast order, got % want %', v_order, v_by_time;
  end if;

  raise notice 'PASS an open agora still attributes every vote and still reveals them in cast order';
end $$;

-- The mode travels with the board, because the client cannot draw the difference without it.
do $$
declare v_board json;
begin
  perform agora.create_group('Flag open', 'ballot07', 'alice', 'tok-a7', true);
  perform agora.create_group('Flag secret', 'ballot08', 'alice', 'tok-a8', false);

  v_board := agora.get_board('ballot07', 'tok-a7');
  if (v_board->'group'->>'ballotOpen') is distinct from 'true' then
    raise exception 'FAIL: the board does not say an open agora is open (got %)', v_board->'group';
  end if;

  v_board := agora.get_board('ballot08', 'tok-a8');
  if (v_board->'group'->>'ballotOpen') is distinct from 'false' then
    raise exception 'FAIL: the board does not say a secret agora is secret (got %)', v_board->'group';
  end if;

  -- The delta read is the same board, so it has to carry the flag too.
  v_board := agora.get_board_since('ballot08', 'tok-a8', now() - interval '1 second');
  if (v_board->'group'->>'ballotOpen') is distinct from 'false' then
    raise exception 'FAIL: the delta read dropped the ballot mode';
  end if;

  raise notice 'PASS the board carries the ballot mode in both modes, full read and delta';
end $$;

-- There is no way to change it, and that is checked against the catalogue rather than by reading
-- the migrations: a setter added later would have to be added here too before this goes green.
do $$
declare v_offenders text;
begin
  select string_agg(p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')', ', ')
    into v_offenders
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'agora'
     and p.proname <> 'create_group'
     and (p.proname like '%ballot%'
          or exists (select 1 from unnest(coalesce(p.proargnames, array[]::text[])) a
                      where a like '%ballot%'));
  if v_offenders is not null then
    raise exception 'FAIL: the ballot mode can be changed after creation, via %', v_offenders;
  end if;

  -- And no overload of create_group sets it on an agora that already exists: the only two forms are
  -- the real one and the wrapper that fills it in.
  if (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
       where n.nspname = 'agora' and p.proname = 'create_group') is distinct from 2 then
    raise exception 'FAIL: expected exactly two create_group forms, the five-argument one and its wrapper';
  end if;

  raise notice 'PASS nothing in the schema can change a ballot mode once it is chosen';
end $$;
