import { Link } from "@/components/link";
import { headUrl } from "@/lib/images";

export function playerHref(player: { name: string; uuid?: string }): string {
  return `/player/${encodeURIComponent(player.name || player.uuid || "")}`;
}

export function PlayerHead({ player, size = 24, className = "" }: { player: { uuid: string; name: string }; size?: number; className?: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={headUrl(player, size * 2)}
      alt=""
      width={size}
      height={size}
      loading="lazy"
      className={`pixelated shrink-0 rounded-[3px] bg-surface-2 ${className}`}
    />
  );
}

/** Head + name, linking to the profile */
export function PlayerLink({
  player,
  size = 24,
  className = "",
}: {
  player: { uuid: string; name: string };
  size?: number;
  className?: string;
}) {
  return (
    <Link href={playerHref(player)} className={`group inline-flex min-w-0 items-center gap-2 ${className}`}>
      <PlayerHead player={player} size={size} />
      <span className="truncate group-hover:text-accent">{player.name}</span>
    </Link>
  );
}

/** #1 gold, #2 silver, #3 bronze, the rest plain */
export function RankNumber({ rank, className = "" }: { rank: number; className?: string }) {
  const color = rank === 1 ? "text-accent" : rank === 2 ? "text-silver" : rank === 3 ? "text-bronze" : "text-muted";
  return <span className={`num font-display text-lg font-bold ${color} ${className}`}>{rank}</span>;
}
