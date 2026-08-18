-- Proposing something that costs money means you are in for it, unless you say otherwise.
--
-- Before this, adding an amount changed nothing visible: `shares` came back empty, so the board showed no
-- split and the person who had just typed "120 €" was left wondering what the amount was for. The opt-in
-- button was there, but a UI that needs to be discovered before it does anything is a UI that failed.

create or replace function agora.opt_creator_in(p_proposal uuid, p_creator uuid)
returns void language sql security definer set search_path = '' as $$
  insert into agora.expense_shares (proposal_id, participant_id, opted_in)
  values (p_proposal, p_creator, true)
  on conflict (proposal_id, participant_id) do nothing;
$$;
revoke all on function agora.opt_creator_in(uuid, uuid) from public, anon, authenticated;

create or replace function agora.create_proposal(p_device_token text, p_slug text, p_payload json)
returns uuid language plpgsql security definer set search_path = '' as $$
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

  -- The split needs somebody in it to exist at all, and the proposer is the obvious first one.
  if (v_payload->>'estimatedCents') is not null then
    perform agora.opt_creator_in(v_id, v_me);
  end if;

  perform agora.log(v_group, v_id, v_me, 'proposal_created', v_payload->>'title');
  return v_id;
end;
$$;

create or replace function agora.update_proposal(p_device_token text, p_proposal uuid, p_payload json)
returns void language plpgsql security definer set search_path = '' as $$
declare v_group uuid; v_me uuid; v_creator uuid; v_status agora.proposal_status;
        v_tag text; v_tags jsonb; v_payload jsonb := p_payload::jsonb; v_had int;
begin
  v_group := agora.group_of_proposal(p_proposal);
  v_me := agora.actor(p_device_token, v_group);
  select created_by, status, estimated_cents into v_creator, v_status, v_had
    from agora.proposals where id = p_proposal;

  if v_me <> v_creator then
    raise exception 'only the creator may edit the proposal' using errcode = 'PT403';
  end if;
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

  -- An amount added after the fact opts the creator in too, for the same reason.
  if v_had is null and (v_payload->>'estimatedCents') is not null then
    perform agora.opt_creator_in(p_proposal, v_creator);
  end if;

  perform agora.log(v_group, p_proposal, v_me, 'proposal_edited', '');
end;
$$;
