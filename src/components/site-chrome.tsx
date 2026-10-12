import { Link } from "@/components/link";
import { getConfig } from "@/lib/config";
import { brandingUrl } from "@/lib/images";
import { isDemo } from "@/lib/db";
import { SearchBox } from "./search-box";
import { NavLinks } from "./nav-links";

/** Default logo: a pixel sword in the accent color. Replace with site.logo in config.yml. */
export function DefaultMark({ size = 28 }: { size?: number }) {
  const blade = [
    [4, 7], [5, 6], [6, 5], [7, 4], [8, 3], [9, 2], [10, 1],
    [5, 7], [6, 6], [7, 5], [8, 4], [9, 3], [10, 2], [11, 1], [11, 0],
  ];
  const guard = [[2, 6], [3, 7], [4, 8], [5, 9], [6, 10]];
  const grip = [[3, 9], [2, 10], [1, 11]];
  const cells = (list: number[][], fill: string) =>
    list.map(([x, y]) => <rect key={`${fill}${x},${y}`} x={x} y={y} width={1.02} height={1.02} fill={fill} />);
  return (
    <svg viewBox="0 0 12 12" width={size} height={size} aria-hidden shapeRendering="crispEdges">
      {cells(blade, "var(--accent)")}
      {cells(guard, "var(--muted)")}
      {cells(grip, "var(--faint)")}
    </svg>
  );
}

export function SiteHeader() {
  const { site } = getConfig();
  const logo = brandingUrl(site.logo);
  return (
    <header className="border-b border-line">
      <div className="mx-auto flex max-w-[1180px] flex-wrap items-center gap-x-6 gap-y-3 px-4 py-3 sm:px-6">
        <Link href="/" className="flex items-center gap-2.5">
          {logo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logo} alt="" height={30} className="h-[30px] w-auto" />
          ) : (
            <DefaultMark />
          )}
          <span className="font-display text-[26px] leading-none font-extrabold tracking-tight">{site.name}</span>
        </Link>
        <NavLinks />
        <div className="order-last w-full sm:order-none sm:ml-auto sm:w-72">
          <SearchBox />
        </div>
      </div>
    </header>
  );
}

export function SiteFooter() {
  const { site } = getConfig();
  return (
    <footer className="mt-24 border-t border-line">
      <div className="mx-auto flex max-w-[1180px] flex-wrap items-center gap-x-6 gap-y-2 px-4 py-8 text-sm text-muted sm:px-6">
        <span>{site.name}</span>
        {site.links.map((l) => (
          <a key={l.url} href={l.url} className="hover:text-accent" rel="noopener">
            {l.label}
          </a>
        ))}
        <span className="sm:ml-auto">
          {isDemo() && <span className="mr-4 text-accent">Showing demo data</span>}
          Stats recorded by{" "}
          <a href="https://www.spigotmc.org/resources/46906/" className="underline decoration-line underline-offset-4 hover:text-accent">
            StrikePractice
          </a>
        </span>
      </div>
    </footer>
  );
}
