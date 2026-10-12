"use client";

import { useState } from "react";
import type { ItemImage } from "@/lib/images";

/**
 * Draws an item icon. Image sources are tried in order (rendered icon, item texture, block
 * texture) and a neutral placeholder shows if none load. Potions are drawn the way the game does:
 * a bottle over a liquid layer tinted with the effect's color.
 */
export function ItemIcon({
  image,
  size = 32,
  glint,
  label,
  fill = false,
}: {
  image: ItemImage;
  size?: number;
  /** Fill the parent box instead of using `size` (inventory slots size themselves with CSS) */
  fill?: boolean;
  /** Mask image for the enchantment glint (needs CORS, so a texture URL), or undefined for none */
  glint?: string;
  /** Accessible name; leave empty when the item is described next to it */
  label?: string;
}) {
  const [index, setIndex] = useState(0);
  const box = fill ? { width: "100%", height: "100%" } : { width: size, height: size };

  if (image.kind === "potion") {
    const mask = `url("${image.overlay}") center / contain no-repeat`;
    return (
      <span className="relative inline-block shrink-0" style={box} role={label ? "img" : undefined} aria-label={label}>
        <span className="absolute inset-0" style={{ background: image.color, WebkitMask: mask, mask }} />
        <img src={image.overlay} alt="" className="pixelated absolute inset-0 mix-blend-multiply" width={size} height={size} />
        <img src={image.bottle} alt="" className="pixelated absolute inset-0" width={size} height={size} />
      </span>
    );
  }

  const src = image.sources[index];
  if (!src) {
    return (
      <span
        className="inline-grid shrink-0 place-items-center rounded-sm bg-black/20 text-[10px] text-black/50"
        style={box}
        role={label ? "img" : undefined}
        aria-label={label}
      >
        ?
      </span>
    );
  }
  return (
    <span className="relative inline-block shrink-0" style={box}>
      <img
        src={src}
        alt={label ?? ""}
        width={size}
        height={size}
        loading="lazy"
        className="pixelated h-full w-full object-contain"
        onError={() => setIndex((i) => i + 1)}
      />
      {glint && <span className="mc-glint" style={{ ["--glint-mask" as string]: `url("${glint}")` }} />}
    </span>
  );
}
