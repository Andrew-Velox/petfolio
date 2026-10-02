"use client";

import { useEffect } from "react";

/**
 * Summons the Petfolio pet on this site and wires its chat to /api/petfolio.
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
        ai: { endpoint: "/api/petfolio" },
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
