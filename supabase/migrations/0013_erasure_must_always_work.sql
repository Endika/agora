-- Deleting an agora with anything in it failed.
--
-- `proposals.created_by`, `comment_threads.author_id` and `comments.author_id` referenced participants with
-- ON DELETE RESTRICT. Deleting a group cascades to both its participants and its proposals, and the restrict
-- fires in between: "update or delete on table participants violates foreign key constraint". So the one
-- operation the privacy notice promises — erase everything — worked only on an empty agora, which is the
-- kind nobody deletes.
--
-- Cascade is right here: a participant is never deleted on their own in v1, and the only path that removes
-- one is the deletion of the whole agora, where their proposals and comments go anyway.

alter table agora.proposals
  drop constraint if exists proposals_created_by_fkey,
  add constraint proposals_created_by_fkey
    foreign key (created_by) references agora.participants(id) on delete cascade;

alter table agora.comment_threads
  drop constraint if exists comment_threads_author_id_fkey,
  add constraint comment_threads_author_id_fkey
    foreign key (author_id) references agora.participants(id) on delete cascade;

alter table agora.comments
  drop constraint if exists comments_author_id_fkey,
  add constraint comments_author_id_fkey
    foreign key (author_id) references agora.participants(id) on delete cascade;
