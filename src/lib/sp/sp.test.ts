import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizeItem, itemDisplayName, parseLoose } from "./items";
import { legacyNameFromNumber, modernIdFromLegacy, enchantmentKey } from "./legacy";
import { parseFormatting, stripFormatting } from "./colors";
import { parsePlayerData, parseFightData } from "./fight-data";
import { potionFromLegacyData } from "./potions";

test("1.8 numeric ids line up with Bukkit's Material", () => {
  assert.equal(legacyNameFromNumber(1), "STONE");
  assert.equal(legacyNameFromNumber(35), "WOOL");
  assert.equal(legacyNameFromNumber(159), "STAINED_CLAY");
  assert.equal(legacyNameFromNumber(197), "DARK_OAK_DOOR");
  assert.equal(legacyNameFromNumber(276), "DIAMOND_SWORD");
  assert.equal(legacyNameFromNumber(282), "MUSHROOM_SOUP");
  assert.equal(legacyNameFromNumber(322), "GOLDEN_APPLE");
  assert.equal(legacyNameFromNumber(373), "POTION");
  assert.equal(legacyNameFromNumber(425), "BANNER");
  assert.equal(legacyNameFromNumber(438), "SPLASH_POTION");
  assert.equal(legacyNameFromNumber(2256), "GOLD_RECORD");
  assert.equal(legacyNameFromNumber(2267), "RECORD_12");
});

test("legacy names map to modern ids", () => {
  assert.equal(modernIdFromLegacy("WOOD_SWORD"), "wooden_sword");
  assert.equal(modernIdFromLegacy("GOLDEN_APPLE", 1), "enchanted_golden_apple");
  assert.equal(modernIdFromLegacy("STAINED_CLAY", 14), "red_terracotta");
  assert.equal(modernIdFromLegacy("WOOL", 11), "blue_wool");
  assert.equal(modernIdFromLegacy("MUSHROOM_SOUP"), "mushroom_stew");
  assert.equal(modernIdFromLegacy("DIAMOND_SPADE"), "diamond_shovel");
  assert.equal(modernIdFromLegacy("ENDER_PEARL"), "ender_pearl");
  assert.equal(enchantmentKey("Enchantment[16, DAMAGE_ALL]"), "sharpness");
  assert.equal(enchantmentKey("minecraft:fire_aspect"), "fire_aspect");
  assert.equal(enchantmentKey("DURABILITY"), "unbreaking");
});

test("1.8 potion data values", () => {
  assert.deepEqual(potionFromLegacyData(16421), {
    effect: "instant_health",
    level: 2,
    extended: false,
    splash: true,
    color: "#F82423",
  });
  assert.equal(potionFromLegacyData(8226).effect, "speed");
  assert.equal(potionFromLegacyData(8226).level, 2);
  assert.equal(potionFromLegacyData(8259).extended, true);
});

test("items in every stored format", () => {
  const modern = normalizeItem({
    DataVersion: 4790,
    id: "minecraft:diamond_sword",
    count: 1,
    components: { "minecraft:enchantments": '{"minecraft:sharpness":5,"minecraft:unbreaking":3}', "minecraft:damage": "156" },
  });
  assert.equal(modern?.id, "diamond_sword");
  assert.deepEqual(modern?.enchantments, [
    { id: "sharpness", level: 5 },
    { id: "unbreaking", level: 3 },
  ]);
  assert.ok(modern?.wear && modern.wear > 0.09 && modern.wear < 0.11);

  const modernPotion = normalizeItem({
    id: "minecraft:splash_potion",
    count: 1,
    components: { "minecraft:potion_contents": '{potion:"minecraft:strong_healing"}' },
  });
  assert.equal(modernPotion?.potion?.effect, "instant_health");
  assert.equal(modernPotion?.potion?.level, 2);
  assert.equal(itemDisplayName(modernPotion!), "Splash Potion of Healing");

  const legacy = normalizeItem({ type: "POTION", damage: 16421 });
  assert.equal(legacy?.id, "splash_potion");
  assert.equal(legacy?.count, 1);

  const enchanted = normalizeItem({
    type: "DIAMOND_SWORD",
    damage: 6,
    meta: { "meta-type": "UNSPECIFIC", enchants: { DAMAGE_ALL: 2, FIRE_ASPECT: 2 } },
  });
  assert.deepEqual(enchanted?.enchantments, [
    { id: "sharpness", level: 2 },
    { id: "fire_aspect", level: 2 },
  ]);

  const numeric = normalizeItem({ type: 322, amount: 64, durability: 1 });
  assert.equal(numeric?.id, "enchanted_golden_apple");
  assert.equal(numeric?.count, 64);

  assert.equal(normalizeItem({ type: 0, amount: 0, durability: 0 }), null);
  assert.equal(normalizeItem({ id: "minecraft:air", schema_version: 1 }), null);
  assert.equal(normalizeItem(null), null);
});

test("custom names from text components and SNBT", () => {
  const icon = normalizeItem({
    id: "minecraft:ink_sac",
    count: 1,
    components: { "minecraft:custom_name": '"§a§lSumo"' },
  });
  assert.equal(icon?.name, "§a§lSumo");
  assert.deepEqual(parseLoose('{potion:"minecraft:strong_swiftness"}'), { potion: "minecraft:strong_swiftness" });
});

test("formatting codes", () => {
  assert.equal(stripFormatting("§7River"), "River");
  assert.equal(stripFormatting("§x§f§f§0§0§0§0Red"), "Red");
  const parts = parseFormatting("§a§lBuild §7UHC");
  assert.deepEqual(parts, [
    { text: "Build ", color: "#55FF55", bold: true },
    { text: "UHC", color: "#AAAAAA" },
  ]);
});

test("player data", () => {
  const data = parsePlayerData(
    JSON.stringify({
      name: "Alex",
      uuid: "00000000-0000-4000-8000-000000000001",
      fightInventory: {
        mainInv: [{ type: "DIAMOND_SWORD" }, null, { type: "POTION", damage: 16421, amount: 1 }],
        dead: true,
        effects: [{ effect: 1, duration: 841, amplifier: 1 }],
        food: 18,
        helmet: { type: "DIAMOND_HELMET" },
        health: 0,
        left: 7,
        leftPotions: true,
      },
      fightStatistics: { kits: 32, currentCombo: 1, longestCombo: 10, potionsThrown: 20, potionsMissed: 2, potionIntensities: 15.5 },
      oldElo: 1000,
      newElo: 988,
    }),
  );
  assert.equal(data.stats?.hits, 32);
  assert.equal(data.stats?.potionAccuracy, 78);
  assert.equal(data.inventory?.slots.length, 36);
  assert.equal(data.inventory?.slots[0]?.id, "diamond_sword");
  assert.equal(data.inventory?.armor.helmet?.id, "diamond_helmet");
  assert.deepEqual(data.inventory?.effects, [{ id: "speed", amplifier: 1, seconds: 42 }]);
  assert.deepEqual(data.inventory?.remaining, { kind: "potions", count: 7 });
  assert.equal(data.newElo - data.oldElo, -12);

  assert.deepEqual(parsePlayerData("not json"), { inventory: null, stats: null, oldElo: 0, newElo: 0 });
  assert.deepEqual(parseFightData('{"hh":"x","aI":{}}'), { kit: undefined, replayId: undefined, pluginVersion: undefined, serverVersion: undefined });
});
