# Architecture

A small Next.js app that renders pages on the server straight from the plugin's database. No
API layer in between, no ORM, no client-side data fetching (except the search suggestions), no
build-time data. One process, one container.

```
browser ── GET /player/Steve ──▶ Next.js server component (src/app/player/[name]/page.tsx)
                                   │  calls query functions
                                   ▼
                                 src/lib/queries/*.ts   ← plain SQL, cached in memory for cacheSeconds
                                   │  db().all(sql, params)
                                   ▼
                                 src/lib/db/            ← one tiny interface, two drivers
                                   ├─ mysql.ts   (mysql2 pool)
                                   └─ sqlite.ts  (node:sqlite, read-only, built into Node 22+)
                                   │
                                 the plugin's database (read-only)
                                   │  JSON columns
                                   ▼
                                 src/lib/sp/            ← parsers for StrikePractice's formats
                                   ├─ fight-data.ts  fight_data / player_data JSON
                                   ├─ items.ts       4 item formats → one Item
                                   ├─ legacy.ts      1.8 names/ids/enchantments → modern ids
                                   ├─ potions.ts     potion data values, effects, colors
                                   └─ colors.ts      § color codes
```

## Folders

| Path | What |
|---|---|
| `src/app/` | Routes (App Router). Each `page.tsx` loads its data with `Promise.all` and renders. |
| `src/app/page.tsx` | Home: hero, number one, ladder top 10, latest fights, activity |
| `src/app/leaderboards/[board]/` | Leaderboards. Board ids: `elo`, `wins`, `kills`, event ids, or a kit name |
| `src/app/player/[name]/` | Profile. Accepts name, old name or UUID; redirects to the current name |
| `src/app/fight/[id]/` | One fight: tale of the tape, inventories, replay command. Also accepts the start time (the plugin's links) and redirects to the id |
| `src/app/fights/` | All fights, filterable |
| `src/app/api/search`, `api/health` | Search suggestions (JSON); health check for Docker |
| `src/app/branding/[...path]` | Serves files from `branding/` (mounted in Docker, so no rebuild for a new logo) |
| `src/components/` | UI. `minecraft.tsx` (inventory, tooltips, hearts) is the in-game look; the rest is the site's own |
| `src/lib/config.ts` | `config.yml` schema (zod) and loader; re-reads the file when it changes |
| `src/lib/queries/` | All SQL. `players.ts`, `fights.ts`, `leaderboards.ts`, `kits.ts`, `server.ts` |
| `src/lib/images.ts` | Head/skin/item/texture URLs from the config templates; arena banners |
| `src/lib/cache.ts` | In-memory TTL cache with in-flight de-duplication |
| `scripts/doctor.ts` | Setup checker (config, connection, tables, indexes, parse rate) |
| `scripts/make-sample-data.ts` | Builds the anonymized demo database from a real one |
| `sample-data/demo.db` | The demo database (SQLite, anonymized), used when `DATABASE_URL` is unset |
| `branding/` | Logo and arena images (`branding/arenas/<arena>.webp`) |
| `config.yml` | Site settings (name, IP, colors, kit names, image sources) |

## Decisions and why

- **Server components + plain SQL.** Pages are mostly tables and numbers; rendering them on the
  server means no API to design, no loading spinners, tiny client JS. SQL is written once for both
  databases (`?` placeholders; the two differences go through `db.dialect`).
- **Read-only.** The site never writes, never migrates, never creates indexes. The plugin owns the
  schema. Recommend a `SELECT`-only database user.
- **`node:sqlite` instead of better-sqlite3.** No native module to compile in Docker or on Windows.
  Needs Node ≥ 22.13; prints an "experimental" warning (silenced in the Docker image).
- **Runtime config (`config.yml`), not env vars or code.** Server owners re-brand without
  rebuilding; agents and forks can still change anything in code. Secrets stay in env (`DATABASE_URL`).
- **In-memory cache instead of Next's data cache.** Explicit, easy to reason about, works the same
  in dev and prod. Heavy queries (wins board, kit catalog, activity) get a multiplier on
  `cacheSeconds`. Everything is `force-dynamic` (set in the root layout) because the data lives in
  a database that only exists at runtime.
- **Images from public CDNs by default** (mc-heads.net for skins, mc.nerothe.com for rendered item
  icons, assets.mcasset.cloud for raw textures). No Minecraft assets are committed to this repository.
  All three are URL templates in `config.yml` so they can be self-hosted. Potions are tinted in CSS
  (bottle + overlay mask) because icon services draw every potion the same color.
- **Fights are listed by `id`, players' fights by `fp.fight`.** Both are indexed orderings; see
  docs/STRIKEPRACTICE-DATA.md for why `fight` sorts correctly.

## Performance notes

Written for databases up to a few million fights. The expensive parts, all cached:
- **Wins leaderboard:** `GROUP BY uuid` over all of `fight_players` (cached 5× longer).
- **Kit catalog:** `GROUP BY kit` over `fights` + reading the newest `fight_data` of each kit (10×).
- **Placements on a profile:** one full scan of `stats` that computes all ladder ranks at once.
- **Rivals:** limited to the player's newest 1000 fights.

If a page gets slow: run `npm run doctor` for missing indexes, raise `cacheSeconds`, and check the
queries in `src/lib/queries/` with `EXPLAIN`.

## Adding things

- **A new stat on the profile:** add a query function in `src/lib/queries/players.ts` (wrap it in
  `cached()`), call it from the page's `Promise.all`, render it. If it comes from the JSON columns,
  parse it in `src/lib/sp/fight-data.ts` and add a test.
- **A new page:** a folder under `src/app/` with `page.tsx`. Use the existing components and tokens
  (see docs/DESIGN.md). Add it to `NavLinks` if it belongs in the header.
- **A JSON API:** route handlers under `src/app/api/` that call the same query functions.
- **A config option:** add it to the zod schema in `src/lib/config.ts` **and** document it in
  `config.yml`.
