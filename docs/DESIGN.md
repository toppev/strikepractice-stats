# Design

The look is meant to be good out of the box and easy to rebrand. These are the rules the default
design follows. Keep them when extending it, or replace them all at once when re-theming. Don't drift
halfway.

## The idea: a fight card for a block game

Every saved fight is a 1v1, so the site presents duels the way combat sports present bouts: two
names facing each other, the numbers between them (a "tale of the tape"), the result stamped in
color. Minecraft itself shows up **only where it is literally from the game**: the inventory GUI,
item tooltips, hearts and hunger, item icons, `§` colors in item names. Those are drawn faithfully
(the same greys, bevels, pixel font and tooltip border as in game). Everywhere else the site is its
own quiet, modern UI. No dirt-block backgrounds, no pixel fonts in headings, no blocky borders on
everything.

**One loud thing per page.** Home: the number one player standing in a pool of accent light. Fight:
the two fighters and the in-game inventories. Profile: the name. Everything around those stays calm.

## Tokens (`src/app/globals.css`)

| Token | Default | Use |
|---|---|---|
| `--bg` | `#141a24` night | page |
| `--surface` / `--surface-2` | `#1b2230` / `#232b3b` | panels, hover, inputs |
| `--line` | `#2b3445` | hairlines; structure is mostly lines and space, not boxes |
| `--text` / `--muted` / `--faint` | `#eef0f4` / `#8e97a9` / `#5f687b` | three text levels |
| `--accent` | `#ffb21e` gold | brand: links, the #1 spot, selected filters, focus ring. From `config.yml` |
| `--win` / `--loss` | `#5fe06b` / `#ff6464` | Minecraft's §a/§c, toned down. Only for results |
| `--silver` / `--bronze` | | ranks 2 and 3 |
| `--mc-*` | game GUI colors | only inside `.mc-panel`, `.mc-slot`, `.mc-tooltip` |

Win/loss colors always come with a word ("Win", "Loss", "Winner", "Defeated") or a position, never
color alone.

## Type

- **Sofia Sans Extra Condensed** (black/extrabold): player names, page and section titles. Big and tight.
- **Sofia Sans**: everything else, including numbers (semibold for values). Tabular figures (`.num`)
  only where numbers sit in columns.
- **Pixelify Sans**: only inside the Minecraft pieces (stack counts, tooltips).
- Sentence case everywhere. No all-caps labels, no labels above headings.

## Layout

- Max width 1180 px, left-aligned, 16 px side padding on phones.
- Sections are separated by space and a hairline, not by cards. Rows are lists with dividers.
- Lists of fights carry a colored edge (win/loss/neutral) so they scan by outcome.
- Everything works at 390 px wide: grids are `grid-cols-1` until `lg`, inventory slots shrink to 34 px.

## Motion

Almost none. The enchantment glint on enchanted items (it means something in game, and it is
disabled under `prefers-reduced-motion`). Hover states only change color. Tooltips appear instantly.

## Charts

Follow the usual data-viz rules: one series per chart (the title names it, no legend), 2 px lines,
an end dot with a surface-colored ring, hairline gridlines, a hover crosshair/tooltip, and a hidden
table for screen readers. The elo chart spaces fights evenly instead of by date, so a break doesn't
flatten the line. Bars are ≤ 24 px wide with rounded tops and a 2 px gap.

## Writing

Plain, from the player's side: "Most fought", "Inventories at the end", "Not ranked yet in …".
Empty states say what's missing and what fills it ("Nobody has played this ladder yet.").
Errors say what went wrong and where to look, without apologizing.
