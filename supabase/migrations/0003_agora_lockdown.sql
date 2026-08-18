-- supabase/migrations/0003_agora_lockdown.sql
--
-- Scoped to schema agora on purpose: EventSplit's tables and grants in public are never touched.
-- 0001 already created the tables with RLS on and no grants, so this is the belt to that braces —
-- it also covers anything a future migration adds and forgets to lock.

revoke all on all tables in schema agora from anon, authenticated;
revoke all on all sequences in schema agora from anon, authenticated;
revoke create on schema agora from anon, authenticated;
alter default privileges in schema agora revoke all on tables from anon, authenticated;
alter default privileges in schema agora revoke all on functions from anon, authenticated;

-- PII tagging (GDPR): make the personal-data posture explicit for an audit.
comment on schema agora is
  'Agora: group proposal board. Shares this project with EventSplit (schema public) and never reads or writes it.';

comment on table agora.participants is
  'PERSONAL DATA: display names chosen by people, an opaque per-agora device-token hash and a salted edit-PIN hash. No emails, no accounts, no special categories, no minors targeted. Lawful basis: legitimate interest in running the board the group asked for. Erasure: the delete_group RPC removes the agora, its rows and the Storage objects it reports back.';
comment on column agora.participants.device_token_hash is
  'sha256 of an opaque client-generated token, salted with the agora id: not derivable from the name and useless in another agora.';
comment on column agora.participants.pin_hash is
  'Salted sha256 of the edit PIN. Verified only inside the RPCs, never compared in the client.';
comment on table agora.comments is
  'User-authored text; may incidentally contain personal data. Erasure via delete_group.';
comment on table agora.proposal_images is
  'Paths into the agora-images bucket. EXIF is stripped in the client before upload, so no embedded GPS reaches the server.';
comment on table agora.history is
  'Who did what, for the group to read. Contains participant ids, no free-form personal data beyond proposal titles and closing reasons.';
