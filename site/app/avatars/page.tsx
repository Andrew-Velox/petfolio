import type { Metadata } from "next";
import AvatarCard, { type AvatarInfo } from "../components/AvatarCard";
import SiteHeader from "../components/SiteHeader";
import { AVATARS_FOLDER } from "../lib/links";
import avatars from "./avatars.generated.json";

export const metadata: Metadata = {
  title: "Avatars — Petfolio",
  description: "Pick a Petfolio avatar, copy its name and set it on your website with one option.",
};

export default function AvatarsPage() {
  const list = avatars as AvatarInfo[];
  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-6xl px-6 pb-24 pt-12 sm:pt-16">
        <h1 className="text-balance text-4xl font-black tracking-tight sm:text-6xl">Pick an avatar</h1>
        <p className="mt-4 max-w-2xl text-lg font-semibold leading-relaxed text-muted">
          Petfolio ships with just one avatar to stay small. Every other one is downloaded by name, only when
          your site asks for it. Copy a name and put it in the <code className="font-mono">character</code> option.
        </p>

        <div className="mt-8 overflow-x-auto rounded-2xl bg-black px-5 py-4 text-white">
          <code className="whitespace-nowrap font-mono text-[14.5px]">
            <span className="select-none text-neutral-500">{"// "}</span>
            Petfolio.summon({"{ "}character: <span className="text-emerald-300">&apos;saeyoung&apos;</span>{" }"})
          </code>
        </div>

        <ul className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3" aria-label="Avatars">
          {list.map((a) => (
            <li key={a.name} className="contents">
              <AvatarCard avatar={a} />
            </li>
          ))}
        </ul>

        <section className="mt-16 rounded-[28px] border border-line bg-white p-7 sm:p-10">
          <h2 className="text-2xl font-black tracking-tight sm:text-3xl">Add your own avatar</h2>
          <p className="mt-2 font-semibold text-muted">
            Open a pull request that adds one folder to the repo. It appears here on the next deploy.
          </p>
          <ol className="mt-5 list-decimal space-y-2 pl-5 font-semibold leading-relaxed">
            <li>
              Create <code className="font-mono">avatars/your-name/</code> (lowercase letters, digits and dashes — this is
              the name people copy).
            </li>
            <li>
              Add <code className="font-mono">avatar.json</code> with <code className="font-mono">name</code>,{" "}
              <code className="font-mono">displayName</code> and <code className="font-mono">author</code>.
            </li>
            <li>
              Add <code className="font-mono">shime1.png … shime46.png</code>: square, 64–256 px, 40 KB or less each. The
              numbers are Shimeji&apos;s frame numbers (1 = standing, 2–3 = walking, …).
            </li>
            <li>
              Check it with <code className="font-mono">node scripts/check-avatars.mjs</code>.
            </li>
          </ol>
          <a
            href={AVATARS_FOLDER}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-6 inline-block rounded-full bg-black px-5 py-2.5 text-[15px] font-bold text-white transition hover:bg-neutral-800"
          >
            See the avatars folder on GitHub
          </a>
        </section>
      </main>
    </>
  );
}
