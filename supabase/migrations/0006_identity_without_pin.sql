-- Identity without a PIN (respec, 18 Aug 2026).
--
-- Asking for a name *and* a PIN was two facts for one purpose, and the PIN read as a password for an
-- app that deliberately has no accounts. Now identity works the way EventSplit and Monete already do:
-- open the link, pick your name from the list, and if you are not on it, add yourself.
--
-- What this costs, stated rather than hidden: anyone holding the link can claim any name, the
-- creator's included. The spec already accepted that ("the group is one that trusts each other"), and
-- the PIN never actually prevented it — it only protected moving a name to a second device.
--
-- Deleting an agora is therefore guarded by typing its name: protection against a slip, which is the
-- real risk, not against someone who means harm.

-- Same body and same salt as the old pin_hash, so device tokens issued before this migration keep
-- resolving to the same participant.
create or replace function agora.token_hash(p_secret text, p_id text)
returns text language sql immutable set search_path = extensions, public as $$
  select encode(digest(p_secret || '|' || p_id || '|agora-v1', 'sha256'), 'hex');
$$;
revoke all on function agora.token_hash(text, text) from public, anon, authenticated;

create or replace function agora.actor(p_device_token text, p_group uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_id uuid;
begin
  select id into v_id from agora.participants
   where group_id = p_group
     and device_token_hash = agora.token_hash(p_device_token, p_group::text);
  if v_id is null then raise exception 'unknown participant' using errcode = 'PT403'; end if;
  return v_id;
end;
$$;
revoke all on function agora.actor(text, uuid) from public, anon, authenticated;

-- The "who are you?" payload: the agora's name and the names in it. No token needed, because this is
-- exactly what someone opening the link for the first time has to see. Nothing else is exposed —
-- no proposals, no votes, no comments.
create or replace function agora.get_agora_preview(p_slug text)
returns json language plpgsql security definer set search_path = '' as $$
declare v_group uuid;
begin
  v_group := agora.group_by_slug(p_slug);
  return json_build_object(
    'slug', p_slug,
    'name', (select name from agora.groups where id = v_group),
    'participants', coalesce((
      select json_agg(json_build_object('id', p.id, 'name', p.name) order by p.created_at)
        from agora.participants p where p.group_id = v_group), '[]'::json));
end;
$$;

-- "That one is me": point the name at this device. Idempotent, and it moves the identity across
-- devices the way the PIN used to, without the PIN.
create or replace function agora.claim_participant(p_slug text, p_participant uuid, p_device_token text)
returns json language plpgsql security definer set search_path = '' as $$
declare v_group uuid; v_name text;
begin
  v_group := agora.group_by_slug(p_slug);
  select name into v_name from agora.participants where id = p_participant and group_id = v_group;
  if v_name is null then raise exception 'unknown participant' using errcode = 'PT404'; end if;

  update agora.participants
     set device_token_hash = agora.token_hash(p_device_token, v_group::text)
   where id = p_participant;

  perform agora.log(v_group, null, p_participant, 'claimed', v_name);
  return json_build_object('ok', true, 'slug', p_slug, 'participant_id', p_participant);
end;
$$;

-- "I am not on the list": add a name. Anyone in the agora can do this, which is how a group grows.
create or replace function agora.add_participant(p_slug text, p_name text, p_device_token text)
returns json language plpgsql security definer set search_path = '' as $$
declare v_group uuid; v_me uuid;
begin
  v_group := agora.group_by_slug(p_slug);
  if char_length(btrim(p_name)) = 0 then
    raise exception 'a participant needs a name' using errcode = 'PT400';
  end if;

  -- The same device coming back is not a second participant.
  select id into v_me from agora.participants
   where group_id = v_group and device_token_hash = agora.token_hash(p_device_token, v_group::text);
  if v_me is not null then
    return json_build_object('ok', true, 'slug', p_slug, 'participant_id', v_me);
  end if;

  begin
    insert into agora.participants (group_id, name, device_token_hash)
    values (v_group, btrim(p_name), agora.token_hash(p_device_token, v_group::text))
    returning id into v_me;
  exception when unique_violation then
    -- Already there: this is a claim, not a join.
    raise exception 'name taken' using errcode = 'PT409';
  end;

  perform agora.log(v_group, null, v_me, 'joined', btrim(p_name));
  return json_build_object('ok', true, 'slug', p_slug, 'participant_id', v_me);
end;
$$;

-- No PIN on creation either.
drop function if exists agora.create_group(text, text, text, text, text);
create or replace function agora.create_group(
  p_name text, p_slug text, p_creator_name text, p_device_token text
) returns json language plpgsql security definer set search_path = '' as $$
declare v_group uuid; v_me uuid;
begin
  if p_slug !~ '^[a-z0-9]{8}$' then raise exception 'bad slug' using errcode = 'PT400'; end if;
  if char_length(btrim(p_name)) = 0 then
    raise exception 'an agora needs a name' using errcode = 'PT400';
  end if;

  begin
    insert into agora.groups (name, slug) values (btrim(p_name), p_slug) returning id into v_group;
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

-- Erasure, guarded by typing the agora's name.
drop function if exists agora.delete_group(text, text, text);
create or replace function agora.delete_group(
  p_device_token text, p_slug text, p_confirm_name text
) returns json language plpgsql security definer set search_path = '' as $$
declare v_group uuid; v_name text; v_paths json;
begin
  v_group := agora.group_by_slug(p_slug);
  perform agora.actor(p_device_token, v_group);
  select name into v_name from agora.groups where id = v_group;

  if lower(btrim(coalesce(p_confirm_name, ''))) <> lower(v_name) then
    return json_build_object('ok', false, 'error', 'name_mismatch');
  end if;

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

-- Everything the PIN needed is now unused.
drop function if exists agora.recover_participant(text, text, text, text);
drop function if exists agora.join_group(text, text, text, text);
drop function if exists agora.pin_guard(uuid);
drop function if exists agora.pin_fail(uuid);
drop function if exists agora.pin_ok(uuid);
drop function if exists agora.pin_hash(text, text);
drop table if exists agora.pin_attempts;
alter table agora.participants drop column if exists pin_hash;

grant execute on function agora.get_agora_preview(text) to anon;
grant execute on function agora.claim_participant(text, uuid, text) to anon;
grant execute on function agora.add_participant(text, text, text) to anon;
grant execute on function agora.create_group(text, text, text, text) to anon;
grant execute on function agora.delete_group(text, text, text) to anon;

comment on table agora.participants is
  'PERSONAL DATA: display names chosen by people and an opaque per-agora device-token hash. No emails, no accounts, no PINs, no special categories. The names in an agora are readable by anyone holding its link, which is what the "who are you?" picker needs. Lawful basis: legitimate interest in running the board the group asked for. Erasure: the delete_group RPC, confirmed by typing the agora name.';
