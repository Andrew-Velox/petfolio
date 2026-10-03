"use client";

import { useEffect } from "react";

const BASE = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

// Where the chat server lives. Default: this site's own /api/petfolio route.
// On GitHub Pages there is no server, so it must be set explicitly (a full URL to
// the deployed route) — if not, the chat button is hidden instead of asking
// visitors for an API key.
const ENDPOINT =
  process.env.NEXT_PUBLIC_PETFOLIO_ENDPOINT || (process.env.NEXT_PUBLIC_STATIC_EXPORT ? "" : "/api/petfolio");

/**
 * Summons the Petfolio pet on this site and wires its chat to the chat route.
 * Petfolio touches `window`/WebGL, so it is imported inside the effect (browser only).
 */
export default function PetfolioMount() {
  useEffect(() => {
    let pet: { destroy(): void } | undefined;
    let cancelled = false;

    import("petfolio").then(({ Petfolio }) => {
      if (cancelled) return; // unmounted (or React StrictMode's dev remount) before the import finished
      pet = Petfolio.summon({
        name: "Petfolio",
        chat: Boolean(ENDPOINT),
        ai: { endpoint: ENDPOINT || undefined, knowledge: `${BASE}/petfolio-knowledge.json` },
        suggestions: ["What is Petfolio?", "How do I install it?", "Is it free?"],
      });
    });

    return () => {
      cancelled = true;
      pet?.destroy();
    };
  }, []);

  return null;
}
