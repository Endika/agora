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

## Development

```bash
npm install
npm run dev
```

Copy `.env.example` to `.env.local` and fill it with a Supabase URL and anon key. For a local
database, `npx supabase start` prints both.

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
