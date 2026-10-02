import Link from "next/link";
import CopyCommand from "./components/CopyCommand";
import { asset } from "./lib/asset";

const GITHUB = "https://github.com/Andrew-Velox/petfolio";
const NPM = "https://www.npmjs.com/package/petfolio";

const FEATURES = [
  {
    emoji: "🐾",
    title: "Moves like a real Shimeji",
    body: "Walks, runs, jumps, climbs walls, crawls on the ceiling and falls — ported from the original engine, 25 ticks a second.",
  },
  {
    emoji: "💬",
    title: "Chats about your site",
    body: "Visitors click chat and ask anything. It answers from your own content using a free Groq or Gemini key.",
  },
  {
    emoji: "🫶",
    title: "Cute on its own",
    body: "Says little sweet things while it wanders. Drag it, throw it, or let it peek in from the corner.",
  },
  {
    emoji: "⚡",
    title: "One line of code",
    body: "Petfolio.summon() and your page has a mascot. No config, no framework needed.",
  },
  {
    emoji: "🎀",
    title: "Switch avatars",
    body: "Right-click for the menu: change avatar, chat, settings, or send it off screen.",
  },
  {
    emoji: "🪪",
    title: "MIT licensed",
    body: "Use it in any project, personal or commercial.",
  },
];

const STEPS = [
  {
    n: "1",
    title: "Install",
    code: "npm install petfolio",
  },
  {
    n: "2",
    title: "Build its memory",
    code: "npx petfolio-cli",
  },
  {
    n: "3",
    title: "Summon",
    code: "Petfolio.summon({ ai: { endpoint: '/api/petfolio' } })",
  },
];

function Pill({
  href,
  children,
  dark,
}: {
  href: string;
  children: React.ReactNode;
  dark?: boolean;
}) {
  return (
    <a
      href={href}
      target={href.startsWith("http") ? "_blank" : undefined}
      rel="noopener noreferrer"
      className={
        dark
          ? "inline-flex items-center gap-2 rounded-full bg-black px-5 py-3 text-[15px] font-bold text-white shadow-[0_8px_24px_-8px_rgba(0,0,0,.5)] transition hover:-translate-y-0.5 hover:bg-neutral-800"
          : "inline-flex items-center gap-2 rounded-full border border-line bg-white/70 px-5 py-3 text-[15px] font-semibold text-foreground transition hover:-translate-y-0.5 hover:bg-white"
      }
    >
      {children}
    </a>
  );
}

export default function Home() {
  return (
    <main className="relative overflow-hidden">
      {/* soft pastel glows */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[900px]"
        style={{
          background:
            "radial-gradient(50% 40% at 15% 20%, rgba(255,179,199,.28), transparent 70%), radial-gradient(45% 40% at 85% 35%, rgba(167,200,255,.32), transparent 70%)",
        }}
      />

      {/* Nav */}
      <header className="sticky top-0 z-20 border-b border-line bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-3.5">
          <Link href="/" className="flex items-center gap-2.5">
            <span className="grid size-9 place-items-center overflow-hidden rounded-full bg-white shadow-sm ring-1 ring-line">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={asset("/avatars/logo.png")} alt="" className="sprite size-9 object-cover" style={{ filter: "none" }} />
            </span>
            <span className="text-xl font-black tracking-tight">Petfolio</span>
          </Link>
          <nav className="flex items-center gap-1 text-[15px] font-semibold text-muted sm:gap-2">
            <a href="#features" className="hidden rounded-full px-3 py-2 transition hover:text-foreground sm:block">
              Features
            </a>
            <a href="#how" className="hidden rounded-full px-3 py-2 transition hover:text-foreground sm:block">
              How it works
            </a>
            <a href={GITHUB} target="_blank" rel="noopener noreferrer" className="rounded-full px-3 py-2 transition hover:text-foreground">
              GitHub
            </a>
            <a
              href={NPM}
              target="_blank"
              rel="noopener noreferrer"
              className="ml-1 rounded-full bg-black px-4 py-2 text-white transition hover:bg-neutral-800"
            >
              npm
            </a>
          </nav>
        </div>
      </header>

      {/* Hero */}
      <section className="mx-auto flex min-h-[calc(100svh-4.1rem)] max-w-6xl flex-col items-center justify-center px-6 py-10 text-center">
        <div className="relative mx-auto mt-6 w-fit">
          {/* version badge: aligned with the wordmark's left edge */}
          <span className="rise mb-5 flex w-fit items-center gap-2 rounded-full border border-line bg-white/80 px-3.5 py-1.5 text-sm font-semibold text-muted">
            <span className="size-2 rounded-full bg-emerald-400" />
            v1.2.0 · free & open source
          </span>
          {/* font-size lives on this wrapper so avatar sizes/positions can use em */}
          <div className="relative" style={{ fontSize: "clamp(4.2rem, min(21vw, 30svh), 17rem)" }}>
            <h1
              className="rise select-none font-black leading-[0.82] tracking-[-0.05em] text-[#232323]"
              style={{ animationDelay: ".05s" }}
            >
              Petfolio
            </h1>

            {/* friends perched on the letters */}
            {/* eslint-disable @next/next/no-img-element */}
            {/* sitting avatar: feet on top of the first "o" (x-height line ≈ .25em below the line box top) */}
            <div
              className="absolute z-10"
              style={{ left: "60%", top: ".25em", width: ".52em", transform: "translate(-50%, calc(-100% + .05em))" }}
            >
              <img
                src={asset("/avatars/sit_finn.png")}
                alt="A cute avatar sitting on the letter o"
                className="sprite bob block w-full"
                style={{ ["--tilt" as string]: "-3deg" }}
              />
            </div>
            <img
              src={asset("/avatars/stand.png")}
              alt="Another cute avatar"
              className="sprite bob-slow absolute z-10"
              style={{ top: ".02em", right: "-.3em", width: ".5em", ["--tilt" as string]: "7deg" }}
            />
            {/* eslint-enable @next/next/no-img-element */}
          </div>
        </div>

        <p
          className="rise mx-auto mt-3 max-w-3xl text-balance text-2xl font-extrabold tracking-tight sm:text-4xl"
          style={{ animationDelay: ".15s" }}
        >
          A tiny friend for every website
        </p>
        <p
          className="rise mx-auto mt-4 max-w-xl text-balance text-lg font-semibold text-muted"
          style={{ animationDelay: ".22s" }}
        >
          It walks, climbs and jumps like a Shimeji, says sweet things, and answers
          your visitors' questions about you.
        </p>

        <div
          className="rise mt-9 flex flex-wrap items-center justify-center gap-3"
          style={{ animationDelay: ".3s" }}
        >
          <CopyCommand command="npm install petfolio" />
          <CopyCommand command="npx petfolio-cli" />
        </div>
      </section>

      {/* Features */}
      <section id="features" className="mx-auto max-w-6xl scroll-mt-24 px-6 pb-24">
        <h2 className="text-center text-3xl font-black tracking-tight sm:text-5xl">
          Small, soft, surprisingly capable
        </h2>
        <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f) => (
            <div
              key={f.title}
              className="group rounded-[28px] border border-line bg-white p-7 shadow-[0_1px_0_rgba(0,0,0,.02),0_18px_40px_-24px_rgba(40,60,58,.25)] transition hover:-translate-y-1 hover:shadow-[0_24px_48px_-24px_rgba(40,60,58,.35)]"
            >
              <div className="grid size-12 place-items-center rounded-2xl bg-[#f2f8f7] text-2xl transition group-hover:scale-110">
                {f.emoji}
              </div>
              <h3 className="mt-5 text-xl font-extrabold tracking-tight">{f.title}</h3>
              <p className="mt-2 font-semibold leading-relaxed text-muted">{f.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section id="how" className="mx-auto max-w-4xl scroll-mt-24 px-6 pb-28">
        <div className="relative rounded-[36px] border border-line bg-white p-8 shadow-[0_30px_70px_-40px_rgba(40,60,58,.4)] sm:p-12">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={asset("/avatars/sit.png")}
            alt=""
            className="sprite bob absolute -top-16 right-6 hidden w-28 sm:block"
            style={{ ["--tilt" as string]: "4deg" }}
          />
          <h2 className="text-3xl font-black tracking-tight sm:text-4xl">How it works</h2>
          <p className="mt-2 font-semibold text-muted">
            Three steps. The pet only ever answers from your own content.
          </p>
          <ol className="mt-8 space-y-4">
            {STEPS.map((s) => (
              <li key={s.n} className="flex flex-col gap-3 rounded-2xl bg-[#f2f8f7] p-4 sm:flex-row sm:items-center sm:gap-5 sm:p-5">
                <div className="flex items-center gap-3 sm:w-52">
                  <span className="grid size-9 place-items-center rounded-full bg-black text-sm font-black text-white">
                    {s.n}
                  </span>
                  <span className="text-lg font-extrabold">{s.title}</span>
                </div>
                <code className="min-w-0 flex-1 overflow-x-auto whitespace-nowrap rounded-xl border border-line bg-white px-4 py-3 font-mono text-[13.5px] text-[#3b3b52]">
                  {s.code}
                </code>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Closing CTA */}
      <section className="mx-auto max-w-3xl px-6 pb-24 text-center">
        <h2 className="text-balance text-3xl font-black tracking-tight sm:text-5xl">
          Give your site a friend.
        </h2>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Pill href={NPM} dark>
            npm install petfolio
          </Pill>
          <Pill href={GITHUB}>Star on GitHub ⭐</Pill>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-line">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-6 py-7 text-sm font-semibold text-muted sm:flex-row">
          <span>© {new Date().getFullYear()} Petfolio · MIT license</span>
          <span>
            Made with 💕 ·{" "}
            <a href={GITHUB} target="_blank" rel="noopener noreferrer" className="transition hover:text-foreground">
              Source on GitHub
            </a>
          </span>
        </div>
      </footer>
    </main>
  );
}
