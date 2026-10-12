# Making it yours

Three levels, from no code to any change you want.

## 1. config.yml and branding/ (no code)

Everything in [`config.yml`](../config.yml) is commented. The usual first edits:

```yaml
site:
  name: Blocky PvP
  tagline: The best NoDebuff in the west.
  serverIp: play.blockypvp.net
  logo: logo.png                # branding/logo.png
  links:
    - { label: Discord, url: https://discord.gg/xyz }
theme:
  accent: "#4fc3f7"             # your brand color
kits:
  nodebuffelo: { name: NoDebuff }
  buhc:        { name: Build UHC, icon: lava_bucket }
  testkit:     { hidden: true }
```

- **Logo:** put `logo.png` (or `.svg`) in `branding/` and set `site.logo: logo.png`. About 30 px
  tall is shown; give it at least 60 px of height for sharp screens.
- **Arena banners:** an image per arena in `branding/arenas/`, named like the arena without color
  codes, lowercased: `§7River` → `branding/arenas/river.webp` (`.jpg` and `.png` work too). A wide
  in-game screenshot, around 1600 px wide, works well.
- **Colors:** `theme.accent` covers most of it. Any other token from `src/app/globals.css` can be
  overridden under `theme.colors` (e.g. `--bg`, `--surface`, `--win`, `--loss`).
- **Skins on offline-mode servers:** set `images.head` and `images.body` to use `{name}` instead of `{uuid}`.

## 2. Small code changes

The code is small and commented; the map is in [ARCHITECTURE.md](ARCHITECTURE.md). Common ones:

| Want | Where |
|---|---|
| Different fonts | `src/app/layout.tsx` (next/font imports) and the `--font-*` lines in `globals.css` |
| Change the home page layout | `src/app/page.tsx` |
| Add a link to the header | `src/components/nav-links.tsx` |
| Add a stat to profiles | query in `src/lib/queries/players.ts`, render in `src/app/player/[name]/page.tsx` |
| Change how fights are listed | `src/components/fight-row.tsx` |
| Texts / wording | in the page files themselves (no translation layer yet) |

Run `npm run dev` and edit; pages reload as you save.

## 3. Ask an AI agent

This project is written to be changed by coding agents (Claude Code, Codex, Cursor, …). They read
[`AGENTS.md`](../AGENTS.md) first, which points them to the architecture, the plugin's data model and
the design rules. Prompts that work well:

- "Change the theme to a light, clean look in our brand colors #1e88e5 and #ffca28. Keep the
  Minecraft inventory and tooltips as they are."
- "Add our server's logo from branding/logo.png to the header and make the home page hero show our
  three most popular kits instead of the number one player."
- "Add a page /kit/[name] with the kit's top players, recent fights and win rates."
- "Add a JSON API at /api/v1/players/[name] with the profile stats, for our Discord bot."
- "Translate the site to German."
- "Our server runs in offline mode; make skins work by name."

Tell the agent to check its work with `npm run typecheck`, `npm test`, `npm run doctor`, and by
opening the pages it changed (`npm run dev`, the demo database works without any setup).

## Keeping up with this repository

This is a starting point, not a maintained product. Once you've changed things, pulling updates
may conflict; that's expected. Cherry-pick what you want, or ask your agent to "merge the upstream
changes to X into our version".
