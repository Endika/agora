-- What the database must refuse on its own, with no application in the way.
-- Every block rolls back, so the suite is repeatable against the same container.

-- Criterion 5: a second vote for the same participant, proposal and round.
do $$
declare v_group uuid; v_alice uuid; v_prop uuid; v_rejected boolean := false;
begin
  insert into agora.groups (name, slug) values ('Test agora', 'tstslug1') returning id into v_group;
  insert into agora.participants (group_id, name, device_token_hash)
    values (v_group, 'alice', 'hash') returning id into v_alice;
  insert into agora.proposals (group_id, created_by, title)
    values (v_group, v_alice, 'Trip to the coast') returning id into v_prop;

  insert into agora.votes (proposal_id, participant_id, round, value) values (v_prop, v_alice, 1, 'up');
  begin
    insert into agora.votes (proposal_id, participant_id, round, value) values (v_prop, v_alice, 1, 'down');
  exception when unique_violation then v_rejected := true;
  end;
  if not v_rejected then raise exception 'FAIL: a duplicate vote was accepted'; end if;
  if (select count(*) from agora.votes where proposal_id = v_prop) <> 1 then
    raise exception 'FAIL: expected exactly one vote row';
  end if;

  -- The same participant votes again in round 2: allowed, and round 1 stays readable.
  insert into agora.votes (proposal_id, participant_id, round, value) values (v_prop, v_alice, 2, 'down');
  if (select count(*) from agora.votes where proposal_id = v_prop) <> 2 then
    raise exception 'FAIL: round 2 vote should coexist with round 1';
  end if;

  raise notice 'PASS one vote per participant, proposal and round';
end $$;

-- Names identify people: same name, different casing, same agora.
do $$
declare v_group uuid; v_rejected boolean := false;
begin
  insert into agora.groups (name, slug) values ('Test agora', 'tstslug2') returning id into v_group;
  insert into agora.participants (group_id, name, device_token_hash) values (v_group, 'Endika', 'h');
  begin
    insert into agora.participants (group_id, name, device_token_hash) values (v_group, 'endika', 'h');
  exception when unique_violation then v_rejected := true;
  end;
  if not v_rejected then raise exception 'FAIL: two participants differing only in case were accepted'; end if;
  raise notice 'PASS participant names are unique per agora regardless of case';
end $$;

-- Field-level guards the RPCs rely on.
do $$
declare v_group uuid; v_alice uuid; v_prop uuid; v_rejected boolean;
begin
  insert into agora.groups (name, slug) values ('Test agora', 'tstslug3') returning id into v_group;
  insert into agora.participants (group_id, name, device_token_hash)
    values (v_group, 'alice', 'h') returning id into v_alice;

  v_rejected := false;
  begin
    insert into agora.proposals (group_id, created_by, title) values (v_group, v_alice, 'ab');
  exception when check_violation then v_rejected := true;
  end;
  if not v_rejected then raise exception 'FAIL: a 2-character title was accepted'; end if;

  insert into agora.proposals (group_id, created_by, title)
    values (v_group, v_alice, 'Long enough title') returning id into v_prop;

  -- Criterion 4, database half: a closing reason under 10 characters.
  v_rejected := false;
  begin
    update agora.proposals set closed_reason = 'too short' where id = v_prop;
  exception when check_violation then v_rejected := true;
  end;
  if not v_rejected then raise exception 'FAIL: a 9-character close reason was accepted'; end if;

  -- Criterion 6, database half: an image over 200 KB.
  v_rejected := false;
  begin
    insert into agora.proposal_images (id, proposal_id, path, thumb_path, width, height, bytes)
      values (gen_random_uuid(), v_prop, 'p.webp', 't.webp', 1600, 1200, 204801);
  exception when check_violation then v_rejected := true;
  end;
  if not v_rejected then raise exception 'FAIL: a 200 KB+ image row was accepted'; end if;

  raise notice 'PASS title, close reason and image size guards';
end $$;

-- The lockdown posture itself: no table may be readable by anon, and all must have RLS on.
do $$
declare v_open text; v_granted text;
begin
  select string_agg(tablename, ', ') into v_open
    from pg_tables where schemaname = 'agora' and rowsecurity = false;
  if v_open is not null then raise exception 'FAIL: RLS is off on %', v_open; end if;

  select string_agg(distinct table_name, ', ') into v_granted
    from information_schema.role_table_grants
   where table_schema = 'agora' and grantee in ('anon', 'authenticated');
  if v_granted is not null then raise exception 'FAIL: anon still holds grants on %', v_granted; end if;

  raise notice 'PASS rls enabled everywhere and anon holds no table grants';
end $$;
