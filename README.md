# Agora

A proposal board for a small group. Someone proposes an idea, everyone votes once, the thread
sorts out the doubts, and whatever gets approved moves to a queue — with its cost split if it
has one. No accounts, no login: you join an agora through its link and pick your name from the
list.

Every vote is secret while its proposal is open. What happens when the proposal closes is the one
thing each agora chooses for itself, once, when it is created, and can never change afterwards:

- **Open ballot** — closing publishes every vote with the name of whoever cast it, whether the
  proposal closed because everybody voted or because its deadline passed.
- **Secret ballot** — the votes are published without any name, and only once everybody has voted.
  If the deadline gets there first the proposal closes undecided and its votes are never published
  at all, because with a partial ballot the outcome would give them away.

## Status

Deployed. The frontend lives on GitHub Pages and the database is the `agora` schema of the
`apps-prod` Supabase project, shared with the other apps.

## Stack

React 19 · TypeScript · Vite · Tailwind · vitest · Supabase (Postgres + Storage) · PWA,
offline-first.

## Architecture

Ports and adapters, with the dependency rule enforced by ESLint rather than by good intentions:

- `src/domain` — entities, value objects and services. Framework-free; imports nothing.
- `src/application` — one use case per action, talking to ports only.
- `src/infrastructure` — the adapters: Supabase RPCs, IndexedDB cache, image pipeline.
- `src/presentation` — React. Receives its adapters by injection; never imports one directly.
- `src/shared/di` — the composition root, the only place that wires the two sides together.

Crossing a boundary fails `npm run lint`.

## Development

```bash
npm install
npm run dev
```

Copy `.env.example` to `.env.local` and fill it in.

The local backend is **one Postgres container** — no Supabase stack, because everything verified
locally is SQL:

```bash
npm run db:up        # start it (postgres:17-alpine)
npm run db:migrate   # apply supabase/migrations
npm run test:sql     # run the assertions in tests/sql
npm run db:down      # throw it away
```

## Verification

The gates CI runs, and the ones to run before pushing:

```bash
npm run format:check
npm run lint
npm run type:check
npm run test:run
```

## Deploying

Merging to `main` publishes the frontend and **nothing else**: `deploy.yml` runs `npm ci`,
`npm run build` and uploads to Pages. `ci.yml` applies the migrations to a throwaway Postgres for
the tests. **No workflow ever touches the production database.**

So a change that adds a file to `supabase/migrations` is deployed by hand, in this order, and the
order is not a preference:

1. Apply the migration to production, as one query, with a Supabase personal access token:

   ```bash
   curl -sS -X POST \
     "https://api.supabase.com/v1/projects/$PROJECT_REF/database/query" \
     -H "Authorization: Bearer $SUPABASE_PAT" \
     -H 'Content-Type: application/json' \
     --data @<(jq -Rs '{query: .}' supabase/migrations/00NN_whatever.sql)
   ```

   Send the file whole. `npm run db:migrate` sends each file as a single query too, and CI runs it
   on every push, so a migration that needed splitting would already have failed there.

2. Make PostgREST forget its schema cache, or it will not see a new or changed RPC signature:

   ```sql
   notify pgrst, 'reload schema';
   ```

3. **Then** merge, which publishes the frontend.

One thing that window costs, so it is a decision and not a surprise: until step 3 publishes the
new frontend, the deployed one still calls the four-argument `create_group`, which means an **open**
ballot. Any agora created between steps 1 and 3 is open, and that cannot be undone. Deploy when
nobody is starting an agora, or accept it.

The reason for that order is that migrations here are written to be backwards-compatible — a new
column arrives with a default, a changed RPC keeps its old signature as a wrapper — so the
**deployed** frontend keeps working between steps 1 and 3. The reverse is not true: a frontend
that expects a column the database does not have yet is a blank board for everyone, not a
degraded one, because `parseBoard` rejects the payload outright.

## Licence

MIT — see [LICENSE](LICENSE).
