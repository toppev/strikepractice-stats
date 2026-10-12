# StrikePractice Stats

A stats website for Minecraft servers running the
[StrikePractice](https://www.spigotmc.org/resources/46906/) practice-PvP plugin: leaderboards,
player profiles with elo history, and every saved fight with both players' inventories as they
ended it.

![Home page](docs/screenshots/home.webp)

> **A starting point, not a product.** This is meant to be forked and made your own: rebranded,
> extended, rewritten by you or your AI agent. It isn't kept in step with every plugin update,
> and there is no support. Issues may go unanswered. Pull requests with fixes and improvements are
> welcome.

## What it shows

- **Leaderboards:** global elo, every ranked kit (with won–lost and win rate), fight wins, kills,
  event wins (LMS, brackets, sumo, juggernaut, party vs party).
- **Player profiles:** elo and rank on every ladder, wins, losses, win rate, current and best win
  streak, K/D, elo over time per kit, wins and losses per kit, most fought opponents, earlier names,
  full match history with filters.
- **Fights:** a side-by-side comparison (hits, longest combo, potions thrown, missed and accuracy,
  potions or soups left, health and hunger), both final inventories drawn like the game's inventory
  screen with item tooltips, effects, elo change, and the in-game replay command.
- **Home:** the number one player, ladder top 10s, latest fights, server activity.
- Search with suggestions, works with current names, old names and UUIDs. Works on phones.

| | |
|---|---|
| ![A fight: tale of the tape and both inventories](docs/screenshots/fight.webp) | ![A player profile](docs/screenshots/player.webp) |
| ![A ranked ladder](docs/screenshots/leaderboard.webp) | ![All fights](docs/screenshots/fights.webp) |

![On a phone](docs/screenshots/phones.webp)

*Screenshots use the bundled demo data: real fights from a test server, with every player except
the plugin author anonymized (which is why most skins are the default one).*

## Quick start

You need Docker. The plugin must store its data in **MySQL/MariaDB or SQLite** (`database.type` in its
config.yml), with **`save-all-fights: true`** for fight history.

```sh
git clone https://github.com/toppev/strikepractice-stats.git && cd strikepractice-stats
docker compose up -d --build
```

Open http://localhost:3000. Without a database configured it shows demo data, so you can look
around first. Then connect your server:

```sh
cp .env.example .env
# edit .env:  DATABASE_URL=mysql://stats:password@host.docker.internal:3306/strikepractice
docker compose up -d
docker compose exec stats node scripts/doctor.cjs   # checks the connection, tables and indexes
```

Then make it yours in [`config.yml`](config.yml): server name, IP, accent color, logo, kit names.
Changes show up on the next page load.

**Guides:** [Deploying](docs/DEPLOYING.md) (MySQL, SQLite, domains and HTTPS, updating) ·
[Customizing](docs/CUSTOMIZING.md) (branding, code changes, prompts for AI agents)

## Changing it with an AI agent

The repository is set up for coding agents. [`AGENTS.md`](AGENTS.md) is their entry point and links
to [how the plugin stores its data](docs/STRIKEPRACTICE-DATA.md), the
[architecture](docs/ARCHITECTURE.md), the [design rules](docs/DESIGN.md) and the
[project notes](docs/NOTES.md). The demo database lets an agent run and check every page without
access to your server. Try asking for things like "make it match our brand colors and logo", "add a
JSON API for our Discord bot", or "add a page per kit".

## Development

Node.js 22.13+ (24 recommended).

```sh
npm install
npm run dev          # http://localhost:3000 with the demo data
npm run typecheck && npm test
npm run doctor       # with DATABASE_URL set, checks a real database
```

Stack: Next.js 16, React 19, Tailwind CSS 4, TypeScript, `mysql2` and Node's built-in SQLite.
No ORM: the queries are plain SQL in `src/lib/queries/`.

## Credits

- Data recorded by StrikePractice.
- Player skins from [mc-heads.net](https://mc-heads.net), item icons from
  [mc.nerothe.com](https://mc.nerothe.com), game textures from [mcasset.cloud](https://mcasset.cloud),
  all loaded at runtime and configurable. Minecraft assets belong to Mojang; none are included here.

Not an official Minecraft product. Not approved by or associated with Mojang or Microsoft.

## License

[MIT](LICENSE)
