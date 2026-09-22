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
declare v_prop uuid; v_board json; v_delta json; v_votes json; v_text text; i int;
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

  -- The delta read is the same board_json, but the promise has to hold on the payload the client
  -- actually receives most of the time, so it is pinned here rather than left to inheritance.
  v_delta := agora.get_board_since('ballot05', 'tok-a5', now() - interval '1 second');
  if v_delta::text like '%participantId%' then
    raise exception 'FAIL: the delta read of a secret agora published attribution: %', v_delta;
  end if;
  if json_array_length(v_delta->'proposals'->0->'votes') is distinct from 4 then
    raise exception 'FAIL: the delta lost the secret votes (got %)', v_delta->'proposals'->0->'votes';
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
  if array_length(v_ids, 1) is distinct from 4 then
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

-- There is no way to change it, and that is checked against the catalogue rather than by reading the
-- migrations. The predicate is write-shaped, not name-shaped: what makes a function dangerous is that it
-- updates the column, not that somebody called it "ballot". A name-based scan misses
-- `set_group_mode(p_slug, p_open)` entirely, and this block proves it does not by writing exactly that
-- function and watching the check catch it.
do $$
declare v_offenders text;
begin
  -- `update agora.groups … ballot_open`, in the body of any agora function. board_json reads the column
  -- and create_group inserts it; neither is a way to change an agora's mind after the fact.
  select string_agg(p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')', ', ')
    into v_offenders
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'agora'
     and p.prosrc ~* 'update[[:space:]]+agora\.groups[^;]*ballot_open';
  if v_offenders is not null then
    raise exception 'FAIL: the ballot mode can be changed after creation, via %', v_offenders;
  end if;

  -- And the check has teeth: the obvious setter, written here and rolled back with the transaction.
  create function agora.set_group_mode(p_slug text, p_open boolean) returns void
  language sql security definer set search_path = '' as $f$
    update agora.groups set ballot_open = p_open where slug = p_slug;
  $f$;

  select string_agg(p.proname, ', ') into v_offenders
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'agora'
     and p.prosrc ~* 'update[[:space:]]+agora\.groups[^;]*ballot_open';
  if v_offenders is distinct from 'set_group_mode' then
    raise exception 'FAIL: a setter that flips the column went unnoticed (offenders: %)', v_offenders;
  end if;
  drop function agora.set_group_mode(text, boolean);

  -- And no overload of create_group sets it on an agora that already exists: the only two forms are the
  -- five-argument one and the four-argument one it replaced.
  if (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
       where n.nspname = 'agora' and p.proname = 'create_group') is distinct from 2 then
    raise exception 'FAIL: expected exactly two create_group forms, the five-argument one and the four';
  end if;

  raise notice 'PASS nothing in the schema can change a ballot mode once it is chosen';
end $$;

-- The attack the running tally made possible: a secret agora leaks the whole ballot, with names, to
-- anyone who simply reads the board between votes. `pending` says who has not voted yet — by design,
-- it is what unblocks a stalled round — so if the breakdown by sense moves when somebody's name
-- leaves that list, the two together name the voter and the vote. Three reads reconstruct everything.
--
-- The assertion is therefore indistinguishability, not "the numbers are zero": two secret agoras set
-- up identically, where the one voter votes `up` in the first and `down` in the second, must hand an
-- observer payloads that cannot be told apart. If the payload cannot distinguish them, no observer can.
do $$
declare v_prop uuid; v_slug text; v_sense text; v_tallies text[] := '{}'; v_casts text[] := '{}';
        v_before json; v_after json; v_board json;
begin
  foreach v_sense in array array['up', 'down', 'abstain'] loop
    v_slug := 'ballot1' || (array_position(array['up', 'down', 'abstain'], v_sense))::text;
    perform agora.create_group('Poll me', v_slug, 'alice', 'tok-a' || v_slug, false);
    perform agora.add_participant(v_slug, 'bob', 'tok-b' || v_slug);
    perform agora.add_participant(v_slug, 'carol', 'tok-c' || v_slug);
    v_prop := agora.create_proposal('tok-a' || v_slug, v_slug, json_build_object('title', 'Paint it'));

    -- Alice is the observer and never votes, so the round stays open and she stays in `pending`.
    if v_sense = 'up' then
      v_before := agora.get_board(v_slug, 'tok-a' || v_slug)->'proposals'->0;
    end if;

    perform agora.cast_vote('tok-b' || v_slug, v_prop, 1, v_sense::agora.vote_value);
    if (select status::text from agora.proposals where id = v_prop) is distinct from 'open' then
      raise exception 'FAIL: the round closed early, so this proves nothing about an open one';
    end if;

    v_board := agora.get_board(v_slug, 'tok-a' || v_slug);
    v_tallies := v_tallies || (v_board->'proposals'->0->'tally')::text;
    v_casts := v_casts || (v_board->'proposals'->0->'tally'->>'cast');
    if v_sense = 'up' then
      v_after := v_board->'proposals'->0;
    end if;
  end loop;

  -- Up, down and abstain must be one and the same payload to anybody watching.
  if v_tallies[1] is distinct from v_tallies[2] or v_tallies[1] is distinct from v_tallies[3] then
    raise exception 'FAIL: an open round in a secret agora tells up from down from abstain: %', v_tallies;
  end if;

  -- The feature that lives in the same object has to survive: one person voted, and that is public.
  if v_casts is distinct from array['1', '1', '1'] then
    raise exception 'FAIL: the secret agora stopped counting how many people have voted: %', v_casts;
  end if;

  -- And the differencing attack itself, read before and after the one vote. Only `cast` may move.
  if (v_before->'tally'->>'cast') is distinct from '0' then
    raise exception 'FAIL: the fixture is wrong, somebody had already voted';
  end if;
  if ((v_after->'tally')::jsonb - 'cast') is distinct from ((v_before->'tally')::jsonb - 'cast') then
    raise exception 'FAIL: polling across a vote moved the breakdown: % then %',
      v_before->'tally', v_after->'tally';
  end if;
  if (v_after->'tally'->>'cast') is distinct from '1' then
    raise exception 'FAIL: the observer cannot even see that somebody voted';
  end if;
  -- `pending` is untouched on purpose: it is the feature, and it is a name, never a leaning.
  if json_array_length(v_after->'pending') is distinct from 2 then
    raise exception 'FAIL: pending stopped naming who still has to vote, which was not the fix';
  end if;

  raise notice 'PASS an open round in a secret agora cannot be differenced into who voted what';
end $$;

-- Once it resolves, the secret agora publishes the real breakdown: that is the moment the senses
-- become public in both modes, and redaction must not outlive the round.
do $$
declare v_prop uuid; v_tally json;
begin
  perform agora.create_group('Resolved split', 'ballot14', 'alice', 'tok-a14', false);
  perform agora.add_participant('ballot14', 'bob', 'tok-b14');
  perform agora.add_participant('ballot14', 'carol', 'tok-c14');
  v_prop := agora.create_proposal('tok-a14', 'ballot14', json_build_object('title', 'Paint it'));

  perform agora.cast_vote('tok-a14', v_prop, 1, 'up');
  perform agora.cast_vote('tok-b14', v_prop, 1, 'up');
  perform agora.cast_vote('tok-c14', v_prop, 1, 'down');

  v_tally := agora.get_board('ballot14', 'tok-a14')->'proposals'->0->'tally';
  if v_tally::text is distinct from
     json_build_object('up', 2, 'down', 1, 'abstain', 0, 'cast', 3, 'net', 1)::text then
    raise exception 'FAIL: a resolved secret proposal did not publish its real breakdown: %', v_tally;
  end if;

  raise notice 'PASS a resolved proposal publishes the real breakdown, in a secret agora too';
end $$;

-- The control: in an open agora the round is meant to be readable as it happens, so the very same
-- attack must still work. This is what stops the fix from being applied to both modes by accident.
do $$
declare v_prop uuid; v_up json; v_down json; v_slug text; v_sense text;
begin
  foreach v_sense in array array['up', 'down'] loop
    v_slug := 'ballot2' || (array_position(array['up', 'down'], v_sense))::text;
    perform agora.create_group('Watch me', v_slug, 'alice', 'tok-a' || v_slug, true);
    perform agora.add_participant(v_slug, 'bob', 'tok-b' || v_slug);
    perform agora.add_participant(v_slug, 'carol', 'tok-c' || v_slug);
    v_prop := agora.create_proposal('tok-a' || v_slug, v_slug, json_build_object('title', 'Paint it'));
    perform agora.cast_vote('tok-b' || v_slug, v_prop, 1, v_sense::agora.vote_value);
    if v_sense = 'up' then
      v_up := agora.get_board(v_slug, 'tok-a' || v_slug)->'proposals'->0->'tally';
    else
      v_down := agora.get_board(v_slug, 'tok-a' || v_slug)->'proposals'->0->'tally';
    end if;
  end loop;

  if v_up::text is not distinct from v_down::text then
    raise exception 'FAIL: an open agora stopped showing the round as it happens: % vs %', v_up, v_down;
  end if;
  if (v_up->>'up') is distinct from '1' or (v_down->>'down') is distinct from '1' then
    raise exception 'FAIL: an open agora lost its running tally: % vs %', v_up, v_down;
  end if;

  raise notice 'PASS an open agora still shows the round developing, which is its whole point';
end $$;

-- The same leak, moved to the moment the round ends by itself.
--
-- A proposal whose deadline passes resolves on a *partial* ballot: it resolves on the next read,
-- with only some people having voted. At that instant the reveal and `pending` are in the same
-- payload, and `participants` minus `pending` is precisely the set of people who did vote. One name
-- in that set beside one revealed value publishes both. Two of three voting the same way publishes
-- two people at once, which is worse, so it is the case the assertion is built on.
--
-- The assertion is therefore not "pending is empty": it is that the subtraction does not identify a
-- voter. Written that way it survives any other shape the fix might take later.
do $$
declare v_prop uuid; v_board json; v_voters int; v_values int; v_pending int; v_participants int;
begin
  perform agora.create_group('Deadline secret', 'ballot30', 'alice', 'tok-a30', false);
  perform agora.add_participant('ballot30', 'bob', 'tok-b30');
  perform agora.add_participant('ballot30', 'carol', 'tok-c30');

  -- Two of three, both the same way: the homogeneous case, where knowing *who* voted is knowing
  -- what each of them voted, because every revealed value is identical.
  v_prop := agora.create_proposal('tok-a30', 'ballot30',
    json_build_object('title', 'Alquilar una furgoneta'));
  perform agora.cast_vote('tok-a30', v_prop, 1, 'up');
  perform agora.cast_vote('tok-b30', v_prop, 1, 'up');

  -- The deadline is aged afterwards rather than set at creation: `cast_vote` resolves on the way
  -- out, so a proposal born past its deadline would close on the first vote and never reach two.
  update agora.proposals set deadline = now() - interval '1 minute' where id = v_prop;

  -- Carol never votes; the deadline resolves it on this read, which is a tested feature of its own.
  v_board := agora.get_board('ballot30', 'tok-c30');
  if (select status::text from agora.proposals where id = v_prop) = 'open' then
    raise exception 'FAIL: the deadline did not resolve, so this proves nothing about a partial ballot';
  end if;
  if (v_board->'proposals'->0->>'votesRevealed') is distinct from 'true' then
    raise exception 'FAIL: the fixture never reached the reveal';
  end if;

  v_participants := json_array_length(v_board->'participants');
  v_pending := json_array_length(v_board->'proposals'->0->'pending');
  v_values := json_array_length(v_board->'proposals'->0->'votes');
  v_voters := v_participants - v_pending;

  -- The attack, stated as the subtraction: if the board still names a proper subset of the group as
  -- the non-voters, then the rest of the group are the voters, by name, next to their votes.
  if v_voters < v_participants then
    raise exception
      'FAIL: participants minus pending names % of % voters beside % revealed values',
      v_voters, v_participants, v_values;
  end if;
  -- And the votes really are there, or the subtraction was safe only because nothing was revealed.
  if v_values is distinct from 2 then
    raise exception 'FAIL: the partial ballot lost its revealed votes (got %)', v_values;
  end if;
  -- Nor by any other route: no participant id at all in a resolved secret board.
  if v_board::text like '%participantId%' then
    raise exception 'FAIL: the resolved secret board published attribution: %', v_board;
  end if;

  raise notice 'PASS a deadline-resolved secret ballot cannot be subtracted into who voted';
end $$;

-- The single-voter case, which is the sharpest: one name out, one value in.
do $$
declare v_prop uuid; v_board json;
begin
  perform agora.create_group('Lone voter', 'ballot31', 'alice', 'tok-a31', false);
  perform agora.add_participant('ballot31', 'bob', 'tok-b31');
  perform agora.add_participant('ballot31', 'carol', 'tok-c31');

  v_prop := agora.create_proposal('tok-a31', 'ballot31',
    json_build_object('title', 'Pintar el pasillo'));
  perform agora.cast_vote('tok-b31', v_prop, 1, 'down');
  update agora.proposals set deadline = now() - interval '1 minute' where id = v_prop;
  v_board := agora.get_board('ballot31', 'tok-a31');

  if json_array_length(v_board->'proposals'->0->'votes') is distinct from 1 then
    raise exception 'FAIL: the fixture did not reveal the single vote';
  end if;
  if json_array_length(v_board->'proposals'->0->'pending')
     is distinct from 0 then
    raise exception 'FAIL: one revealed value and a named non-voter list is bob, voting down';
  end if;

  raise notice 'PASS one revealed value beside a partial ballot still names nobody';
end $$;

-- The control: an open agora keeps naming who did not vote, because there the names are published
-- beside the votes anyway. If this ever goes green in both modes the fix has been over-applied.
do $$
declare v_prop uuid; v_board json;
begin
  perform agora.create_group('Deadline open', 'ballot32', 'alice', 'tok-a32', true);
  perform agora.add_participant('ballot32', 'bob', 'tok-b32');
  perform agora.add_participant('ballot32', 'carol', 'tok-c32');

  v_prop := agora.create_proposal('tok-a32', 'ballot32',
    json_build_object('title', 'Alquilar una furgoneta'));
  perform agora.cast_vote('tok-a32', v_prop, 1, 'up');
  perform agora.cast_vote('tok-b32', v_prop, 1, 'up');
  update agora.proposals set deadline = now() - interval '1 minute' where id = v_prop;
  v_board := agora.get_board('ballot32', 'tok-c32');

  if (select status::text from agora.proposals where id = v_prop) = 'open' then
    raise exception 'FAIL: the control never resolved';
  end if;
  if json_array_length(v_board->'proposals'->0->'pending') is distinct from 1 then
    raise exception 'FAIL: an open agora stopped saying who let the deadline pass without voting';
  end if;
  if v_board::text not like '%participantId%' then
    raise exception 'FAIL: an open agora stopped attributing its votes';
  end if;

  raise notice 'PASS an open agora still names who let the deadline pass, which is its point';
end $$;

-- And during the round, in a secret agora, `pending` is untouched: it is the feature that unblocks a
-- stalled vote, and the fix must not have reached back into the open round to break it.
do $$
declare v_prop uuid; v_board json;
begin
  perform agora.create_group('Still open', 'ballot33', 'alice', 'tok-a33', false);
  perform agora.add_participant('ballot33', 'bob', 'tok-b33');
  perform agora.add_participant('ballot33', 'carol', 'tok-c33');
  v_prop := agora.create_proposal('tok-a33', 'ballot33', json_build_object('title', 'Pintar'));
  perform agora.cast_vote('tok-b33', v_prop, 1, 'up');

  v_board := agora.get_board('ballot33', 'tok-a33');
  if (select status::text from agora.proposals where id = v_prop) is distinct from 'open' then
    raise exception 'FAIL: the fixture resolved and stopped testing the open round';
  end if;
  if json_array_length(v_board->'proposals'->0->'pending') is distinct from 2 then
    raise exception 'FAIL: a secret agora stopped saying who still has to vote, which unblocks it';
  end if;
  if (v_board->'proposals'->0->'votes') is not null
     and (v_board->'proposals'->0->>'votes') is not null then
    raise exception 'FAIL: the open round revealed votes, so pending is no longer safe to publish';
  end if;

  raise notice 'PASS a secret agora still names who has to vote while nothing has been revealed';
end $$;
