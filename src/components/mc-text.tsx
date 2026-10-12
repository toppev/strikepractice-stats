import { parseFormatting } from "@/lib/sp/colors";

/**
 * Text with Minecraft § formatting codes, drawn in their in-game colors. Use `plain` where the
 * site's own typography should win (headings, tables) and colors would only add noise.
 */
export function McText({ text, plain = false, className }: { text: string; plain?: boolean; className?: string }) {
  const segments = parseFormatting(text);
  return (
    <span className={className}>
      {segments.map((s, i) => (
        <span
          key={i}
          style={
            plain
              ? undefined
              : {
                  color: s.color,
                  fontWeight: s.bold ? 700 : undefined,
                  fontStyle: s.italic ? "italic" : undefined,
                  textDecoration: [s.underline && "underline", s.strike && "line-through"].filter(Boolean).join(" ") || undefined,
                }
          }
        >
          {s.text}
        </span>
      ))}
    </span>
  );
}
