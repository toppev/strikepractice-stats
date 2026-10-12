/**
 * Potions and potion effects in every shape StrikePractice has stored them:
 * - 1.8 item data values (16421 = Splash Potion of Healing II)
 * - 1.9+ potion types ("minecraft:strong_healing", "INSTANT_HEAL")
 * - effect ids (1 = speed on 1.8, "minecraft:speed" later)
 */

export type PotionInfo = {
  /** Modern effect key without namespace, e.g. "instant_health". Undefined for water/awkward/etc. */
  effect?: string;
  /** 1 or 2 (roman numeral shown in game) */
  level: number;
  extended: boolean;
  /** Bottle color as #rrggbb */
  color: string;
};

/** Modern effect key -> [display name, bottle/particle color] */
export const EFFECTS: Record<string, [string, string]> = {
  speed: ["Speed", "#33EBFF"],
  slowness: ["Slowness", "#8BAFE0"],
  haste: ["Haste", "#D9C043"],
  mining_fatigue: ["Mining Fatigue", "#4A4217"],
  strength: ["Strength", "#FFC700"],
  instant_health: ["Instant Health", "#F82423"],
  instant_damage: ["Instant Damage", "#A9656A"],
  jump_boost: ["Jump Boost", "#FDFF84"],
  nausea: ["Nausea", "#551D4A"],
  regeneration: ["Regeneration", "#CD5CAB"],
  resistance: ["Resistance", "#9146F0"],
  fire_resistance: ["Fire Resistance", "#FF9900"],
  water_breathing: ["Water Breathing", "#98DAC0"],
  invisibility: ["Invisibility", "#F6F6F6"],
  blindness: ["Blindness", "#1F1F23"],
  night_vision: ["Night Vision", "#C2FF66"],
  hunger: ["Hunger", "#587653"],
  weakness: ["Weakness", "#484D48"],
  poison: ["Poison", "#87A363"],
  wither: ["Wither", "#736156"],
  health_boost: ["Health Boost", "#F87D23"],
  absorption: ["Absorption", "#2552A5"],
  saturation: ["Saturation", "#F82423"],
  glowing: ["Glowing", "#94A061"],
  levitation: ["Levitation", "#CEFFFF"],
  luck: ["Luck", "#59C106"],
  unluck: ["Bad Luck", "#C0A44D"],
  slow_falling: ["Slow Falling", "#F3CFB9"],
  conduit_power: ["Conduit Power", "#1DC2D1"],
  dolphins_grace: ["Dolphin's Grace", "#88A3BE"],
  bad_omen: ["Bad Omen", "#0B6138"],
  hero_of_the_village: ["Hero of the Village", "#44FF44"],
  darkness: ["Darkness", "#292721"],
};

const WATER = "#385DC6";

/** 1.8 numeric effect ids (also the low bits of a 1.8 potion's data value) */
const LEGACY_EFFECT_IDS: Record<number, string> = {
  1: "speed",
  2: "slowness",
  3: "haste",
  4: "mining_fatigue",
  5: "strength",
  6: "instant_health",
  7: "instant_damage",
  8: "jump_boost",
  9: "nausea",
  10: "regeneration",
  11: "resistance",
  12: "fire_resistance",
  13: "water_breathing",
  14: "invisibility",
  15: "blindness",
  16: "night_vision",
  17: "hunger",
  18: "weakness",
  19: "poison",
  20: "wither",
  21: "health_boost",
  22: "absorption",
  23: "saturation",
};

/** Low 4 bits of a 1.8 potion data value -> effect. Not the same table as the effect ids. */
const LEGACY_POTION_BITS: Record<number, string> = {
  1: "regeneration",
  2: "speed",
  3: "fire_resistance",
  4: "poison",
  5: "instant_health",
  6: "night_vision",
  8: "weakness",
  9: "strength",
  10: "slowness",
  11: "jump_boost",
  12: "instant_damage",
  13: "water_breathing",
  14: "invisibility",
};

/** Bukkit's PotionEffectType / PotionType names that differ from the modern keys */
const BUKKIT_NAMES: Record<string, string> = {
  SLOW: "slowness",
  FAST_DIGGING: "haste",
  SLOW_DIGGING: "mining_fatigue",
  INCREASE_DAMAGE: "strength",
  HEAL: "instant_health",
  INSTANT_HEAL: "instant_health",
  HARM: "instant_damage",
  INSTANT_DAMAGE: "instant_damage",
  JUMP: "jump_boost",
  CONFUSION: "nausea",
  DAMAGE_RESISTANCE: "resistance",
  REGEN: "regeneration",
  SPEED: "speed",
  SWIFTNESS: "speed",
  STRENGTH: "strength",
  LEAPING: "jump_boost",
  HEALING: "instant_health",
  HARMING: "instant_damage",
  TURTLE_MASTER: "slowness",
};

/** "minecraft:strong_healing" / "STRONG_HEALING" / "healing" -> modern potion type pieces */
const POTION_TYPE_EFFECT: Record<string, string> = {
  healing: "instant_health",
  harming: "instant_damage",
  swiftness: "speed",
  leaping: "jump_boost",
  regeneration: "regeneration",
  strength: "strength",
  fire_resistance: "fire_resistance",
  water_breathing: "water_breathing",
  invisibility: "invisibility",
  night_vision: "night_vision",
  poison: "poison",
  weakness: "weakness",
  slowness: "slowness",
  slow_falling: "slow_falling",
  luck: "luck",
  turtle_master: "slowness",
  wind_charged: "speed",
  weaving: "slowness",
  oozing: "slowness",
  infested: "slowness",
};

export function effectKey(raw: unknown): string | undefined {
  if (typeof raw === "number") return LEGACY_EFFECT_IDS[raw];
  if (typeof raw !== "string") return undefined;
  const name = raw.replace(/^minecraft:/, "");
  if (/^\d+$/.test(name)) return LEGACY_EFFECT_IDS[Number(name)];
  return BUKKIT_NAMES[name.toUpperCase()] ?? name.toLowerCase();
}

export function effectName(key: string): string {
  return EFFECTS[key]?.[0] ?? key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export function effectColor(key: string | undefined): string {
  return (key && EFFECTS[key]?.[1]) || WATER;
}

/** A 1.8 potion item's data value (the "damage" of a POTION) */
export function potionFromLegacyData(data: number): PotionInfo & { splash: boolean } {
  const effect = LEGACY_POTION_BITS[data & 0xf];
  return {
    effect,
    level: data & 0x20 ? 2 : 1,
    extended: (data & 0x40) !== 0,
    splash: (data & 0x4000) !== 0,
    color: effectColor(effect),
  };
}

/** "minecraft:strong_healing", "long_swiftness", "INSTANT_HEAL", ... */
export function potionFromType(raw: string): PotionInfo {
  let name = raw.replace(/^minecraft:/, "").toLowerCase();
  let level = 1;
  let extended = false;
  if (name.startsWith("strong_")) {
    level = 2;
    name = name.slice(7);
  } else if (name.startsWith("long_")) {
    extended = true;
    name = name.slice(5);
  }
  const effect = POTION_TYPE_EFFECT[name] ?? effectKey(name.toUpperCase());
  return { effect: effect && EFFECTS[effect] ? effect : undefined, level, extended, color: effectColor(effect) };
}

export function roman(n: number): string {
  const numerals: [number, string][] = [
    [10, "X"],
    [9, "IX"],
    [5, "V"],
    [4, "IV"],
    [1, "I"],
  ];
  if (n <= 0 || n > 39) return String(n);
  let out = "";
  for (const [value, symbol] of numerals) {
    while (n >= value) {
      out += symbol;
      n -= value;
    }
  }
  return out;
}
