"use client";

import { useEffect, useState } from "react";
import { asset } from "../lib/asset";

export type AvatarInfo = {
  name: string;
  displayName: string;
  author: string;
  bundled: boolean;
  frames: number[];
};

/** Copies `text`; `copied` is true for a moment afterwards. */
function useCopy(text: string) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      /* clipboard blocked: the text is still selectable */
    }
  }
  return [copied, copy] as const;
}

const WALK = [0, 1, 0, 2]; // indexes into `frames`: the walk cycle

export default function AvatarCard({ avatar }: { avatar: AvatarInfo }) {
  const code = `Petfolio.summon({ character: '${avatar.name}' })`;
  const [nameCopied, copyName] = useCopy(avatar.name);
  const [codeCopied, copyCode] = useCopy(code);
  const [step, setStep] = useState(-1); // -1 = standing still; otherwise walking while hovered

  useEffect(() => {
    if (step < 0) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const id = setInterval(() => setStep((s) => (s + 1) % WALK.length), 170);
    return () => clearInterval(id);
  }, [step < 0]); // eslint-disable-line react-hooks/exhaustive-deps

  const frame = avatar.frames[step < 0 ? 0 : WALK[step]];

  return (
    <article
      className="group flex flex-col rounded-[28px] border border-line bg-white p-6 shadow-[0_1px_0_rgba(0,0,0,.02),0_18px_40px_-24px_rgba(40,60,58,.25)] transition hover:-translate-y-1 hover:shadow-[0_24px_48px_-24px_rgba(40,60,58,.35)]"
      onMouseEnter={() => setStep(0)}
      onMouseLeave={() => setStep(-1)}
      onFocus={() => setStep(0)}
      onBlur={() => setStep(-1)}
    >
      <div className="relative grid h-44 place-items-center rounded-2xl bg-[#f2f8f7]">
        {avatar.bundled && (
          <span className="absolute left-3 top-3 rounded-full bg-white px-2.5 py-1 text-xs font-bold text-muted ring-1 ring-line">
            built in · default
          </span>
        )}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={asset(`/avatar-previews/${avatar.name}/shime${frame}.png`)}
          alt={`${avatar.displayName} avatar`}
          className="sprite h-auto max-h-36 w-auto max-w-[9rem]"
        />
      </div>

      <h3 className="mt-5 text-xl font-extrabold tracking-tight">{avatar.displayName}</h3>
      {avatar.author && <p className="text-sm font-semibold text-muted">by {avatar.author}</p>}

      <div className="mt-4 flex items-center gap-2 rounded-xl border border-line bg-[#f7fbfa] py-1.5 pl-3.5 pr-1.5">
        <code className="min-w-0 flex-1 truncate font-mono text-[15px] font-bold" title={avatar.name}>
          {avatar.name}
        </code>
        <button
          type="button"
          onClick={copyName}
          aria-label={nameCopied ? `Copied ${avatar.name}` : `Copy the name ${avatar.name}`}
          className="shrink-0 rounded-lg bg-black px-3 py-1.5 text-[13px] font-bold text-white transition hover:bg-neutral-800"
        >
          {nameCopied ? "Copied ✓" : "Copy name"}
        </button>
      </div>

      <button
        type="button"
        onClick={copyCode}
        aria-label={codeCopied ? "Copied the code" : `Copy the code that uses ${avatar.name}`}
        className="mt-2 rounded-lg px-3 py-2 text-left font-mono text-[12.5px] font-semibold text-muted transition hover:bg-[#f2f8f7] hover:text-foreground"
      >
        {codeCopied ? "Copied ✓" : <>{code} <span className="font-sans font-bold">· copy</span></>}
      </button>
    </article>
  );
}
