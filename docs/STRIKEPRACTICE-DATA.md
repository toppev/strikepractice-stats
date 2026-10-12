# How StrikePractice stores its data

Everything this site shows comes from the database that the
[StrikePractice](https://www.spigotmc.org/resources/46906/) plugin writes. The site **only reads**;
the plugin owns the schema. This page is the reference for that schema and its quirks. Read it
before writing a new query.

## Where the data lives

The plugin's `config.yml` → `database.type`:

| type | Where | This site |
|---|---|---|
| `mysql` | MySQL or MariaDB server (`database.host`, `port`, `name`, `user`, `password`) | ✅ `DATABASE_URL=mysql://…` |
| `sqlite` | `plugins/StrikePractice/sqlite/database.db` (`database.sqlite-file`) | ✅ `DATABASE_URL=sqlite:///…` |
| `yaml` | Flat files per player | ❌ no fights, no SQL. Migrate with `/strikepractice migratetosqlite` |
| `auto` | Whichever of the above the server already used | |

**Fights are only saved when the plugin is told to:** `save-all-fights: true` (every duel) or
`save-elo-fights: true` (ranked only). Without them, `fights` and `fight_players` stay empty, so there's no
match history, no wins/losses, no fight pages. The `stats` table (elo, kills, deaths, event wins) is
always written.

Only **duels** (1v1, from queues or `/duel`) are saved as fights. Party fights, bot fights and
events are not, though event *wins* are counted in `stats`. The site still handles fights with more
than two players, in case that changes.

## Tables

### `stats`: one row per player

| column | meaning |
|---|---|
| `uuid` | Player UUID with dashes (lowercase). The identity. |
| `username` | Last known name, updated when the player joins |
| `kills`, `deaths` | All-time, every fight type |
| `global_elo` | Average of the player's kit elos (recomputed by the plugin) |
| `elo_<kit>` | One column **per ranked kit**, e.g. `elo_nodebuffelo`. Added by the plugin when a kit becomes ranked (`ALTER TABLE`); never removed. Default = starting elo (1000). |
| `lms`, `brackets`, `sumo_wins`, `juggernaut`, `party_vs_party_wins` | Event wins |
| `ID` | Auto-increment on older MySQL installs and on SQLite. **Don't rely on it**; newer MySQL installs have `uuid` as the primary key. |

Notes:
- Elo columns are dynamic: read them from the table's column list (`Database.columns("stats")`),
  never hard-code them. Kit names are `[A-Za-z0-9_]` (validated by the plugin), so `elo_<kit>` is safe
  to splice into SQL once it has been checked against the real column list (see `COLUMN_RE`).
- A player still on the starting elo in a kit has (almost certainly) never played it ranked. The
  leaderboards leave those players out (`startingElo` in config.yml).
- There is no "last seen" or "first joined". The site uses the newest/oldest fight instead.
- Wins and losses are **not** columns. They are counted from `fight_players` (`is_winner`).
  `stats.kills` counts kills in every mode, so kills ≠ wins.

### `fights`: one row per saved fight

| column | meaning |
|---|---|
| `id` | Auto-increment. Used in this site's URLs (`/fight/<id>`) |
| `started`, `ended` | Unix time in **milliseconds** (BIGINT) |
| `kit` | Kit name (plugin name, e.g. `nodebuffelo`). Rarely an arena-ish legacy name like `§7River`. |
| `arena` | Arena name, often with color codes (`§7River`) |
| `mode` | `DUEL`, `DUEL_QUEUE`, `DUEL_QUEUE_RANKED`, `DUEL_QUEUE_PREMIUM`. Ranked = the last two. In practice unranked queue fights are usually stored as `DUEL` too. |
| `replay_id` | UUID of the replay, if recorded. `/replay <uuid>` plays it in game while the plugin still has it. |
| `fight_data` | JSON, see below |

### `fight_players`: one row per player per fight

| column | meaning |
|---|---|
| `uuid`, `username` | The player, and their name **at the time of the fight** (old names live on here) |
| `fight` | ⚠️ The fight's **`started` timestamp as a string**, *not* `fights.id`. Join with `ON f.started = fp.fight`. |
| `is_winner` | 1 / 0 (BOOLEAN / TINYINT) |
| `player_data` | JSON, see below |

The `fight` column is VARCHAR while `started` is BIGINT. The join works on both databases (implicit
conversion). When you filter by it, pass the value **as a string** (`String(started)`) so the index on
`fight` is used. Ordering by `fp.fight` works because every millisecond timestamp has 13 digits
until the year 2286. The site relies on that to sort a player's fights by index.

### `replays`

`replay_id`, `name`, `replay_data` (gzip+Base64 tick data with an `SPZ1:` prefix). Not used by this
site; only the plugin can play replays.

### Indexes

The plugin's current `CREATE TABLE` statements create these, but **databases created by older plugin
versions may lack some** (seen on a real server: `fight_players(fight)`, `fights(kit)`,
`stats(username)`). Everything still works without them, just slower on large databases.
`npm run doctor` lists what's missing and prints the `CREATE INDEX` statements.

| index | used for |
|---|---|
| `fight_players (uuid, fight)` unique | everything per player |
| `fight_players (fight)` | players of a fight / a page of fights |
| `fights (started)` | the join |
| `fights (kit)` | kit filters, kit catalog |
| `stats (username)` | search, name lookup |

## The JSON columns

Written with Gson from the plugin's `SavedFight` / `SavedPlayer` classes. Parsed here by
[`src/lib/sp/fight-data.ts`](../src/lib/sp/fight-data.ts).

### `fights.fight_data`

```jsonc
{
  "replayUUID": "7781d0c8-…",          // same as fights.replay_id
  "kit": {                              // the BattleKit, serialized
    "name": "builduhcelo",
    "icon": { /* an item, see Items */ },// its custom name is the kit's display name ("§a§lBuild UHC")
    "elo": true,                        // ranked kit
    "best-of": 1,
    "build": true,
    "merged-editable-kit": "builduhc",  // the unranked kit this ranked one is based on
    "inventory": [ /* items */ ], "helmet": {…}, "potions": [ /* effects */ ], "types": "ANY", …
  },
  "started": 1791613091357, "ended": 1791613121381,
  "jsonVersion": 1, "pluginVersion": "4.0.0-SNAPSHOT", "serverVersion": "… (MC: 26.1.2)"
}
```

Older rows (≈2019–2021) have `arena` instead of the version fields; same idea. The **oldest rows
use obfuscated keys** (`{"hh": …, "aI": …}`) from a past build bug. They are skipped: those fights
still list, without kit icon or inventories.

### `fight_players.player_data`

```jsonc
{
  "name": "SwiftFox", "uuid": "0d4be7a2-…",
  "oldElo": 1000, "newElo": 1008,       // both 0 for unranked fights
  "fightStatistics": {
    "kits": 32,                         // ⚠️ this is HITS (a typo in the plugin's @SerializedName, kept for compatibility)
    "currentCombo": 1, "longestCombo": 10,
    "potionsThrown": 0, "potionsMissed": 0,
    "potionIntensities": 0.0            // sum of how much of each potion hit the thrower (0..1 each); accuracy = intensities / thrown
  },
  "fightInventory": {                   // the player's inventory when the fight ended
    "mainInv": [ /* 36 items (1.8) or 41 (1.9+: 36 + 4 armor + offhand); null = empty slot */ ],
    "helmet": {…}, "chestplate": {…}, "leggings": {…}, "boots": {…},
    "health": 13.0, "food": 20, "dead": false,
    "effects": [ { "effect": "minecraft:speed" /* or 1 on 1.8 */, "duration": 841 /* ticks */, "amplifier": 1 } ],
    "left": 7, "leftPotions": true,     // healing potions (leftPotions) or soups left
    "owner": "SwiftFox", "ownerUUID": "…", "inventoryUUID": "…", "playbackUUID": "…", "created": 1791613121382
  }
}
```

Hotbar = `mainInv[0..8]`, main inventory = `mainInv[9..35]`.

## Items: four formats

Items are Bukkit's own `ItemStack.serialize()` output, which changed over Minecraft versions.
[`src/lib/sp/items.ts`](../src/lib/sp/items.ts) turns all of them into one `Item`
(`{ id: "diamond_sword", count, enchantments, potion?, wear?, name? }`).

| Saved on | Looks like |
|---|---|
| 1.20.5+ (e.g. 26.1) | `{"id":"minecraft:diamond_sword","count":1,"components":{"minecraft:enchantments":"{\"minecraft:sharpness\":5}","minecraft:damage":"12"}}`. Component values are JSON or SNBT **strings**: `"minecraft:potion_contents":"{potion:\"minecraft:strong_healing\"}"`, `"minecraft:custom_name":"\"§a§lSumo\""` |
| 1.8–1.12 | `{"type":"DIAMOND_SWORD","damage":6,"amount":1,"meta":{"meta-type":"UNSPECIFIC","enchants":{"DAMAGE_ALL":2},"display-name":"§b…"}}`. `damage` is durability used for tools, but the **data value** otherwise: wool color, `GOLDEN_APPLE` 1 = enchanted, and for `POTION` the whole potion (16421 = Splash Potion of Healing II). Missing `amount` = 1. |
| ≈2019 rows | `{"type":276,"amount":1,"durability":9,"meta":{"enchantments":{"Enchantment[16, DAMAGE_ALL]":5}}}`: numeric 1.8 item ids, `durability` = data value |
| XSeries config format | `{"material":"DIAMOND_SWORD","enchants":{"SHARPNESS":5}}`. The format XSeries uses in YAML configs. Fights don't store it today; accepted here in case they ever do |

The legacy name/id/enchantment/potion tables are in [`src/lib/sp/legacy.ts`](../src/lib/sp/legacy.ts)
and [`src/lib/sp/potions.ts`](../src/lib/sp/potions.ts); unit tests in `src/lib/sp/sp.test.ts`
cover each format with real samples. **If you meet an item that renders as "?", add a sample to the
tests and extend the tables.**

1.8 potion data value bits: `& 0xF` effect (5 = healing, 2 = speed, 3 = fire resistance, 9 =
strength…), `0x20` level II, `0x40` extended, `0x4000` splash.

## Text formatting

Kit, arena and item names carry Minecraft's legacy codes: `§a` green, `§l` bold, `§x§r§r§g§g§b§b`
hex colors. [`src/lib/sp/colors.ts`](../src/lib/sp/colors.ts) strips or parses them; `<McText>` draws
them in game colors (used in item tooltips).

## Things that are easy to get wrong

- `fight_players.fight` = `fights.started`, not `fights.id` (see above).
- Hits are stored under the key `kits`.
- Names change; UUIDs don't. Link by name for readability, but resolve names through
  `findPlayer()`, which also accepts UUIDs and old names (from `fight_players.username`).
- `is_winner` is 0/1 in both databases; compare with `= 1`, don't rely on truthiness of strings.
- MySQL `SUM()` returns DECIMAL (the MySQL adapter sets `decimalNumbers: true`), `COUNT()` BIGINT.
  Wrap results with `toNumber()`.
- SQLite `=` is case-sensitive, MySQL's default collation is not. Use `dialect.equalsIgnoreCase()`.
- Integer division differs (`DIV` vs `/`): `dialect.intDiv()`.
- Offline-mode servers have UUIDs that skin services don't know; config `images.head` can use `{name}`.
- MySQL tables are often `latin1`. `§` exists in latin1 and the driver converts, so it's fine.
