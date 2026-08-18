-- Adding a new person from a device that already belongs to someone.
--
-- The previous version short-circuited on the device token: if this phone was already a participant it
-- returned that participant and ignored the name, so "switch person → I am someone new" handed you back
-- to yourself. Idempotency now hangs off the *name*: asking again for the name this device holds returns
-- it, and asking for a different one adds that person.
--
-- The subtler bug that fix exposed: a device token must belong to exactly one participant. Inserting a
-- second participant with the same token left two rows carrying it, and agora.actor() — a plain
-- `select ... where device_token_hash = ...` — would have failed with "more than one row returned by a
-- subquery". So the device is released from its previous holder, and a unique index makes it impossible
-- to get wrong again.

-- Whoever held this device stops holding it. Their name stays, and they can claim it back from any
-- device: that is what claim_participant is for.
create or replace function agora.release_device(p_group uuid, p_device_token text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  update agora.participants
     set device_token_hash = agora.token_hash(gen_random_uuid()::text, p_group::text)
   where group_id = p_group
     and device_token_hash = agora.token_hash(p_device_token, p_group::text);
end;
$$;
revoke all on function agora.release_device(uuid, text) from public, anon, authenticated;

create or replace function agora.add_participant(p_slug text, p_name text, p_device_token text)
returns json language plpgsql security definer set search_path = '' as $$
declare v_group uuid; v_me uuid; v_current uuid; v_current_name text; v_name text;
begin
  v_group := agora.group_by_slug(p_slug);
  v_name := btrim(p_name);
  if char_length(v_name) = 0 then
    raise exception 'a participant needs a name' using errcode = 'PT400';
  end if;

  select id, name into v_current, v_current_name from agora.participants
   where group_id = v_group and device_token_hash = agora.token_hash(p_device_token, v_group::text);

  -- The same call twice: this device already is that person.
  if v_current is not null and lower(v_current_name) = lower(v_name) then
    return json_build_object('ok', true, 'slug', p_slug, 'participant_id', v_current);
  end if;

  perform agora.release_device(v_group, p_device_token);

  begin
    insert into agora.participants (group_id, name, device_token_hash)
    values (v_group, v_name, agora.token_hash(p_device_token, v_group::text))
    returning id into v_me;
  exception when unique_violation then
    raise exception 'name taken' using errcode = 'PT409';
  end;

  perform agora.log(v_group, null, v_me, 'joined', v_name);
  return json_build_object('ok', true, 'slug', p_slug, 'participant_id', v_me);
end;
$$;

create or replace function agora.claim_participant(p_slug text, p_participant uuid, p_device_token text)
returns json language plpgsql security definer set search_path = '' as $$
declare v_group uuid; v_name text;
begin
  v_group := agora.group_by_slug(p_slug);
  select name into v_name from agora.participants where id = p_participant and group_id = v_group;
  if v_name is null then raise exception 'unknown participant' using errcode = 'PT404'; end if;

  -- Same reason as above: this device can only belong to one person at a time.
  perform agora.release_device(v_group, p_device_token);

  update agora.participants
     set device_token_hash = agora.token_hash(p_device_token, v_group::text)
   where id = p_participant;

  perform agora.log(v_group, null, p_participant, 'claimed', v_name);
  return json_build_object('ok', true, 'slug', p_slug, 'participant_id', p_participant);
end;
$$;

-- Rows that already share a device token — the bug above, as it happened in production — have to be
-- separated before the index can exist. The newest keeps the device; the others get a random hash and
-- their owner can claim the name back from any device, which is what claim_participant is for.
with ranked as (
  select id,
         row_number() over (partition by group_id, device_token_hash order by created_at desc) as rn
    from agora.participants
)
update agora.participants p
   set device_token_hash = agora.token_hash(gen_random_uuid()::text, p.group_id::text)
  from ranked r
 where r.id = p.id and r.rn > 1;

create unique index if not exists participants_device_idx
  on agora.participants (group_id, device_token_hash);
