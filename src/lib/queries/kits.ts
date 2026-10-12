import { db } from "../db";
import { cached } from "../cache";
import { getConfig } from "../config";
import { stripFormatting } from "../sp/colors";
import { parseFightData } from "../sp/fight-data";
import { titleCase, type Item } from "../sp/items";
import { potionFromType } from "../sp/potions";

export type KitInfo = {
  /** The plugin's kit name, as stored in fights.kit */
  name: string;
  /** What the site shows: config name > kit icon's custom name > the kit name */
  label: string;
  icon: Item | null;
  ranked: boolean;
  hidden: boolean;
  /** The stats column holding this kit's elo, when it has one */
  eloColumn?: string;
  fights: number;
};

/**
 * Every kit the site knows about: the ones with saved fights plus the ones with an elo column.
 * Names and icons come from the newest saved fight of each kit (fight_data has the kit's icon
 * item), overridden by config.yml.
 */
export function getKits(): Promise<Map<string, KitInfo>> {
  return cached(
    "kits",
    async () => {
      const database = await db();
      const [counts, statsColumns] = await Promise.all([
        database.all<{ kit: string; fights: number; last_id: number }>(
          "SELECT kit, COUNT(*) AS fights, MAX(id) AS last_id FROM fights WHERE kit IS NOT NULL GROUP BY kit",
        ),
        database.columns("stats"),
      ]);
      const latest = counts.length
        ? await database.all<{ kit: string; fight_data: string | null }>(
            `SELECT kit, fight_data FROM fights WHERE id IN (${counts.map(() => "?").join(",")})`,
            counts.map((c) => c.last_id),
          )
        : [];
      const saved = new Map(latest.map((row) => [row.kit, parseFightData(row.fight_data).kit]));

      const kits = new Map<string, KitInfo>();
      const add = (name: string, fights: number) => {
        const kit = saved.get(name);
        kits.set(name, {
          name,
          label: stripFormatting(kit?.displayName) || titleCase(stripFormatting(name)),
          icon: kit?.icon ?? null,
          ranked: kit?.ranked ?? false,
          hidden: false,
          fights,
        });
      };
      for (const row of counts) add(row.kit, Number(row.fights));
      for (const column of statsColumns) {
        if (!column.startsWith("elo_")) continue;
        const name = column.slice(4);
        if (!kits.has(name)) add(name, 0);
        const kit = kits.get(name)!;
        kit.eloColumn = column;
        kit.ranked = true;
        // No saved fight to read the name and icon from (e.g. save-elo-fights is off): borrow
        // them from the unranked kit it is usually a copy of, "nodebuffelo" -> "nodebuff"
        if (kit.fights === 0 && !saved.get(name)) {
          const baseName = name.replace(/[_-]?(elo|ranked)$/i, "");
          const base = kits.get(baseName);
          if (base && base !== kit) {
            kit.label = base.label;
            kit.icon = base.icon;
          } else if (baseName) {
            kit.label = titleCase(baseName);
          }
        }
      }
      return kits;
    },
    10,
  ).then(applyConfig);
}

/** Applied on every call (not cached) so config.yml edits show up right away */
function applyConfig(kits: Map<string, KitInfo>): Map<string, KitInfo> {
  const overrides = getConfig().kits;
  const out = new Map<string, KitInfo>();
  for (const [name, kit] of kits) {
    const o = overrides[name] ?? overrides[name.toLowerCase()];
    out.set(name, o ? { ...kit, label: o.name ?? kit.label, icon: o.icon ? iconFromConfig(o.icon) : kit.icon, hidden: o.hidden ?? false } : kit);
  }
  return out;
}

/** "diamond_sword", or "splash_potion:strong_healing" for a potion */
function iconFromConfig(value: string): Item {
  const [id, potion] = value.replace(/^minecraft:/, "").split(":");
  const item: Item = { id, count: 1, enchantments: [] };
  if (potion) {
    item.potion = { ...potionFromType(potion), form: id === "splash_potion" ? "splash" : id === "lingering_potion" ? "lingering" : "potion" };
  }
  return item;
}

export async function kitLabel(name: string | null | undefined): Promise<string> {
  if (!name) return "Unknown kit";
  return (await getKits()).get(name)?.label ?? titleCase(stripFormatting(name));
}

/** Ranked kits with an elo column, most played first: the ladders */
export async function getLadders(): Promise<KitInfo[]> {
  const kits = await getKits();
  return [...kits.values()]
    .filter((k) => k.eloColumn && !k.hidden)
    .sort((a, b) => b.fights - a.fights || a.label.localeCompare(b.label));
}
