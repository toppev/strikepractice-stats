"use client";

/**
 * Shown when a page throws, most often because the database can't be reached or config.yml is
 * invalid. The details are in the server log (docker compose logs); `npm run doctor` checks both.
 */
export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="max-w-xl py-24">
      <h1 className="font-display text-6xl font-black">Stats are unavailable</h1>
      <p className="mt-4 text-lg text-muted">
        The site couldn&apos;t load this page. If you run this server, check its log: the usual causes are a database that can&apos;t be
        reached or a mistake in config.yml.
      </p>
      {error.digest && <p className="mt-2 text-sm text-faint">Error reference {error.digest}</p>}
      <button
        type="button"
        onClick={reset}
        className="mt-8 rounded-lg bg-accent px-5 py-2.5 font-semibold text-accent-ink hover:brightness-110"
      >
        Try again
      </button>
    </div>
  );
}
