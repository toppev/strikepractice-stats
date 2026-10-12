# Project notes

Context, decisions, status and ideas, so the next session (human or agent) starts where the last one
stopped. **Update the status and the session log at the end of every working session.**

## What this is

A stats website for servers running the StrikePractice plugin: leaderboards, player profiles,
fight history with final inventories. A starting point that server owners fork and make their own.

**Who it's for:** server owners who want a stats site with little effort, and who will often hand
it to an AI agent to rebrand or extend. So:

- It must be **good-looking by default** (most owners won't redesign it) and **whitelabel**
  (no StrikePractice branding forced on anyone; name, colors, logo from config).
- It must be **easy to set up**: one container, one `DATABASE_URL`, a demo that works with no setup,
  a doctor that says what's wrong.
- It must be **easy for agents to change**: small codebase, plain SQL, documented data model
  (docs/STRIKEPRACTICE-DATA.md), explicit design rules (docs/DESIGN.md), AGENTS.md as the entry point.
- It is **maintained mostly by AI agents**: prefer boring, robust choices over clever ones, and
  leave notes.
- **No support promise.** The README says it's a starting point; PRs welcome.

## Scope

In: read-only views of what the plugin stores (stats, ladders, saved fights, inventories), at
any size from a 10-player test server to a few million fights; MySQL/MariaDB and SQLite.

Out (unless someone builds it): writing to the database, accounts or logins, admin panels, live
server data, replay playback (the plugin's replay format is only playable in game).

## Stack (and why)

Next.js 16 (App Router, server components) + React 19 + Tailwind 4 + TypeScript. `mysql2` and Node's
built-in `node:sqlite` (no native build). `yaml` + `zod` for config. Docker image `node:24-alpine`,
standalone output. Tests use Node's test runner via `tsx`. No ORM, no state library, no UI kit:
fewer things to break and for agents to learn.

## Status

As of 2026-10-12 (session 1):

- ✅ Pages: home, leaderboards (global elo, wins, kills, every ranked kit, event wins), player
  profile, fight page, fights list, 404/error. Search with suggestions.
- ✅ Parsing of every stored item format (1.8 names, numeric ids, 1.20.5+ components, XSeries), potions,
  effects, § colors. Unit tests with real samples.
- ✅ MySQL/MariaDB and SQLite. Demo database (anonymized, 450 fights) used when `DATABASE_URL` is unset.
- ✅ Docker image + compose, `npm run doctor` (also in the image), sample data generator.
- ✅ The plugin's own fight links (match-link `<started>`, webhook `<fight_id>`: both the start
  time) open the fight: `/fight/<start time>` redirects to `/fight/<id>`.
- ✅ Docs: README, AGENTS.md, architecture, data model, design, customizing, deploying.
- ✅ Tested against a copy of the public test server's MariaDB (10k fights) and the demo SQLite;
  desktop and 390 px phone screenshots reviewed.
- ⏳ Not done yet: see ideas.

## Ideas (roughly by value / effort)

- **JSON API** (`/api/v1/players/:name`, `/leaderboards/:board`, `/fights/:id`) for Discord bots and
  in-game holograms. Cheap: route handlers over the existing query functions.
- **Share images** (Open Graph) for player and fight pages with `next/og`: a player card or the
  two fighters with the result. Makes links in Discord look great.
- **Elo tiers** (Bronze… Champion) as config bands with colors, shown next to elo.
- **Kit pages** `/kit/:name`: top players, recent fights, average fight length, win rate by elo gap.
- **"This week"** on the home page: biggest elo gains, most active players, longest streaks (from
  ranked fights' player_data).
- **Head-to-head** page `/vs/:a/:b` (the query is simple: self-join on `fight_players.fight`).
- **Server status** (online players, MOTD) via a server list ping, configurable host.
- **Light theme** as a ready token set.
- **i18n**: texts are inline in components; extract to a dictionary when someone needs it.
- **Self-hosted textures**: a script that downloads the client jar for a version and extracts
  item/block textures into `branding/textures`, plus a caching proxy route.

### Plugin-side ideas (would make the site better or cheaper)

- Migration that adds the indexes older MySQL installs may lack (`fight_players(fight)`,
  `fights(kit)`, `stats(username)`).
- Store `old_elo`/`new_elo`/`hits` as real columns on `fight_players` (now only inside the JSON),
  so elo history and stats boards don't need JSON parsing.
- `last_seen` / `first_joined` in `stats`.
- Save party and bot fights (now only duels are saved).
- A `kits` table with display name and icon, so names don't have to be dug out of fight JSON.

## Decisions log

- **2026-10-12** Data access is plain SQL behind a 2-method interface, not an ORM: the schema is
  the plugin's, dynamic (elo columns), and both dialects need the same queries.
- **2026-10-12** Obfuscated-format fights (a past build bug, keys like `hh`/`aI`) are not parsed:
  a migration converted most, leftovers show without details.
- **2026-10-12** `config.yml` is committed and edited in place (not a `.example`): forks keep their
  settings in git, and a Docker mount of a missing file would create a directory.
- **2026-10-12** No Minecraft textures in the repo: icons and skins load from public CDNs through
  configurable URL templates.
- **2026-10-12** Demo data: anonymized slice of the public test server (random UUIDs and generated
  names for everyone except the plugin author's own account). `scripts/make-sample-data.ts` refuses
  to write output that still contains an original name or UUID.
- **2026-10-12** Supply-chain settings in `.npmrc` (also copied into the Docker build):
  `min-release-age=7`, `allow-git=none`, `ignore-scripts=true`, `save-exact=true`. The only
  dependency with an install script is esbuild, which works without it.
- **2026-10-12** No published Docker image: every install is meant to be a fork with its own
  changes, so `docker compose up --build` builds it from the checkout. A shared image would also
  need regular releases to stay patched.

## Session log

### 2026-10-12, session 1
Built everything listed under Status, from scratch. Mapped the formats from the plugin
(`SavedFight`, `FightInventory`, `FightStatistics`) and a copy of a test server's MariaDB. Found:
hits are serialized as `kits`; `fight_players.fight` is the start time; older databases can lack
three indexes. Next: pick ideas from the list (JSON API and share images are the obvious next
ones).

### 2026-10-12, session 3
The plugin links fights by start time, not id (its chat link after a fight and its Discord
webhook), and sends the link before it saves the fight. `/fight/[id]` now also looks the number
up as a start time and redirects to the id; that lookup doesn't cache misses (`forget()` in
cache.ts), so a refresh finds a fight saved after the first click. Documented the plugin settings
in DEPLOYING.md. Checked: typecheck, tests, ids, start times, a trailing slash, a miss that
becomes a hit, and junk ids, on the demo SQLite and on MariaDB 10.

Then: the search box matches any part of a name ("ahmed" finds "iiAhmedYT"), names that start
with the text first. Took the `ESCAPE` fix for `_` along (it was the same query). Checked on SQLite
and MariaDB: substrings, case, `_`, empty and junk input.
