# Project notes

Context, scope, status and ideas, so whoever works on this next (human or agent) has the picture.
Keep it current: update Status and Ideas when what they say changes.

## This repository is public

Everything here is public: files, commit messages, pull requests, test fixtures, screenshots. So:

- **No session logs or decision logs** in this file or anywhere else in the repo. What changed and
  why goes in the **commit message** (that's the record); lasting "why" belongs next to the thing it
  explains (a code comment, the relevant doc).
- **Before you commit, look at what you're publishing**, in the diff *and* the message. Not allowed:
  real players' names, UUIDs or data taken from someone's database (the demo database is
  anonymized for this reason; describe a case as "a name with `_` in it", not with a real name),
  hostnames, IPs, domains, paths or credentials of a real deployment, links to private repositories
  or unreleased plans, personal details. When unsure, leave it out and ask.

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
  explain them where the next agent will look (comments, docs, commit messages).
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

- ✅ Pages: home, leaderboards (global elo, wins, kills, every ranked kit, event wins), player
  profile, fight page, fights list, 404/error. Search with suggestions (any part of a name).
- ✅ Parsing of every stored item format (1.8 names, numeric ids, 1.20.5+ components, XSeries), potions,
  effects, § colors. Unit tests with real samples.
- ✅ MySQL/MariaDB and SQLite. Demo database (anonymized, 450 fights) used when `DATABASE_URL` is unset.
- ✅ Docker image + compose, `npm run doctor` (also in the image), sample data generator.
- ✅ The plugin's own fight links (match-link `<started>`, webhook `<fight_id>`: both the start
  time) open the fight: `/fight/<start time>` redirects to `/fight/<id>`.
- ✅ Docs: README, AGENTS.md, architecture, data model, design, customizing, deploying.
- ✅ Tested with a real MariaDB database (10k fights) and the demo SQLite; desktop and 390 px
  phone layouts reviewed.
- ✅ Security pass: parameterized SQL only, URL input validated, bounded cache, rate limit per
  visitor, read-only and unprivileged container, least-privilege CI, demo database checked for
  leftovers. README lists the external services the defaults use.
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

### Possible plugin-side changes

Not a roadmap: just things that would make the site simpler or cheaper if the plugin ever stored
them. The site has to keep working with what the plugin stores today.

- Indexes that older MySQL installs may lack (`fight_players(fight)`, `fights(kit)`,
  `stats(username)`), added by a migration.
- `old_elo`/`new_elo`/`hits` as columns on `fight_players` (today they're only in the JSON), so
  elo history and stat boards wouldn't need JSON parsing.
- `last_seen` / `first_joined` in `stats`.
- Party and bot fights saved too (today only duels are).
- A `kits` table with display names and icons, instead of reading them from fight JSON.
