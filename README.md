# Agora

A proposal board for a small group. Someone proposes an idea, everyone votes once, the thread
sorts out the doubts, and whatever gets approved moves to a queue — with its cost split if it
has one. No accounts, no login: you join an agora through its link, pick a name and set a PIN.

Votes stay secret until quorum. Then every vote is revealed at once.

## Status

Early development. The board is not deployed yet.

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

## Licence

MIT — see [LICENSE](LICENSE).
