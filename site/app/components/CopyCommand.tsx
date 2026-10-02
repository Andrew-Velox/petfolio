"use client";

import { useState } from "react";

export default function CopyCommand({ command }: { command: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(command);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      /* clipboard blocked: the command is still selectable */
    }
  }

  return (
    <div className="inline-flex max-w-full items-center gap-3 rounded-full bg-black py-2 pl-5 pr-2 text-white shadow-[0_8px_24px_-8px_rgba(0,0,0,.5)]">
      <code className="min-w-0 overflow-x-auto whitespace-nowrap font-mono text-[14.5px]">
        <span className="select-none text-neutral-500">$ </span>
        {command}
      </code>
      <button
        type="button"
        onClick={copy}
        aria-label={`Copy ${command}`}
        className="shrink-0 rounded-full bg-white/15 px-3.5 py-1.5 text-[13px] font-bold transition hover:bg-white/25"
      >
        {copied ? "Copied ✓" : "Copy"}
      </button>
    </div>
  );
}
