import { normalizeItem, type Item } from "./items";
import { effectKey } from "./potions";

/**
 * Readers for the JSON columns `fights.fight_data` and `fight_players.player_data`.
 * Everything is optional: the JSON has changed over plugin versions, and a field we can't
 * read should cost one stat on the page, never the page. Rows written by the very old
 * obfuscated format (keys like "hh", "aI") simply come back mostly empty.
 */

type Json = Record<string, unknown>;

export type SavedKit = {
  name: string;
  /** From the kit icon's custom name, may contain § codes */
  displayName?: string;
  icon?: Item | null;
  ranked: boolean;
  bestOf: number;
  build: boolean;
  /** The unranked kit this ranked kit copies its layout from */
  baseKit?: string;
};

export type FightData = {
  kit?: SavedKit;
  replayId?: string;
  pluginVersion?: string;
  serverVersion?: string;
};

export type InventorySnapshot = {
  /** 36 slots: 0-8 hotbar, 9-35 the rest, like the game numbers them */
  slots: (Item | null)[];
  armor: { helmet: Item | null; chestplate: Item | null; leggings: Item | null; boots: Item | null };
  offhand: Item | null;
  /** False for fights saved on 1.8, which had no offhand */
  hasOffhand: boolean;
  health: number;
  food: number;
  dead: boolean;
  effects: { id: string; amplifier: number; seconds: number }[];
  /** Healing potions or soups left when the fight ended */
  remaining: { kind: "potions" | "soups" | null; count: number };
};

export type FightStats = {
  hits: number;
  longestCombo: number;
  potionsThrown: number;
  potionsMissed: number;
  /** 0-100, how much of the thrown potions' healing landed on the thrower */
  potionAccuracy: number | null;
};

export type PlayerData = {
  inventory: InventorySnapshot | null;
  stats: FightStats | null;
  oldElo: number;
  newElo: number;
};

function parse(json: string | null | undefined): Json | undefined {
  if (!json) return undefined;
  try {
    const value = JSON.parse(json);
    return value && typeof value === "object" ? (value as Json) : undefined;
  } catch {
    return undefined;
  }
}

const num = (v: unknown, fallback = 0) => (typeof v === "number" && Number.isFinite(v) ? v : fallback);
const obj = (v: unknown) => (v && typeof v === "object" && !Array.isArray(v) ? (v as Json) : undefined);

export function parseFightData(json: string | null | undefined): FightData {
  const data = parse(json);
  if (!data) return {};
  const kit = obj(data.kit);
  return {
    kit: kit && typeof kit.name === "string" ? parseKit(kit) : undefined,
    replayId: typeof data.replayUUID === "string" ? data.replayUUID : undefined,
    pluginVersion: typeof data.pluginVersion === "string" ? data.pluginVersion : undefined,
    serverVersion: typeof data.serverVersion === "string" ? data.serverVersion : undefined,
  };
}

function parseKit(kit: Json): SavedKit {
  const icon = normalizeItem(kit.icon);
  return {
    name: String(kit.name),
    displayName: icon?.name,
    icon,
    ranked: kit.elo === true,
    bestOf: num(kit["best-of"], 1),
    build: kit.build === true,
    baseKit: typeof kit["merged-editable-kit"] === "string" ? kit["merged-editable-kit"] : undefined,
  };
}

export function parsePlayerData(json: string | null | undefined): PlayerData {
  const data = parse(json);
  if (!data) return { inventory: null, stats: null, oldElo: 0, newElo: 0 };
  return {
    inventory: parseInventory(obj(data.fightInventory)),
    stats: parseStats(obj(data.fightStatistics)),
    oldElo: num(data.oldElo),
    newElo: num(data.newElo),
  };
}

function parseInventory(inv: Json | undefined): InventorySnapshot | null {
  if (!inv) return null;
  const contents = Array.isArray(inv.mainInv) ? inv.mainInv : [];
  const slots = Array.from({ length: 36 }, (_, i) => normalizeItem(contents[i]));
  const left = num(inv.left);
  return {
    slots,
    armor: {
      helmet: normalizeItem(inv.helmet),
      chestplate: normalizeItem(inv.chestplate),
      leggings: normalizeItem(inv.leggings),
      boots: normalizeItem(inv.boots),
    },
    // 1.9+ getContents() is 36 slots + 4 armor + offhand
    offhand: contents.length >= 41 ? normalizeItem(contents[40]) : null,
    hasOffhand: contents.length >= 41,
    health: num(inv.health),
    food: num(inv.food, 20),
    dead: inv.dead === true,
    effects: (Array.isArray(inv.effects) ? inv.effects : [])
      .map((e) => obj(e))
      .flatMap((e) => {
        const id = e ? effectKey(e.effect ?? e.type) : undefined;
        return e && id ? [{ id, amplifier: num(e.amplifier), seconds: Math.round(num(e.duration) / 20) }] : [];
      }),
    remaining: { kind: left > 0 ? (inv.leftPotions === true ? "potions" : "soups") : null, count: left },
  };
}

function parseStats(stats: Json | undefined): FightStats | null {
  if (!stats) return null;
  const thrown = num(stats.potionsThrown);
  const intensities = num(stats.potionIntensities);
  return {
    // Serialized as "kits" because of an old typo in the plugin's @SerializedName; "hits" just in case
    hits: num(stats.kits ?? stats.hits),
    longestCombo: num(stats.longestCombo),
    potionsThrown: thrown,
    potionsMissed: num(stats.potionsMissed),
    potionAccuracy: thrown > 0 ? Math.min(100, Math.round((intensities / thrown) * 100)) : null,
  };
}
