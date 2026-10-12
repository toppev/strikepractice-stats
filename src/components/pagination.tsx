import Link from "next/link";

/** Previous / next with the page position; `href(page)` builds each link */
export function Pagination({ page, pages, href }: { page: number; pages: number; href: (page: number) => string }) {
  if (pages <= 1) return null;
  const link = "rounded-md border border-line px-3.5 py-1.5 text-sm hover:border-accent hover:text-accent";
  const off = "rounded-md border border-line/50 px-3.5 py-1.5 text-sm text-faint";
  return (
    <nav aria-label="Pages" className="flex items-center justify-between gap-4 pt-5">
      {page > 1 ? (
        <Link href={href(page - 1)} className={link} rel="prev">
          Previous
        </Link>
      ) : (
        <span className={off}>Previous</span>
      )}
      <span className="num text-sm text-muted">
        Page {page} of {pages}
      </span>
      {page < pages ? (
        <Link href={href(page + 1)} className={link} rel="next">
          Next
        </Link>
      ) : (
        <span className={off}>Next</span>
      )}
    </nav>
  );
}

export function pageParam(value: string | string[] | undefined): number {
  const n = Number(Array.isArray(value) ? value[0] : value);
  return Number.isInteger(n) && n > 0 ? Math.min(n, 10_000) : 1;
}
