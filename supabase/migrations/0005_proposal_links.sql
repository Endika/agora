-- Proposals link to each other ("related to" / "supersedes"), which is how the spec says you insist
-- on something that was rejected: a new proposal that points at the old one. The payload carries
-- them, and both writers replace the set rather than accumulating duplicates.

create or replace function agora.set_links(p_proposal uuid, p_links json)
returns void language plpgsql security definer set search_path = '' as $$
declare v_link json;
begin
  if json_array_length(p_links) > 10 then
    raise exception 'at most 10 links per proposal' using errcode = 'PT400';
  end if;
  delete from agora.proposal_links where from_id = p_proposal;
  for v_link in select json_array_elements(p_links) loop
    insert into agora.proposal_links (from_id, to_id, kind)
    values (p_proposal, (v_link->>'toId')::uuid, (v_link->>'kind')::agora.link_kind)
    on conflict do nothing;
  end loop;
end;
$$;
revoke all on function agora.set_links(uuid, json) from public, anon, authenticated;

create or replace function agora.create_proposal(p_device_token text, p_slug text, p_payload json)
returns uuid language plpgsql security definer set search_path = '' as $$
-- The payload is cast to jsonb: `?` (does the key exist) is a jsonb operator, and on plain json it
-- fails at runtime with "operator does not exist: json ? unknown".
declare v_group uuid; v_me uuid; v_id uuid; v_recent int; v_tag text; v_tags jsonb;
        v_payload jsonb := p_payload::jsonb;
begin
  v_group := agora.group_by_slug(p_slug);
  v_me := agora.actor(p_device_token, v_group);

  select count(*) into v_recent from agora.proposals
   where created_by = v_me and created_at > now() - interval '1 hour';
  perform agora.throttle(v_recent, 20, 'proposals');

  insert into agora.proposals (group_id, created_by, title, description, deadline, estimated_cents)
  values (v_group, v_me,
          v_payload->>'title',
          coalesce(v_payload->>'description', ''),
          (v_payload->>'deadline')::timestamptz,
          (v_payload->>'estimatedCents')::int)
  returning id into v_id;

  v_tags := coalesce(v_payload->'tags', '[]'::jsonb);
  if jsonb_array_length(v_tags) > 12 then
    raise exception 'at most 12 tags' using errcode = 'PT400';
  end if;
  for v_tag in select jsonb_array_elements_text(v_tags) loop
    insert into agora.proposal_tags (proposal_id, tag) values (v_id, v_tag) on conflict do nothing;
  end loop;

  if v_payload ? 'links' then
    perform agora.set_links(v_id, (v_payload->'links')::json);
  end if;

  perform agora.log(v_group, v_id, v_me, 'proposal_created', v_payload->>'title');
  return v_id;
end;
$$;

create or replace function agora.update_proposal(p_device_token text, p_proposal uuid, p_payload json)
returns void language plpgsql security definer set search_path = '' as $$
declare v_group uuid; v_me uuid; v_status agora.proposal_status; v_tag text; v_tags jsonb;
        v_payload jsonb := p_payload::jsonb;
begin
  v_group := agora.group_of_proposal(p_proposal);
  v_me := agora.actor(p_device_token, v_group);
  select status into v_status from agora.proposals where id = p_proposal;
  if v_status in ('completed', 'closed', 'rejected') then
    raise exception 'proposal is closed for edits' using errcode = 'PT409';
  end if;

  update agora.proposals
     set title = coalesce(v_payload->>'title', title),
         description = coalesce(v_payload->>'description', description),
         deadline = case when v_payload ? 'deadline' then (v_payload->>'deadline')::timestamptz else deadline end,
         estimated_cents = case when v_payload ? 'estimatedCents'
                                then (v_payload->>'estimatedCents')::int else estimated_cents end,
         updated_at = now()
   where id = p_proposal;

  if v_payload ? 'tags' then
    v_tags := v_payload->'tags';
    if jsonb_array_length(v_tags) > 12 then
      raise exception 'at most 12 tags' using errcode = 'PT400';
    end if;
    delete from agora.proposal_tags where proposal_id = p_proposal;
    for v_tag in select jsonb_array_elements_text(v_tags) loop
      insert into agora.proposal_tags (proposal_id, tag) values (p_proposal, v_tag) on conflict do nothing;
    end loop;
  end if;

  if v_payload ? 'links' then
    perform agora.set_links(p_proposal, (v_payload->'links')::json);
  end if;

  perform agora.log(v_group, p_proposal, v_me, 'proposal_edited', '');
end;
$$;
