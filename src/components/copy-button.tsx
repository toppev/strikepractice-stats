"use client";

import { useState } from "react";

/** Shows a value with a button that copies it; the button confirms with "Copied" */
export function CopyValue({ value, label, className = "" }: { value: string; label: string; className?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <span className={`inline-flex items-center gap-1 rounded-lg border border-line bg-surface-2 pl-3.5 ${className}`}>
      <code className="font-sans text-[15px] tracking-wide text-text">{value}</code>
      <button
        type="button"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(value);
            setCopied(true);
            setTimeout(() => setCopied(false), 1600);
          } catch {
            // No clipboard access (insecure origin): the value is selectable anyway
          }
        }}
        className="m-1 rounded-md px-3 py-1.5 text-sm font-semibold text-accent hover:bg-bg"
        aria-label={`${label}: ${value}`}
      >
        <span aria-live="polite">{copied ? "Copied" : label}</span>
      </button>
    </span>
  );
}
