/**
 * Minecraft's legacy formatting codes (§a, §l, §x§f§f§0§0§0§0 hex, ...), which StrikePractice
 * keeps in kit and arena names ("§7River", "§a§lSumo") and item names.
 */

export const MC_COLORS: Record<string, string> = {
  "0": "#000000",
  "1": "#0000AA",
  "2": "#00AA00",
  "3": "#00AAAA",
  "4": "#AA0000",
  "5": "#AA00AA",
  "6": "#FFAA00",
  "7": "#AAAAAA",
  "8": "#555555",
  "9": "#5555FF",
  a: "#55FF55",
  b: "#55FFFF",
  c: "#FF5555",
  d: "#FF55FF",
  e: "#FFFF55",
  f: "#FFFFFF",
};

export type TextSegment = {
  text: string;
  color?: string;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  strike?: boolean;
  obfuscated?: boolean;
};

const CODE = /[§&]([0-9a-fk-orx])/i;

/** Splits a formatted string into styled runs. `&` codes are accepted too since configs often use them. */
export function parseFormatting(input: string): TextSegment[] {
  const segments: TextSegment[] = [];
  let style: Omit<TextSegment, "text"> = {};
  let text = "";
  const flush = () => {
    if (text) segments.push({ text, ...style });
    text = "";
  };

  for (let i = 0; i < input.length; i++) {
    const match = CODE.exec(input.slice(i, i + 2));
    if (!match || match.index !== 0) {
      text += input[i];
      continue;
    }
    const code = match[1].toLowerCase();
    flush();
    if (code === "x") {
      // §x§r§r§g§g§b§b
      const hex = input.slice(i + 2, i + 14).replace(/[§&]/g, "");
      if (/^[0-9a-f]{6}$/i.test(hex)) {
        style = { color: `#${hex}` };
        i += 13;
        continue;
      }
    } else if (MC_COLORS[code]) {
      style = { color: MC_COLORS[code] }; // a color resets the formatting, like in game
    } else if (code === "l") style = { ...style, bold: true };
    else if (code === "o") style = { ...style, italic: true };
    else if (code === "n") style = { ...style, underline: true };
    else if (code === "m") style = { ...style, strike: true };
    else if (code === "k") style = { ...style, obfuscated: true };
    else if (code === "r") style = {};
    i++;
  }
  flush();
  return segments;
}

export function stripFormatting(input: string | null | undefined): string {
  if (!input) return "";
  return input.replace(/[§&]x([§&][0-9a-f]){6}/gi, "").replace(/[§&][0-9a-fk-or]/gi, "");
}
