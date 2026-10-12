import { ItemIcon } from "./item-icon";
import { McText } from "./mc-text";
import { itemImage, textureUrl } from "@/lib/images";
import { hasGlint, itemDisplayName, itemNameColor, titleCase, type Item } from "@/lib/sp/items";
import { effectName, roman } from "@/lib/sp/potions";
import type { InventorySnapshot } from "@/lib/sp/fight-data";

/**
 * Pieces drawn the way the game draws them: inventory slots, tooltips, hearts and hunger.
 * This is the one place the site looks like Minecraft on purpose (see docs/DESIGN.md).
 */

export function ItemIconFor({ item, size = 32, label, fill }: { item: Item; size?: number; label?: string; fill?: boolean }) {
  return (
    <ItemIcon
      image={itemImage(item)}
      size={size}
      fill={fill}
      label={label}
      glint={hasGlint(item) && !item.potion ? textureUrl(`item/${item.id}`) : undefined}
    />
  );
}

function tooltipLines(item: Item): { text: string; color?: string }[] {
  const lines: { text: string; color?: string }[] = [];
  for (const e of item.enchantments) {
    lines.push({ text: `${titleCase(e.id)}${e.level > 1 || e.level === 0 ? ` ${roman(e.level)}` : ""}`, color: "#AAAAAA" });
  }
  if (item.potion?.effect) {
    const level = item.potion.level > 1 ? ` ${roman(item.potion.level)}` : "";
    lines.push({ text: `${effectName(item.potion.effect)}${level}`, color: "#5555FF" });
  }
  if (item.wear !== undefined) {
    lines.push({ text: `Durability ${Math.floor((1 - item.wear) * 100)}%`, color: "#AAAAAA" });
  }
  if (item.unbreakable) lines.push({ text: "Unbreakable", color: "#5555FF" });
  return lines;
}

/** One inventory slot. Its size comes from the --slot CSS variable (set by Inventory), or `size`. */
export function ItemSlot({ item, size, emptyIcon }: { item: Item | null; size?: number; emptyIcon?: string }) {
  const style = size ? { ["--slot" as string]: `${size}px` } : undefined;
  const iconBox = "h-[calc(var(--slot,40px)-8px)] w-[calc(var(--slot,40px)-8px)]";
  if (!item) {
    return (
      <div className="mc-slot" style={style}>
        {emptyIcon && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={emptyIcon} alt="" width={32} height={32} className={`pixelated opacity-60 ${iconBox}`} />
        )}
      </div>
    );
  }
  const name = item.name ?? itemDisplayName(item);
  const lines = tooltipLines(item);
  return (
    <div className="mc-slot group" style={style} tabIndex={0} aria-label={`${item.count > 1 ? `${item.count} × ` : ""}${name}`}>
      <span className={iconBox}>
        <ItemIconFor item={item} fill />
      </span>
      {item.count > 1 && <span className="mc-count">{item.count}</span>}
      {item.wear !== undefined && item.wear > 0 && (
        <span className="absolute bottom-[5px] left-[5px] right-[5px] h-[3px] bg-black" aria-hidden>
          <span
            className="block h-[2px]"
            style={{ width: `${(1 - item.wear) * 100}%`, background: `hsl(${(1 - item.wear) * 120} 100% 50%)` }}
          />
        </span>
      )}
      <span
        role="tooltip"
        className="mc-tooltip pointer-events-none absolute bottom-full left-1/2 z-30 mb-2 hidden -translate-x-1/2 group-hover:block group-focus-visible:block"
      >
        {item.name ? <McText text={item.name} /> : <span style={{ color: itemNameColor(item) }}>{name}</span>}
        {lines.map((line, i) => (
          <span key={i} className="block" style={{ color: line.color }}>
            {line.text}
          </span>
        ))}
      </span>
    </div>
  );
}

/** Hearts or hunger, 10 icons for 20 points, like the HUD */
function HudRow({
  value,
  full,
  half,
  empty,
  label,
  reverse,
}: {
  value: number;
  full: string;
  half: string;
  empty: string;
  label: string;
  reverse?: boolean;
}) {
  const points = Math.max(0, Math.min(20, Math.ceil(value)));
  return (
    <span className={`inline-flex ${reverse ? "flex-row-reverse" : ""}`} role="img" aria-label={label}>
      {Array.from({ length: 10 }, (_, i) => {
        const left = points - i * 2;
        return (
          <span key={i} className="relative h-3 w-3 sm:h-[18px] sm:w-[18px]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={empty} alt="" width={18} height={18} className="pixelated absolute inset-0 h-full w-full" />
            {left > 0 && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={left >= 2 ? full : half} alt="" width={18} height={18} className="pixelated absolute inset-0 h-full w-full" />
            )}
          </span>
        );
      })}
    </span>
  );
}

export function Hearts({ health, reverse }: { health: number; reverse?: boolean }) {
  return (
    <HudRow
      reverse={reverse}
      value={health}
      full={textureUrl("gui/sprites/hud/heart/full")}
      half={textureUrl("gui/sprites/hud/heart/half")}
      empty={textureUrl("gui/sprites/hud/heart/container")}
      label={`${Math.ceil(health) / 2} of 10 hearts`}
    />
  );
}

export function Hunger({ food, reverse }: { food: number; reverse?: boolean }) {
  return (
    <HudRow
      reverse={reverse}
      value={food}
      full={textureUrl("gui/sprites/hud/food_full")}
      half={textureUrl("gui/sprites/hud/food_half")}
      empty={textureUrl("gui/sprites/hud/food_empty")}
      label={`${food / 2} of 10 hunger`}
    />
  );
}

const ARMOR_PLACEHOLDERS = ["helmet", "chestplate", "leggings", "boots"] as const;

/**
 * The player's inventory when the fight ended: armor and offhand, the 27 main slots, then the
 * hotbar with a gap above it, as in the game's inventory screen.
 */
export function Inventory({ inventory }: { inventory: InventorySnapshot }) {
  const grid = { gridTemplateColumns: "repeat(9, var(--slot))" };
  return (
    <div className="mc-panel inline-block max-w-full [--slot:34px] sm:[--slot:40px]">
      <div className="mb-3 flex items-end gap-0">
        {ARMOR_PLACEHOLDERS.map((piece) => (
          <ItemSlot
            key={piece}
            item={inventory.armor[piece]}
            emptyIcon={textureUrl(`gui/sprites/container/slot/${piece}`)}
          />
        ))}
        {inventory.hasOffhand && (
          <>
            <span className="w-3" />
            <ItemSlot item={inventory.offhand} emptyIcon={textureUrl("gui/sprites/container/slot/shield")} />
          </>
        )}
      </div>
      <div className="grid" style={grid}>
        {inventory.slots.slice(9, 36).map((item, i) => (
          <ItemSlot key={i} item={item} />
        ))}
      </div>
      <div className="mt-3 grid" style={grid}>
        {inventory.slots.slice(0, 9).map((item, i) => (
          <ItemSlot key={i} item={item} />
        ))}
      </div>
    </div>
  );
}

export function EffectList({ effects }: { effects: InventorySnapshot["effects"] }) {
  // Effects lasting for hours are the kit's permanent ones (e.g. resistance in sumo): no timer
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted">
      {effects.map((e) => (
        <li key={e.id} className="flex items-center gap-1.5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={textureUrl(`mob_effect/${e.id}`)} alt="" width={18} height={18} className="pixelated" />
          <span className="text-text">
            {effectName(e.id)}
            {e.amplifier > 0 && ` ${roman(e.amplifier + 1)}`}
          </span>
          {e.seconds < 3600 && <span className="num">{`${Math.floor(e.seconds / 60)}:${String(e.seconds % 60).padStart(2, "0")}`}</span>}
        </li>
      ))}
    </ul>
  );
}
