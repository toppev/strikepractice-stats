import { enchantmentKey, legacyNameFromNumber, modernIdFromLegacy } from "./legacy";
import { effectColor, potionFromLegacyData, potionFromType, type PotionInfo } from "./potions";
import { MC_COLORS } from "./colors";

/**
 * One item, the same shape no matter which server version saved it. StrikePractice stores items
 * with Bukkit's own ItemStack serialization, which looks different on every era of Minecraft:
 *
 *   1.20.5+  {"id": "minecraft:diamond_sword", "count": 1, "components": {"minecraft:enchantments": "..."}}
 *   1.8-1.12 {"type": "DIAMOND_SWORD", "damage": 6, "amount": 1, "meta": {"enchants": {"DAMAGE_ALL": 2}}}
 *   ~2019    {"type": 276, "amount": 1, "durability": 9, "meta": {"enchantments": {"Enchantment[16, DAMAGE_ALL]": 5}}}
 *   XSeries  {"material": "DIAMOND_SWORD", "enchants": {"SHARPNESS": 5}}   (config format, accepted just in case)
 *
 * See docs/STRIKEPRACTICE-DATA.md for the full story.
 */
export type Item = {
  /** Modern item id without the namespace, e.g. "diamond_sword" */
  id: string;
  count: number;
  /** Custom name, may contain § color codes */
  name?: string;
  enchantments: { id: string; level: number }[];
  potion?: PotionInfo & { form: "potion" | "splash" | "lingering" };
  /** Durability used, 0..1, only for items that wear out */
  wear?: number;
  unbreakable?: boolean;
  /** Dyed leather armor */
  dye?: string;
};

type Json = Record<string, unknown>;

const asNumber = (v: unknown): number | undefined => {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() !== "" && Number.isFinite(Number(v))) return Number(v);
  return undefined;
};
const asObject = (v: unknown): Json | undefined => (v && typeof v === "object" && !Array.isArray(v) ? (v as Json) : undefined);

export function normalizeItem(raw: unknown): Item | null {
  const item = asObject(raw);
  if (!item) return null;
  let result: Item | null;
  if (typeof item.id === "string") result = fromModern(item);
  else if (typeof item.material === "string") result = fromLegacy(item.material, item, item.damage);
  else if (typeof item.type === "number") result = fromLegacy(legacyNameFromNumber(item.type) ?? "AIR", item, item.durability);
  else if (typeof item.type === "string") result = fromLegacy(item.type, item, item.damage ?? item.durability);
  else return null;
  if (!result || result.id === "air" || result.count <= 0) return null;
  return result;
}

function fromModern(item: Json): Item {
  const id = String(item.id).replace(/^minecraft:/, "");
  const components = asObject(item.components) ?? {};
  const get = (key: string) => components[`minecraft:${key}`];
  const out: Item = { id, count: asNumber(item.count) ?? 1, enchantments: [] };

  const enchants = parseLoose(get("enchantments"));
  const levels = asObject(enchants?.levels) ?? enchants; // 1.20.5 wrapped them in {levels: {...}}
  for (const [key, level] of Object.entries(levels ?? {})) {
    const n = asNumber(level);
    if (n !== undefined && key !== "show_in_tooltip") out.enchantments.push({ id: enchantmentKey(key), level: n });
  }
  const stored = parseLoose(get("stored_enchantments"));
  for (const [key, level] of Object.entries(asObject(stored?.levels) ?? stored ?? {})) {
    const n = asNumber(level);
    if (n !== undefined) out.enchantments.push({ id: enchantmentKey(key), level: n });
  }

  const name = get("custom_name") ?? get("item_name");
  if (name !== undefined) out.name = textComponentToLegacy(name);

  const potion = get("potion_contents");
  if (id === "potion" || id === "splash_potion" || id === "lingering_potion" || id === "tipped_arrow") {
    const contents = typeof potion === "string" ? parseLoose(potion) : asObject(potion);
    const type = typeof contents?.potion === "string" ? contents.potion : typeof potion === "string" && !potion.startsWith("{") ? potion.replace(/"/g, "") : undefined;
    const info = type ? potionFromType(type) : { level: 1, extended: false, color: effectColor(undefined) };
    const custom = asNumber(contents?.custom_color);
    if (custom !== undefined) info.color = rgbToHex(custom);
    out.potion = { ...info, form: id === "splash_potion" ? "splash" : id === "lingering_potion" ? "lingering" : "potion" };
  }

  const damage = asNumber(get("damage"));
  const max = asNumber(get("max_damage")) ?? MAX_DURABILITY[id];
  if (damage && max) out.wear = Math.min(1, damage / max);
  if (get("unbreakable") !== undefined) out.unbreakable = true;
  const dyed = get("dyed_color");
  const dyeRgb = asNumber(dyed) ?? asNumber(parseLoose(dyed)?.rgb);
  if (dyeRgb !== undefined) out.dye = rgbToHex(dyeRgb);
  return out;
}

function fromLegacy(type: string, item: Json, dataRaw: unknown): Item {
  const data = asNumber(dataRaw) ?? 0;
  const upper = type.toUpperCase();
  const meta = asObject(item.meta) ?? {};
  const out: Item = {
    id: modernIdFromLegacy(upper, data),
    count: asNumber(item.amount) ?? 1,
    enchantments: [],
  };

  for (const source of [meta.enchants, meta.enchantments, meta["stored-enchants"], item.enchants]) {
    for (const [key, level] of Object.entries(asObject(source) ?? {})) {
      const n = asNumber(level);
      if (n !== undefined) out.enchantments.push({ id: enchantmentKey(key), level: n });
    }
  }

  const name = meta["display-name"] ?? meta.displayName ?? item.name;
  if (typeof name === "string") out.name = name;

  if (upper === "POTION" || upper === "SPLASH_POTION" || upper === "LINGERING_POTION") {
    const potionType = meta["potion-type"] ?? asObject(meta["potion-data"])?.type ?? baseEffect(item["base-effect"]);
    if (typeof potionType === "string") {
      const info = potionFromType(potionType);
      out.id = upper.toLowerCase();
      out.potion = { ...info, form: upper === "SPLASH_POTION" ? "splash" : upper === "LINGERING_POTION" ? "lingering" : "potion" };
    } else {
      // 1.8: everything is in the data value
      const { splash, ...info } = potionFromLegacyData(data);
      out.id = splash ? "splash_potion" : "potion";
      out.potion = { ...info, form: splash ? "splash" : "potion" };
    }
  }

  const max = MAX_DURABILITY[out.id];
  if (max && data > 0) out.wear = Math.min(1, data / max);
  if (meta.Unbreakable === true || meta.Unbreakable === "True" || meta.unbreakable === true || item.unbreakable === true) {
    out.unbreakable = true;
  }
  const color = asObject(meta.color);
  if (color && asNumber(color.RED) !== undefined) {
    out.dye = rgbToHex(((asNumber(color.RED) ?? 0) << 16) | ((asNumber(color.GREEN) ?? 0) << 8) | (asNumber(color.BLUE) ?? 0));
  }
  return out;
}

/** XSeries writes potions as "INSTANT_HEAL, false, true" (type, extended, upgraded) */
function baseEffect(raw: unknown): string | undefined {
  if (typeof raw !== "string") return undefined;
  const [type, , upgraded] = raw.split(",").map((s) => s.trim());
  return upgraded === "true" ? `strong_${type}` : type;
}

/**
 * Component values are stored as strings of JSON or SNBT ({potion:"minecraft:strong_healing"}).
 * Good enough to read the flat objects we need; not a full SNBT parser.
 */
export function parseLoose(value: unknown): Json | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value === "object") return asObject(value);
  if (typeof value !== "string") return undefined;
  try {
    return asObject(JSON.parse(value));
  } catch {
    // SNBT: quote the bare keys, drop number suffixes (1b, 5s, 2.0f)
    const json = value
      .replace(/([{,]\s*)([A-Za-z0-9_.:+-]+)\s*:/g, '$1"$2":')
      .replace(/:\s*(-?\d+(?:\.\d+)?)[bBsSlLfFdD]\b/g, ":$1")
      .replace(/'/g, '"');
    try {
      return asObject(JSON.parse(json));
    } catch {
      return undefined;
    }
  }
}

const NAMED_COLORS: Record<string, string> = {
  black: "0",
  dark_blue: "1",
  dark_green: "2",
  dark_aqua: "3",
  dark_red: "4",
  dark_purple: "5",
  gold: "6",
  gray: "7",
  dark_gray: "8",
  blue: "9",
  green: "a",
  aqua: "b",
  red: "c",
  light_purple: "d",
  yellow: "e",
  white: "f",
};

/** A JSON text component ("\"§aName\"", {"text": "Name", "color": "green"}, [...]) -> legacy § string */
export function textComponentToLegacy(raw: unknown): string {
  let value: unknown = raw;
  if (typeof raw === "string") {
    try {
      value = JSON.parse(raw);
    } catch {
      value = raw;
    }
  }
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return value.map(textComponentToLegacy).join("");
  const obj = asObject(value);
  if (!obj) return "";
  let prefix = "";
  if (typeof obj.color === "string") {
    if (NAMED_COLORS[obj.color]) prefix += `§${NAMED_COLORS[obj.color]}`;
    else if (/^#[0-9a-f]{6}$/i.test(obj.color)) prefix += "§x" + [...obj.color.slice(1)].map((c) => `§${c}`).join("");
  }
  if (obj.bold) prefix += "§l";
  if (obj.italic) prefix += "§o";
  const extra = Array.isArray(obj.extra) ? obj.extra.map(textComponentToLegacy).join("") : "";
  return prefix + (typeof obj.text === "string" ? obj.text : "") + extra;
}

function rgbToHex(rgb: number): string {
  return `#${(rgb & 0xffffff).toString(16).padStart(6, "0")}`;
}

/** Max durability of items that wear out (for the durability bar) */
const MAX_DURABILITY: Record<string, number> = (() => {
  const out: Record<string, number> = {
    bow: 384,
    crossbow: 465,
    fishing_rod: 64,
    flint_and_steel: 64,
    shears: 238,
    shield: 336,
    trident: 250,
    elytra: 432,
    mace: 500,
    carrot_on_a_stick: 25,
    turtle_helmet: 275,
  };
  const tools: Record<string, number> = { wooden: 59, stone: 131, iron: 250, golden: 32, diamond: 1561, netherite: 2031 };
  for (const [material, max] of Object.entries(tools)) {
    for (const tool of ["sword", "shovel", "pickaxe", "axe", "hoe"]) out[`${material}_${tool}`] = max;
  }
  const armor: Record<string, number> = { leather: 5, chainmail: 15, iron: 15, golden: 7, diamond: 33, netherite: 37 };
  const base: Record<string, number> = { helmet: 11, chestplate: 16, leggings: 15, boots: 13 };
  for (const [material, mult] of Object.entries(armor)) {
    for (const [piece, b] of Object.entries(base)) out[`${material}_${piece}`] = mult * b;
  }
  return out;
})();

export function itemDisplayName(item: Item): string {
  if (item.potion) {
    const form = item.potion.form === "splash" ? "Splash Potion" : item.potion.form === "lingering" ? "Lingering Potion" : "Potion";
    if (!item.potion.effect) return item.id === "potion" ? "Water Bottle" : form;
    const effect = POTION_NAMES[item.potion.effect] ?? titleCase(item.potion.effect);
    return `${form} of ${effect}`;
  }
  return SPECIAL_NAMES[item.id] ?? titleCase(item.id);
}

const POTION_NAMES: Record<string, string> = {
  instant_health: "Healing",
  instant_damage: "Harming",
  speed: "Swiftness",
  jump_boost: "Leaping",
};

const SPECIAL_NAMES: Record<string, string> = {
  enchanted_golden_apple: "Enchanted Golden Apple",
  tnt: "TNT",
  mushroom_stew: "Mushroom Stew",
};

export function titleCase(id: string): string {
  return id.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Name color in the tooltip, like in game: aqua when enchanted, gold/light purple for rare items */
export function itemNameColor(item: Item): string {
  if (item.id === "enchanted_golden_apple") return MC_COLORS.d;
  if (item.enchantments.length > 0) return MC_COLORS.b;
  if (item.id === "golden_apple" || item.id === "experience_bottle" || item.id === "dragon_breath") return MC_COLORS.e;
  return MC_COLORS.f;
}

/** Whether to draw the enchantment glint */
export function hasGlint(item: Item): boolean {
  return item.enchantments.length > 0 || item.id === "enchanted_golden_apple" || item.id === "enchanted_book";
}
