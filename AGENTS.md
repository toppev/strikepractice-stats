<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# AGENTS.md

Guide for AI agents (and humans) working on this repository: a self-hostable stats website for
Minecraft servers running the **StrikePractice** practice-PvP plugin. It reads the plugin's
database and shows leaderboards, player profiles and fights.

This project is maintained mostly by agents, and server owners hand their fork to agents to
rebrand and extend. Keep it small, plain and documented. Read these before changing things:

| Read | When |
|---|---|
| [docs/NOTES.md](docs/NOTES.md) | Always first: context, scope, status, ideas, and what may go in this **public** repo. Update Status/Ideas when they change. |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | Before adding pages, queries, config options |
| [docs/STRIKEPRACTICE-DATA.md](docs/STRIKEPRACTICE-DATA.md) | Before writing any SQL or touching parsers. The plugin's schema has traps. |
| [docs/DESIGN.md](docs/DESIGN.md) | Before any UI work: tokens, type, layout rules |
| [docs/CUSTOMIZING.md](docs/CUSTOMIZING.md), [docs/DEPLOYING.md](docs/DEPLOYING.md) | When helping a server owner set it up or rebrand |

## Commands

```sh
npm install
npm run dev          # http://localhost:3000, uses sample-data/demo.db when DATABASE_URL is unset
npm run typecheck    # tsc
npm test             # unit tests (parsers): src/**/*.test.ts with node:test via tsx
npm run doctor       # checks config.yml, the database, indexes, how much fight JSON parses
npm run build        # production build (also what the Dockerfile runs)
docker compose up -d --build
```

Point at a real database with `DATABASE_URL=mysql://user:pass@host:3306/db` or
`DATABASE_URL=sqlite:///path/to/database.db`.

## Rules

- **This repository is public**, and so is every commit message and PR. No session or decision
  logs in the repo: explain what changed and why in the commit message. Check the diff and the
  message before committing: no real players' names/UUIDs/data, no hosts, domains, paths or
  credentials of a real deployment, no private repos or unreleased plans (details in docs/NOTES.md).
- **Read-only.** Never write to, migrate, or create indexes in the plugin's database from the app.
  The plugin owns the schema. (The doctor *prints* `CREATE INDEX` for humans to run.)
- **One SQL for both databases.** Use `?` placeholders and the `db().dialect` helpers. Test against
  SQLite (the demo) and, when you touch queries, MySQL/MariaDB too
  (`docker run -d -e MARIADB_ROOT_PASSWORD=dev -e MARIADB_DATABASE=sp -p 3307:3306 mariadb:10`, then load a dump).
- **Never splice user input into SQL.** Column names (elo columns) must match `COLUMN_RE` and come
  from the real column list.
- **Every query goes through `cached()`** (src/lib/cache.ts) and lives in `src/lib/queries/`.
- **Parsers are defensive.** JSON in the database comes from many plugin and Minecraft versions; a
  field you can't read costs one detail on the page, never the page. Add real samples to
  `src/lib/sp/sp.test.ts` when you add a format.
- **Config changes go in two places:** the zod schema in `src/lib/config.ts` and the commented
  `config.yml`. Secrets never go in `config.yml`.
- **Design:** use the tokens in `src/app/globals.css` (no hard-coded colors outside the Minecraft
  pieces), follow docs/DESIGN.md, check 390 px wide. Minecraft styling is only for things from the game.
- **Demo data must stay anonymized.** Regenerate it only with `scripts/make-sample-data.ts`, which checks
  for leaks. Never commit a real database or dump.
- **No Minecraft assets in the repo** (textures, the game's fonts). Load them by URL (config `images.*`).
- **The container is read-only** (compose `read_only: true`, app files owned by root, no capabilities).
  Code that writes files must use `/tmp` or a volume you add to `docker-compose.yml`; don't drop the hardening.
- **URL input is untrusted.** Route `params` arrive already decoded (don't `decodeURIComponent` them
  again); a repeated query parameter arrives as an array, so read them with `oneParam()`/`pageParam()`.
- **Next.js 16:** `params`/`searchParams` are Promises; pages are dynamic (the root layout sets
  `dynamic = "force-dynamic"`); check `node_modules/next/dist/docs/` for anything else.
- **Dependencies: few, pinned exactly.** `.npmrc` only installs releases that are at least 7 days old
  (`min-release-age`), refuses git dependencies and runs no install scripts. Don't loosen it to make
  an install pass: pick an older version. If a new package truly needs its install script, say so
  in the PR instead of turning scripts back on.
- Match the surrounding code: comments explain *why*, names are plain, no clever abstractions.

## Verifying a change

1. `npm run typecheck && npm test`
2. `npm run dev` and open the pages you changed, at desktop and phone width. The demo database has
   ranked and unranked fights, 1.8-era and 26.1 items, potions, enchantments and name history.
   Good pages to check: `/`, `/leaderboards/nodebuffelo`, `/player/toppev`, `/fight/10198` (26.1
   items), `/fight/8985` (1.8 NoDebuff potions).
3. If you changed SQL, also run against MySQL/MariaDB and `npm run doctor`.
4. Say in the commit or PR what you changed, why, and what you checked (it's public: see the first rule).

## Map

```
src/app/                 routes: home, leaderboards/[board], player/[name], fight/[id], fights, api/*, branding/*
src/components/          UI; minecraft.tsx = inventory/tooltips/hearts; fight-row.tsx; elo-chart.tsx
src/lib/config.ts        config.yml schema + loader
src/lib/db/              Database interface, mysql.ts, sqlite.ts
src/lib/queries/         all SQL (players, fights, leaderboards, kits, server)
src/lib/sp/              StrikePractice formats: fight JSON, items, legacy ids, potions, § colors
src/lib/images.ts        image URL templates, arena banners
src/proxy.ts             rate limit per visitor (src/lib/rate-limit.ts)
scripts/                 doctor.ts, make-sample-data.ts
sample-data/demo.db      anonymized demo database
branding/                logo and arena images, served at /branding/*
config.yml               site settings (committed, edited in place)
```
