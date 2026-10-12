import Link from "next/link";
import { PlayerHead } from "./player";
import { ItemIconFor } from "./minecraft";
import type { FightSummary, FightPlayer } from "@/lib/queries/fights";
import type { KitInfo } from "@/lib/queries/kits";
import { duration, formatDate, signed, timeAgo } from "@/lib/format";
import { stripFormatting } from "@/lib/sp/colors";
import { titleCase } from "@/lib/sp/items";

/**
 * Kit icon + name. `markRanked` adds a small "Ranked" for elo kits, for lists where the ranked
 * and unranked versions of a kit (same icon, same name) appear side by side.
 */
export function KitLabel({ kit, name, size = 20, markRanked = false }: { kit?: KitInfo; name: string; size?: number; markRanked?: boolean }) {
  return (
    <span className="inline-flex min-w-0 items-center gap-2">
      {kit?.icon ? <ItemIconFor item={kit.icon} size={size} /> : <span style={{ width: size }} />}
      <span className="truncate">{kit?.label ?? titleCase(stripFormatting(name))}</span>
      {markRanked && kit?.eloColumn && <span className="shrink-0 text-xs text-accent">Ranked</span>}
    </span>
  );
}

function names(players: FightPlayer[]) {
  return players.map((p) => p.name).join(", ") || "Unknown";
}

/**
 * One fight in a list. With `perspective` (a player's UUID) it reads from that player's side:
 * win/loss, opponent, their elo change. Without it, it reads "winner beat loser".
 * The colored edge is the result, so the list scans by outcome.
 */
export function FightRow({
  fight,
  kits,
  perspective,
  absoluteDates = false,
}: {
  fight: FightSummary;
  kits: Map<string, KitInfo>;
  perspective?: string;
  absoluteDates?: boolean;
}) {
  const kit = kits.get(fight.kit);
  const me = perspective ? [...fight.winners, ...fight.losers].find((p) => p.uuid === perspective) : undefined;
  const won = me?.winner;
  const opponents = me ? (won ? fight.losers : fight.winners) : [];
  const edge = me ? (won ? "bg-win" : "bg-loss") : "bg-line";
  const elo = me?.eloChange ?? fight.winners[0]?.eloChange ?? null;

  return (
    <li>
      <Link href={`/fight/${fight.id}`} className="flex items-center gap-4 rounded-md py-2.5 pr-3 hover:bg-surface">
        <span className={`h-10 w-1 shrink-0 rounded-full ${edge}`} aria-hidden />
        <span className="min-w-0 flex-1">
          <span className="flex min-w-0 items-center gap-2">
            {me ? (
              <>
                <span className={`shrink-0 font-semibold ${won ? "text-win" : "text-loss"}`}>{won ? "Win" : "Loss"}</span>
                <span className="shrink-0 text-sm text-faint">vs</span>
                {opponents[0] && <PlayerHead player={opponents[0]} size={20} />}
                <span className="truncate">{names(opponents)}</span>
              </>
            ) : (
              <>
                {fight.winners[0] && <PlayerHead player={fight.winners[0]} size={20} />}
                <span className="truncate font-medium">{names(fight.winners)}</span>
                <span className="shrink-0 text-sm text-faint">beat</span>
                <span className="truncate text-muted">{names(fight.losers)}</span>
              </>
            )}
          </span>
          <span className="mt-0.5 flex min-w-0 items-center gap-3 text-sm text-muted">
            <KitLabel kit={kit} name={fight.kit} size={16} />
            {fight.ranked && <span className="shrink-0 text-accent">Ranked</span>}
            <span className="num shrink-0 text-faint">{duration(fight.ended - fight.started)}</span>
          </span>
        </span>
        <span className="flex shrink-0 flex-col items-end text-sm">
          {elo !== null ? (
            <span className={`num font-semibold ${me ? (elo >= 0 ? "text-win" : "text-loss") : "text-text"}`}>
              {me ? `${signed(elo)} elo` : `±${Math.abs(elo)} elo`}
            </span>
          ) : (
            <span aria-hidden>&nbsp;</span>
          )}
          <time dateTime={new Date(fight.started).toISOString()} className="whitespace-nowrap text-muted" title={formatDate(fight.started)}>
            {absoluteDates ? formatDate(fight.started) : timeAgo(fight.started)}
          </time>
        </span>
      </Link>
    </li>
  );
}

export function FightList({ children, empty }: { children: React.ReactNode; empty?: React.ReactNode }) {
  const items = Array.isArray(children) ? children.filter(Boolean) : children ? [children] : [];
  if (items.length === 0) return <p className="py-6 text-muted">{empty ?? "No fights yet."}</p>;
  return <ul className="divide-y divide-line/60">{children}</ul>;
}
