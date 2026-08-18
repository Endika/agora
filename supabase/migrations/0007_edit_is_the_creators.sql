-- Editing a proposal is the creator's, and only while it is not finished.
--
-- Until now any participant could edit any proposal. With votes already cast that is worse than a
-- typo fix: it lets the text change under the people who voted on it. The history row stays, so an
-- edit is always visible to the group.

create or replace function agora.update_proposal(p_device_token text, p_proposal uuid, p_payload json)
returns void language plpgsql security definer set search_path = '' as $$
declare v_group uuid; v_me uuid; v_creator uuid; v_status agora.proposal_status;
        v_tag text; v_tags jsonb; v_payload jsonb := p_payload::jsonb;
begin
  v_group := agora.group_of_proposal(p_proposal);
  v_me := agora.actor(p_device_token, v_group);
  select created_by, status into v_creator, v_status from agora.proposals where id = p_proposal;

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

  perform agora.log(v_group, p_proposal, v_me, 'proposal_edited', '');
end;
$$;
