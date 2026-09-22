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

-- An explicit null fifth argument is not a way to get an open agora.
do $$
declare v_refused boolean := false;
begin
  -- The column's own `default true` is what covers the argument being *omitted*, which is the case
  -- the four-argument form depends on and which must keep working. An explicit null is a different
  -- call shape: it used to be coalesced to true, so a client that sent `p_ballot_open: null` got an
  -- open agora in a product whose stated default is secret, silently. It is now refused.
  begin
    perform agora.create_group('Null mode', 'ballot50', 'alice', 'tok-a50', null);
  exception when others then v_refused := true;
  end;
  if not v_refused then
    raise exception 'FAIL: an explicit null ballot mode was accepted, and it made a % agora',
      (select case when ballot_open then 'public' else 'secret' end
         from agora.groups where slug = 'ballot50');
  end if;
  if exists (select 1 from agora.groups where slug = 'ballot50') then
    raise exception 'FAIL: the refused agora was created anyway';
  end if;

  -- And omitting it still means open, which is the whole point of keeping the four-argument form.
  perform agora.create_group('Omitted mode', 'ballot51', 'alice', 'tok-a51');
  if (select ballot_open from agora.groups where slug = 'ballot51') is not true then
    raise exception 'FAIL: omitting the argument stopped meaning an open ballot';
  end if;

  raise notice 'PASS an explicit null ballot mode is refused, an omitted one still means open';
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

-- The same family again, and this one needs two reads to see.
--
-- While the round is open the board names who has *not* voted — deliberately, on screen, to
-- everybody: it is what unblocks a stalled vote. So one glance during the deadline window hands an
-- observer the voter set. If the deadline then resolves a *partial* ballot and the reveal arrives,
-- those values are exactly those people's votes:
--
--     last OPEN read  :: pending = [carol, dave]  -> the voters are [alice, bob]
--     RESOLVED read   :: votes   = [{up},{up}]    -> alice = up, bob = up, by name
--
-- A voter gets it cheaper still: subtract your own value and the rest belongs to the other name you
-- already know voted. So a secret agora now publishes nothing at all unless the ballot is complete.
-- Quorum is precisely the state where the subtraction finds nothing, because everybody voted.
--
-- Four participants and two voters on purpose: with three and two, an observer attributes both votes
-- by `cast = n - 1` arithmetic whatever the server does, so that fixture cannot show the fix working.
do $$
declare v_prop uuid; v_during json; v_after json; v_known int; v_total int;
begin
  perform agora.create_group('Two reads', 'ballot40', 'alice', 'tok-a40', false);
  perform agora.add_participant('ballot40', 'bob', 'tok-b40');
  perform agora.add_participant('ballot40', 'carol', 'tok-c40');
  perform agora.add_participant('ballot40', 'dave', 'tok-d40');

  v_prop := agora.create_proposal('tok-a40', 'ballot40',
    json_build_object('title', 'Alquilar una furgoneta'));
  perform agora.cast_vote('tok-a40', v_prop, 1, 'up');
  perform agora.cast_vote('tok-b40', v_prop, 1, 'up');

  -- READ ONE, mid-round. This is the half any flatmate keeps just by opening the app.
  v_during := agora.get_board('ballot40', 'tok-c40')->'proposals'->0;
  if (v_during->>'status') is distinct from 'open' then
    raise exception 'FAIL: the fixture never had an open round to watch';
  end if;
  v_total := 4;
  v_known := v_total - json_array_length(v_during->'pending');
  if v_known is distinct from 2 then
    raise exception 'FAIL: the open round should name the two voters by subtraction, got %', v_known;
  end if;

  -- The deadline is aged after the votes: cast_vote resolves on the way out, so a proposal born
  -- past its deadline closes on the first vote and never carries two.
  update agora.proposals set deadline = now() - interval '1 minute' where id = v_prop;

  -- READ TWO, once the deadline resolves it on a partial ballot.
  v_after := agora.get_board('ballot40', 'tok-c40')->'proposals'->0;
  if (v_after->>'status') = 'open' then
    raise exception 'FAIL: the deadline did not resolve, so there is no second read to join';
  end if;

  -- The join must have nothing to join with: a proper subset is publicly named as the voters, so
  -- not one vote value may be published.
  if v_known < v_total then
    if (v_after->'votes') is not null and (v_after->>'votes') is not null then
      raise exception 'FAIL: two reads pair % named voters with the reveal %', v_known, v_after->'votes';
    end if;
    if (v_after->'tally'->>'up') is distinct from '0'
       or (v_after->'tally'->>'down') is distinct from '0'
       or (v_after->'tally'->>'abstain') is distinct from '0' then
      raise exception 'FAIL: the breakdown pairs with the known voter set: %', v_after->'tally';
    end if;
    if (v_after->>'votesRevealed') is distinct from 'false' then
      raise exception 'FAIL: votesRevealed says published while nothing is, which misleads every reader';
    end if;
  end if;

  -- And what is still owed to the group: the outcome, and how many voted.
  if (v_after->'tally'->>'cast') is distinct from '2' then
    raise exception 'FAIL: the group lost the count of who voted, which is not the leak';
  end if;
  -- And no verdict, which is the point: with a partial ballot the verdict *is* the ballot.
  if (v_after->>'status') is distinct from 'debating' then
    raise exception 'FAIL: an incomplete secret ballot reached a verdict, got %', v_after->>'status';
  end if;

  raise notice 'PASS an open read and a deadline read cannot be joined into a name and a vote';
end $$;

-- The verdict was the last field still carrying the sense.
--
-- `resolve_proposal` decides from `v_up - v_down` alone, so with one vote cast the outcome *is* that
-- person's vote: up gives 'approved', down gives 'rejected', abstain gives 'debating'. The last open
-- read named the single voter through `pending`, and the resolved read published the verdict — the
-- whole two-read attack again, through the one field rounds 2 and 4 left alone.
--
-- Same shape as the other indistinguishability tests: three identical secret agoras, one voter, a
-- different sense in each, and one canonical board out of all three. The volatile keys are dropped
-- because ids differ by construction; everything that could carry the sense stays in.
do $$
declare v_prop uuid; v_slug text; v_sense text; v_boards text[] := '{}'; v_after jsonb;
begin
  foreach v_sense in array array['up', 'down', 'abstain'] loop
    v_slug := 'ballot6' || (array_position(array['up', 'down', 'abstain'], v_sense))::text;
    perform agora.create_group('Verdict', v_slug, 'alice', 'tok-a' || v_slug, false);
    perform agora.add_participant(v_slug, 'bob', 'tok-b' || v_slug);
    perform agora.add_participant(v_slug, 'carol', 'tok-c' || v_slug);
    perform agora.add_participant(v_slug, 'dave', 'tok-d' || v_slug);

    v_prop := agora.create_proposal('tok-a' || v_slug, v_slug, json_build_object('title', 'Furgoneta'));
    perform agora.cast_vote('tok-b' || v_slug, v_prop, 1, v_sense::agora.vote_value);
    update agora.proposals set deadline = now() - interval '1 minute' where id = v_prop;

    v_after := (agora.get_board(v_slug, 'tok-a' || v_slug)->'proposals'->0)::jsonb
               - 'id' - 'groupId' - 'createdBy' - 'createdAt' - 'updatedAt';
    v_boards := v_boards || v_after::text;
  end loop;

  if v_boards[1] is distinct from v_boards[2] or v_boards[1] is distinct from v_boards[3] then
    raise exception 'FAIL: a lone up, down and abstain give three different boards: %', v_boards;
  end if;
  -- And it is the undecided state they all agree on, not some other verdict they happen to share.
  if (v_boards[1]::jsonb->>'status') is distinct from 'debating' then
    raise exception 'FAIL: expected no verdict on an incomplete secret ballot, got %',
      v_boards[1]::jsonb->>'status';
  end if;

  raise notice 'PASS an incomplete secret ballot reaches no verdict, so the verdict names nobody';
end $$;

-- The open mode keeps deciding on a partial ballot, which is 0.22.0's behaviour and the spec's.
do $$
declare v_prop uuid; v_status text;
begin
  perform agora.create_group('Verdict open', 'ballot64', 'alice', 'tok-a64', true);
  perform agora.add_participant('ballot64', 'bob', 'tok-b64');
  perform agora.add_participant('ballot64', 'carol', 'tok-c64');

  v_prop := agora.create_proposal('tok-a64', 'ballot64', json_build_object('title', 'Furgoneta'));
  perform agora.cast_vote('tok-b64', v_prop, 1, 'up');
  update agora.proposals set deadline = now() - interval '1 minute' where id = v_prop;
  perform agora.get_board('ballot64', 'tok-a64');

  select status::text into v_status from agora.proposals where id = v_prop;
  if v_status is distinct from 'approved' then
    raise exception 'FAIL: an open agora stopped deciding on a partial ballot, got %', v_status;
  end if;

  raise notice 'PASS an open agora still decides on a partial ballot, verdict and names alike';
end $$;

-- A reveal that happened does not un-happen because somebody joined afterwards.
do $$
declare v_prop uuid; v_before json; v_after json;
begin
  perform agora.create_group('Late join', 'ballot65', 'alice', 'tok-a65', false);
  perform agora.add_participant('ballot65', 'bob', 'tok-b65');
  perform agora.add_participant('ballot65', 'carol', 'tok-c65');

  v_prop := agora.create_proposal('tok-a65', 'ballot65', json_build_object('title', 'Furgoneta'));
  perform agora.cast_vote('tok-a65', v_prop, 1, 'up');
  perform agora.cast_vote('tok-b65', v_prop, 1, 'up');
  perform agora.cast_vote('tok-c65', v_prop, 1, 'down');

  -- now() is the transaction start time and this whole file runs in one transaction, so every row
  -- here shares one instant and "joined afterwards" would not be afterwards at all. The three who
  -- were there are aged back behind the resolution, which is the ordering production actually has.
  update agora.participants set created_at = now() - interval '10 minutes'
   where group_id = (select group_id from agora.proposals where id = v_prop);
  update agora.proposals set resolved_at = now() - interval '5 minutes' where id = v_prop;

  v_before := agora.get_board('ballot65', 'tok-a65')->'proposals'->0;
  if json_array_length(v_before->'votes') is distinct from 3 then
    raise exception 'FAIL: the fixture never published anything to retract';
  end if;

  -- Somebody joins the agora after the fact. Counted against today's roster the ballot would stop
  -- being complete and the reveal would vanish — and because add_participant bumps board_version
  -- without touching proposals.updated_at, the delta carries the roster and no proposals, so a
  -- device that already had the board would keep showing the reveal while a fresh one showed
  -- stone. Two live clients, permanently disagreeing about whether a secret ballot was published.
  perform agora.add_participant('ballot65', 'dave', 'tok-d65');

  v_after := agora.get_board('ballot65', 'tok-a65')->'proposals'->0;
  if (v_after->>'votesRevealed') is distinct from 'true' then
    raise exception 'FAIL: a late joiner retracted a reveal that had already happened';
  end if;
  if json_array_length(v_after->'votes') is distinct from 3 then
    raise exception 'FAIL: the published votes vanished when somebody joined: %', v_after->'votes';
  end if;
  if (v_after->'tally'->>'up') is distinct from '2' then
    raise exception 'FAIL: the published breakdown vanished when somebody joined: %', v_after->'tally';
  end if;

  -- And the count at close is the one resolve_proposal itself used: three participants existed
  -- then, three voted, so it resolved. Read back from the catalogue rather than assumed.
  if (select count(*) from agora.participants pa
       join agora.proposals pr on pr.id = v_prop
      where pa.group_id = pr.group_id and pa.created_at <= pr.resolved_at) is distinct from 3 then
    raise exception 'FAIL: the roster at resolution is not the one the resolver counted';
  end if;

  raise notice 'PASS a late joiner does not retract a reveal that already happened';
end $$;

-- The other side of the rule: a complete ballot publishes exactly as before. Without this the fix
-- could be "never reveal anything" and every leak test above would still be green.
do $$
declare v_prop uuid; v_after json;
begin
  perform agora.create_group('Complete', 'ballot41', 'alice', 'tok-a41', false);
  perform agora.add_participant('ballot41', 'bob', 'tok-b41');
  perform agora.add_participant('ballot41', 'carol', 'tok-c41');

  v_prop := agora.create_proposal('tok-a41', 'ballot41', json_build_object('title', 'Pintar'));
  perform agora.cast_vote('tok-a41', v_prop, 1, 'up');
  perform agora.cast_vote('tok-b41', v_prop, 1, 'up');
  perform agora.cast_vote('tok-c41', v_prop, 1, 'down');

  v_after := agora.get_board('ballot41', 'tok-a41')->'proposals'->0;
  if (v_after->>'votesRevealed') is distinct from 'true' then
    raise exception 'FAIL: a complete secret ballot was not revealed';
  end if;
  if json_array_length(v_after->'votes') is distinct from 3 then
    raise exception 'FAIL: a complete secret ballot lost its votes: %', v_after->'votes';
  end if;
  if (v_after->'tally'->>'up') is distinct from '2' or (v_after->'tally'->>'down') is distinct from '1' then
    raise exception 'FAIL: a complete secret ballot lost its breakdown: %', v_after->'tally';
  end if;
  if v_after::text like '%participantId%' then
    raise exception 'FAIL: a complete secret ballot published attribution';
  end if;

  raise notice 'PASS a complete secret ballot still publishes its votes and its breakdown';
end $$;

-- Round 3's guarantee, kept, and stated for what it is: a field check on `pending`, written as the
-- subtraction it defends against. It is not shape-independent — a different safe fix, emitting the
-- whole participant list so the voter set comes out empty, would fail it.
do $$
declare v_prop uuid; v_board json; v_participants int; v_pending int;
begin
  perform agora.create_group('Deadline secret', 'ballot30', 'alice', 'tok-a30', false);
  perform agora.add_participant('ballot30', 'bob', 'tok-b30');
  perform agora.add_participant('ballot30', 'carol', 'tok-c30');
  perform agora.add_participant('ballot30', 'dave', 'tok-d30');

  v_prop := agora.create_proposal('tok-a30', 'ballot30',
    json_build_object('title', 'Alquilar una furgoneta'));
  perform agora.cast_vote('tok-a30', v_prop, 1, 'up');
  perform agora.cast_vote('tok-b30', v_prop, 1, 'up');
  update agora.proposals set deadline = now() - interval '1 minute' where id = v_prop;

  v_board := agora.get_board('ballot30', 'tok-c30');
  if (select status::text from agora.proposals where id = v_prop) = 'open' then
    raise exception 'FAIL: the deadline did not resolve, so this proves nothing about a partial ballot';
  end if;

  v_participants := json_array_length(v_board->'participants');
  v_pending := json_array_length(v_board->'proposals'->0->'pending');
  if v_participants - v_pending < v_participants then
    raise exception 'FAIL: participants minus pending names % of % voters',
      v_participants - v_pending, v_participants;
  end if;
  if v_board::text like '%participantId%' then
    raise exception 'FAIL: the resolved secret board published attribution: %', v_board;
  end if;

  raise notice 'PASS a deadline-resolved secret ballot names nobody by subtraction either';
end $$;

-- The control: an open agora is untouched on every one of these. It names who let the deadline pass
-- and it publishes the partial reveal with the names attached, because that is what that mode is.
do $$
declare v_prop uuid; v_after json;
begin
  perform agora.create_group('Deadline open', 'ballot32', 'alice', 'tok-a32', true);
  perform agora.add_participant('ballot32', 'bob', 'tok-b32');
  perform agora.add_participant('ballot32', 'carol', 'tok-c32');
  perform agora.add_participant('ballot32', 'dave', 'tok-d32');

  v_prop := agora.create_proposal('tok-a32', 'ballot32',
    json_build_object('title', 'Alquilar una furgoneta'));
  perform agora.cast_vote('tok-a32', v_prop, 1, 'up');
  perform agora.cast_vote('tok-b32', v_prop, 1, 'up');
  update agora.proposals set deadline = now() - interval '1 minute' where id = v_prop;

  v_after := agora.get_board('ballot32', 'tok-c32')->'proposals'->0;
  if (v_after->>'status') = 'open' then
    raise exception 'FAIL: the control never resolved';
  end if;
  if (v_after->>'votesRevealed') is distinct from 'true' then
    raise exception 'FAIL: an open agora stopped revealing a partial ballot';
  end if;
  if json_array_length(v_after->'votes') is distinct from 2 then
    raise exception 'FAIL: an open agora lost its partial reveal';
  end if;
  if json_array_length(v_after->'pending') is distinct from 2 then
    raise exception 'FAIL: an open agora stopped saying who let the deadline pass';
  end if;
  if (v_after->'tally'->>'up') is distinct from '2' then
    raise exception 'FAIL: an open agora lost its breakdown: %', v_after->'tally';
  end if;

  raise notice 'PASS an open agora publishes the partial reveal and the names, which is its point';
end $$;

-- And during the round, in a secret agora, `pending` is untouched: it is the feature that unblocks a
-- stalled vote, and no fix above may have reached back into the open round to break it.
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
