-- What the RPC layer must enforce on its own. The client is never trusted for any of this.

-- Criteria 1 and 5, plus the idempotency criterion 12 depends on.
do $$
declare v_prop uuid; v_status text; v_board json; v_rejected boolean;
begin
  perform agora.create_group('Test agora', 'rpctest1', 'alice', 'tok-alice');
  perform agora.add_participant('rpctest1', 'bob', 'tok-bob');
  perform agora.add_participant('rpctest1', 'carol', 'tok-carol');
  perform agora.add_participant('rpctest1', 'dave', 'tok-dave');

  v_prop := agora.create_proposal('tok-alice', 'rpctest1',
    json_build_object('title', 'Trip to the coast', 'description', 'A weekend away', 'tags', json_build_array('trip')));

  -- Voting twice in a row is a change of mind, not a second vote.
  perform agora.cast_vote('tok-alice', v_prop, 1, 'down');
  perform agora.cast_vote('tok-alice', v_prop, 1, 'up');
  if (select count(*) from agora.votes where proposal_id = v_prop) <> 1 then
    raise exception 'FAIL: re-voting created a second row';
  end if;

  -- Replaying the very same queued vote must change nothing.
  perform agora.cast_vote('tok-alice', v_prop, 1, 'up');
  if (select count(*) from agora.votes where proposal_id = v_prop) <> 1 then
    raise exception 'FAIL: replaying a vote created a second row';
  end if;

  perform agora.cast_vote('tok-bob',   v_prop, 1, 'abstain');
  perform agora.cast_vote('tok-carol', v_prop, 1, 'abstain');
  perform agora.cast_vote('tok-dave',  v_prop, 1, 'abstain');

  select status::text into v_status from agora.proposals where id = v_prop;
  if v_status <> 'approved' then
    raise exception 'FAIL: 1 up + 3 abstain resolved to % instead of approved', v_status;
  end if;

  -- And it is first in the list the board hands out.
  v_board := agora.get_board('rpctest1', 'tok-alice');
  if (v_board->'proposals'->0->>'id') <> v_prop::text then
    raise exception 'FAIL: the approved proposal is not first';
  end if;

  -- The vote is frozen outside open.
  v_rejected := false;
  begin
    perform agora.cast_vote('tok-bob', v_prop, 1, 'up');
  exception when others then v_rejected := true;
  end;
  if not v_rejected then raise exception 'FAIL: voting on an approved proposal was accepted'; end if;

  raise notice 'PASS 1 up + 3 abstain approves, votes are unique and replay-safe';
end $$;

-- Criterion 10: no sentiment leaves the server while the vote is open.
do $$
declare v_prop uuid; v_board json; v_text text;
begin
  perform agora.create_group('Secret agora', 'rpctest2', 'alice', 'tok-a2');
  perform agora.add_participant('rpctest2', 'bob', 'tok-b2');
  v_prop := agora.create_proposal('tok-a2', 'rpctest2', json_build_object('title', 'Buy a projector'));

  perform agora.cast_vote('tok-b2', v_prop, 1, 'down');

  v_board := agora.get_board('rpctest2', 'tok-a2');
  v_text := v_board::text;
  -- "value" only ever appears inside a votes array, which must be absent before quorum.
  if v_text like '%"value"%' then
    raise exception 'FAIL: the board leaked a vote value before quorum';
  end if;
  if (v_board->'proposals'->0->'votes') is not null
     and (v_board->'proposals'->0->>'votes') is not null then
    raise exception 'FAIL: votes were included before quorum';
  end if;
  if (v_board->'proposals'->0->'tally'->>'cast') <> '1' then
    raise exception 'FAIL: the tally should still say one vote was cast';
  end if;
  if (v_board->'proposals'->0->>'myVote') is not null then
    raise exception 'FAIL: alice has not voted, so myVote must be null';
  end if;
  -- Who is missing is public: that is what unblocks a vote.
  if json_array_length(v_board->'proposals'->0->'pending') <> 1 then
    raise exception 'FAIL: pending should list the one person who has not voted';
  end if;

  -- Now let it reach quorum: everything is revealed at once.
  perform agora.cast_vote('tok-a2', v_prop, 1, 'down');
  v_board := agora.get_board('rpctest2', 'tok-a2');
  if (v_board->'proposals'->0->>'votesRevealed') <> 'true'
     or json_array_length(v_board->'proposals'->0->'votes') <> 2 then
    raise exception 'FAIL: votes were not revealed after quorum';
  end if;

  raise notice 'PASS the api hides sentiment until quorum and reveals it after';
end $$;

-- Criteria 2, 3 and 4: the tie, the reopened round and the closing reason.
do $$
declare v_prop uuid; v_status text; v_rejected boolean;
begin
  perform agora.create_group('Tie agora', 'rpctest3', 'alice', 'tok-a3');
  perform agora.add_participant('rpctest3', 'bob', 'tok-b3');
  v_prop := agora.create_proposal('tok-a3', 'rpctest3', json_build_object('title', 'Paint the hallway'));

  perform agora.cast_vote('tok-a3', v_prop, 1, 'up');
  perform agora.cast_vote('tok-b3', v_prop, 1, 'down');
  select status::text into v_status from agora.proposals where id = v_prop;
  if v_status <> 'debating' then raise exception 'FAIL: a tie resolved to %', v_status; end if;

  -- Only the creator decides what happens next.
  v_rejected := false;
  begin
    perform agora.reopen_proposal('tok-b3', v_prop);
  exception when others then v_rejected := true;
  end;
  if not v_rejected then raise exception 'FAIL: a non-creator reopened the proposal'; end if;

  v_rejected := false;
  begin
    perform agora.close_proposal('tok-b3', v_prop, 'a long enough reason');
  exception when others then v_rejected := true;
  end;
  if not v_rejected then raise exception 'FAIL: a non-creator closed the proposal'; end if;

  -- Criterion 4: nine characters is not a reason.
  v_rejected := false;
  begin
    perform agora.close_proposal('tok-a3', v_prop, 'too short');
  exception when others then v_rejected := true;
  end;
  if not v_rejected then raise exception 'FAIL: a 9-character closing reason was accepted'; end if;

  -- Criterion 3: reopening bumps the round and keeps round 1 readable.
  perform agora.reopen_proposal('tok-a3', v_prop);
  if (select round from agora.proposals where id = v_prop) <> 2 then
    raise exception 'FAIL: the round did not advance';
  end if;
  if (select count(*) from agora.votes where proposal_id = v_prop and round = 1) <> 2 then
    raise exception 'FAIL: the round 1 votes were destroyed';
  end if;
  if (select status::text from agora.proposals where id = v_prop) <> 'open' then
    raise exception 'FAIL: reopening did not open the vote';
  end if;

  -- A vote sent for the old round is stale and refused.
  v_rejected := false;
  begin
    perform agora.cast_vote('tok-b3', v_prop, 1, 'up');
  exception when others then v_rejected := true;
  end;
  if not v_rejected then raise exception 'FAIL: a stale-round vote was accepted'; end if;

  perform agora.cast_vote('tok-a3', v_prop, 2, 'up');
  perform agora.cast_vote('tok-b3', v_prop, 2, 'up');
  if (select status::text from agora.proposals where id = v_prop) <> 'approved' then
    raise exception 'FAIL: round 2 did not resolve';
  end if;
  if (select count(*) from agora.votes where proposal_id = v_prop) <> 4 then
    raise exception 'FAIL: expected two rounds of votes on record';
  end if;

  raise notice 'PASS tie goes to debate, only the creator decides, and a reopened round keeps history';
end $$;

-- A passed deadline resolves without a scheduler, on the next read.
do $$
declare v_prop uuid;
begin
  perform agora.create_group('Deadline agora', 'rpctest4', 'alice', 'tok-a4');
  perform agora.add_participant('rpctest4', 'bob', 'tok-b4');
  v_prop := agora.create_proposal('tok-a4', 'rpctest4',
    json_build_object('title', 'Order the cake', 'deadline', (now() - interval '1 minute')::text));

  perform agora.cast_vote('tok-a4', v_prop, 1, 'up');   -- bob never votes
  perform agora.get_board('rpctest4', 'tok-a4');
  if (select status::text from agora.proposals where id = v_prop) <> 'approved' then
    raise exception 'FAIL: a passed deadline did not resolve on read';
  end if;
  raise notice 'PASS a passed deadline resolves lazily on the next read';
end $$;

-- Identity without a PIN: pick your name, or add it, and either way this device becomes yours.
do $$
declare v_preview json; v_alice uuid; v_claim json; v_rejected boolean; v_added json;
begin
  perform agora.create_group('Pin-free agora', 'rpctest5', 'alice', 'tok-a5');

  -- What someone opening the link sees before we know who they are: names, and nothing else.
  v_preview := agora.get_agora_preview('rpctest5');
  if json_array_length(v_preview->'participants') <> 1 then
    raise exception 'FAIL: the preview should list the one participant';
  end if;
  if v_preview::text like '%proposals%' or v_preview::text like '%votes%' then
    raise exception 'FAIL: the preview leaks more than names';
  end if;

  v_alice := ((v_preview->'participants')->0->>'id')::uuid;

  -- "That one is me", from a different device.
  v_claim := agora.claim_participant('rpctest5', v_alice, 'tok-new');
  if (v_claim->>'ok') <> 'true' then raise exception 'FAIL: the claim was refused'; end if;
  perform agora.get_board('rpctest5', 'tok-new');

  v_rejected := false;
  begin
    perform agora.get_board('rpctest5', 'tok-a5');
  exception when others then v_rejected := true;
  end;
  if not v_rejected then raise exception 'FAIL: the old device still resolves to that name'; end if;

  -- "I am not on the list."
  v_added := agora.add_participant('rpctest5', 'bob', 'tok-b5');
  if (v_added->>'participant_id') is null then raise exception 'FAIL: bob was not added'; end if;

  -- Asking again for the same name is the same person, however many times it is replayed.
  if (agora.add_participant('rpctest5', 'bob', 'tok-b5')->>'participant_id')
     <> (v_added->>'participant_id') then
    raise exception 'FAIL: replaying an add produced a second participant';
  end if;

  -- But a *different* name from the same device is a new person, and the device follows them: this is
  -- "switch person → I am someone new", which the device short-circuit used to swallow.
  if (agora.add_participant('rpctest5', 'iker', 'tok-b5')->>'participant_id')
     = (v_added->>'participant_id') then
    raise exception 'FAIL: adding a new person from a used device returned the old one';
  end if;
  if (select count(*) from agora.participants p
       join agora.groups g on g.id = p.group_id where g.slug = 'rpctest5') <> 3 then
    raise exception 'FAIL: expected alice, bob and iker';
  end if;
  if (select name from agora.participants
       where device_token_hash = agora.token_hash('tok-b5',
             (select id from agora.groups where slug = 'rpctest5')::text)) <> 'iker' then
    raise exception 'FAIL: the device did not move to the person just added';
  end if;

  -- A name already in the agora is a claim, not a join.
  v_rejected := false;
  begin
    perform agora.add_participant('rpctest5', 'alice', 'tok-c5');
  exception when sqlstate 'PT409' then v_rejected := true;
  end;
  if not v_rejected then raise exception 'FAIL: a duplicate name was added'; end if;

  raise notice 'PASS identity is a name you pick, and it moves between devices with no pin';
end $$;

-- Erasure is guarded by typing the agora name, not by a secret.
do $$
declare v_result json;
begin
  perform agora.create_group('Casa de la playa', 'rpctest9', 'alice', 'tok-a9');

  v_result := agora.delete_group('tok-a9', 'rpctest9', 'casa de la play');
  if (v_result->>'ok') <> 'false' then raise exception 'FAIL: a near-miss name deleted the agora'; end if;
  if not exists (select 1 from agora.groups where slug = 'rpctest9') then
    raise exception 'FAIL: the agora is gone after a refused delete';
  end if;

  -- Case and surrounding spaces do not matter; the name does.
  v_result := agora.delete_group('tok-a9', 'rpctest9', '  Casa de la Playa ');
  if (v_result->>'ok') <> 'true' then raise exception 'FAIL: the right name did not delete it'; end if;
  if exists (select 1 from agora.groups where slug = 'rpctest9') then
    raise exception 'FAIL: the agora survived its own deletion';
  end if;

  raise notice 'PASS deleting an agora needs its name typed out';
end $$;

-- The delta read and the version probe, which are what keep egress down.
do $$
declare v_prop uuid; v_version json; v_since timestamptz; v_delta json;
begin
  perform agora.create_group('Delta agora', 'rpctest6', 'alice', 'tok-a6');
  perform agora.add_participant('rpctest6', 'bob', 'tok-b6');
  v_prop := agora.create_proposal('tok-a6', 'rpctest6', json_build_object('title', 'Rent a van'));

  v_version := agora.get_board_version('rpctest6');
  if (v_version->>'version') is null then raise exception 'FAIL: no version returned'; end if;
  if length(v_version::text) > 200 then
    raise exception 'FAIL: the version probe should be tiny, got % bytes', length(v_version::text);
  end if;

  -- now() is the transaction start time, and this whole file runs in one transaction, so every row
  -- here shares one instant. The filter is exercised by moving the cursor, not the clock.
  v_delta := agora.get_board_since('rpctest6', 'tok-a6', now() + interval '1 second');
  if json_array_length(v_delta->'proposals') <> 0 then
    raise exception 'FAIL: with the cursor ahead of every row the delta must be empty';
  end if;

  perform agora.cast_vote('tok-b6', v_prop, 1, 'up');
  v_delta := agora.get_board_since('rpctest6', 'tok-a6', now() - interval '1 second');
  if json_array_length(v_delta->'proposals') <> 1 then
    raise exception 'FAIL: the voted proposal should be in the delta';
  end if;
  if length(v_delta::text) > 2000 then
    raise exception 'FAIL: a one-vote delta should stay under 2 KB, got % bytes', length(v_delta::text);
  end if;

  raise notice 'PASS version probe is tiny and a delta only carries what changed';
end $$;

-- Caps and authorization on the rest of the surface.
do $$
declare v_prop uuid; v_rejected boolean; i int;
begin
  perform agora.create_group('Caps agora', 'rpctest7', 'alice', 'tok-a7');
  v_prop := agora.create_proposal('tok-a7', 'rpctest7', json_build_object('title', 'Buy chairs'));

  -- Ten images is the cap, and it is the RPC that says so.
  for i in 1..10 loop
    perform agora.attach_image('tok-a7', gen_random_uuid(), v_prop,
      'g/p/' || i || '.webp', 'g/p/' || i || '-t.webp', 1600, 1200, 150000);
  end loop;
  v_rejected := false;
  begin
    perform agora.attach_image('tok-a7', gen_random_uuid(), v_prop, 'x.webp', 'x-t.webp', 1600, 1200, 1000);
  exception when others then v_rejected := true;
  end;
  if not v_rejected then raise exception 'FAIL: an eleventh image was accepted'; end if;

  -- An unknown device token is nobody.
  v_rejected := false;
  begin
    perform agora.create_proposal('tok-stranger', 'rpctest7', json_build_object('title', 'Sneak in'));
  exception when sqlstate 'PT403' then v_rejected := true;
  end;
  if not v_rejected then raise exception 'FAIL: an unknown device token could write'; end if;

  raise notice 'PASS image cap and unknown-device rejection hold in the rpc';
end $$;

-- The lockdown posture after 0003.
do $$
declare v_granted text; v_reachable text;
begin
  select string_agg(distinct table_name, ', ') into v_granted
    from information_schema.role_table_grants
   where table_schema = 'agora' and grantee in ('anon', 'authenticated');
  if v_granted is not null then raise exception 'FAIL: anon holds grants on %', v_granted; end if;

  select string_agg(p.proname, ', ') into v_reachable
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'agora'
     and p.proname in ('actor', 'token_hash', 'board_json', 'resolve_proposal', 'throttle')
     and has_function_privilege('anon', p.oid, 'execute');
  if v_reachable is not null then
    raise exception 'FAIL: anon can execute internal helpers: %', v_reachable;
  end if;

  if not has_function_privilege('anon', 'agora.get_board(text, text)', 'execute') then
    raise exception 'FAIL: anon cannot call get_board, which is the whole point';
  end if;

  raise notice 'PASS anon can call the public rpcs and nothing else';
end $$;

-- Links between proposals, which is how you insist on something that was rejected.
do $$
declare v_first uuid; v_second uuid; v_board json;
begin
  perform agora.create_group('Links agora', 'rpctest8', 'alice', 'tok-a8');
  v_first := agora.create_proposal('tok-a8', 'rpctest8', json_build_object('title', 'Rent a big van'));
  v_second := agora.create_proposal('tok-a8', 'rpctest8', json_build_object(
    'title', 'Rent two small vans',
    'links', json_build_array(json_build_object('toId', v_first, 'kind', 'supersedes'))));

  v_board := agora.get_board('rpctest8', 'tok-a8');
  if v_board::text not like '%supersedes%' then
    raise exception 'FAIL: the link did not reach the board';
  end if;

  -- Replacing the set, not accumulating: writing the same link twice leaves one row.
  perform agora.update_proposal('tok-a8', v_second, json_build_object(
    'links', json_build_array(json_build_object('toId', v_first, 'kind', 'supersedes'))));
  if (select count(*) from agora.proposal_links where from_id = v_second) <> 1 then
    raise exception 'FAIL: links accumulated instead of being replaced';
  end if;

  raise notice 'PASS proposals link to each other and the set is replaced, not appended';
end $$;

-- Editing belongs to the creator, and stops once the proposal is finished.
do $$
declare v_prop uuid; v_rejected boolean;
begin
  perform agora.create_group('Edit agora', 'rpctesta', 'alice', 'tok-aa');
  perform agora.add_participant('rpctesta', 'bob', 'tok-ba');
  v_prop := agora.create_proposal('tok-aa', 'rpctesta', json_build_object('title', 'Buy a projector'));

  v_rejected := false;
  begin
    perform agora.update_proposal('tok-ba', v_prop, json_build_object('title', 'Buy nothing'));
  exception when sqlstate 'PT403' then v_rejected := true;
  end;
  if not v_rejected then raise exception 'FAIL: a non-creator edited the proposal'; end if;

  perform agora.update_proposal('tok-aa', v_prop, json_build_object('title', 'Buy a better projector'));
  if (select title from agora.proposals where id = v_prop) <> 'Buy a better projector' then
    raise exception 'FAIL: the creator could not edit';
  end if;
  if not exists (select 1 from agora.history where proposal_id = v_prop and type = 'proposal_edited') then
    raise exception 'FAIL: the edit left no trace in the history';
  end if;

  -- Once it is done, the text is done too.
  perform agora.cast_vote('tok-aa', v_prop, 1, 'up');
  perform agora.cast_vote('tok-ba', v_prop, 1, 'up');
  perform agora.complete_proposal('tok-aa', v_prop, 12000);
  v_rejected := false;
  begin
    perform agora.update_proposal('tok-aa', v_prop, json_build_object('title', 'Sneaky rename'));
  exception when sqlstate 'PT409' then v_rejected := true;
  end;
  if not v_rejected then raise exception 'FAIL: a completed proposal was edited'; end if;

  raise notice 'PASS only the creator edits, and only until the proposal is finished';
end $$;
