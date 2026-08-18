-- The board payload carries the first three comments of each thread, because history and comments are
-- what grow without bound and an uncapped payload is what blows an egress budget. The rest is fetched
-- only when somebody actually opens the thread.

create or replace function agora.get_thread_comments(p_slug text, p_device_token text, p_thread uuid)
returns json language plpgsql security definer set search_path = '' as $$
declare v_group uuid; v_proposal uuid;
begin
  v_group := agora.group_by_slug(p_slug);
  perform agora.actor(p_device_token, v_group);

  select th.proposal_id into v_proposal
    from agora.comment_threads th
    join agora.proposals pr on pr.id = th.proposal_id
   where th.id = p_thread and pr.group_id = v_group;
  if v_proposal is null then raise exception 'unknown thread' using errcode = 'PT404'; end if;

  return coalesce((
    select json_agg(json_build_object('id', c.id, 'authorId', c.author_id,
                                      'body', c.body, 'createdAt', c.created_at)
                    order by c.created_at)
      from agora.comments c where c.thread_id = p_thread), '[]'::json);
end;
$$;

grant execute on function agora.get_thread_comments(text, text, uuid) to anon;
