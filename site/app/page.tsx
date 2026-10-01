import Link from "next/link";

export default function Home() {
  return (
    <main className="relative min-h-screen overflow-hidden">
      {/* Background glow */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          background:
            "radial-gradient(60% 50% at 50% 0%, rgba(99,102,241,0.18) 0%, rgba(10,10,15,0) 60%)",
        }}
      />

      {/* Nav */}
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
        <Link href="/" className="text-lg font-semibold tracking-tight">
          🐾 <span className="text-[var(--accent)]">Petfolio</span>
        </Link>
        <nav className="flex items-center gap-6 text-sm text-neutral-300">
          <a
            href="https://github.com/Andrew-Velox/petfolio"
            target="_blank"
            rel="noopener noreferrer"
            className="transition hover:text-white"
          >
            GitHub
          </a>
          <a
            href="https://www.npmjs.com/package/petfolio"
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-md border border-white/10 bg-white/5 px-3 py-1.5 transition hover:bg-white/10"
          >
            npm
          </a>
        </nav>
      </header>

      {/* Hero */}
      <section className="mx-auto flex max-w-5xl flex-col items-center px-6 pt-16 pb-24 text-center sm:pt-24">
        <span className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-neutral-300">
          <span className="size-1.5 rounded-full bg-emerald-400" />
          v1.0.1 · MIT licensed
        </span>

        <h1 className="text-balance text-4xl font-bold leading-tight tracking-tight sm:text-6xl">
          Drop a desktop pet
          <br />
          onto any website.
        </h1>

        <p className="mt-6 max-w-2xl text-balance text-lg text-neutral-400 sm:text-xl">
          Petfolio is a Shimeji-style PixiJS companion that walks, crawls,
          jumps, waves, and responds to dragging — all with{" "}
          <span className="text-white">zero configuration</span>. One line of
          code and your page has a mascot.
        </p>

        {/* Install snippet */}
        <div className="mt-10 w-full max-w-xl">
          <div className="overflow-hidden rounded-xl border border-white/10 bg-black/60 text-left shadow-2xl shadow-indigo-500/10">
            <div className="flex items-center justify-between border-b border-white/5 px-4 py-2">
              <div className="flex items-center gap-1.5">
                <span className="size-2.5 rounded-full bg-red-500/70" />
                <span className="size-2.5 rounded-full bg-yellow-500/70" />
                <span className="size-2.5 rounded-full bg-green-500/70" />
              </div>
              <span className="text-xs text-neutral-500">terminal</span>
            </div>
            <pre className="overflow-x-auto px-5 py-4 text-sm leading-relaxed">
              <code>
                <span className="text-neutral-500">$</span>{" "}
                <span className="text-emerald-300">npm install</span>{" "}
                <span className="text-indigo-300">petfolio</span>
              </code>
            </pre>
          </div>
        </div>

        {/* Usage hint */}
        <div className="mt-6 w-full max-w-xl">
          <pre className="overflow-x-auto rounded-xl border border-white/10 bg-black/40 px-5 py-4 text-left text-sm leading-relaxed">
            <code>
              <span className="text-neutral-500">{"// "}</span>
              <span className="text-neutral-500">summon a pet in one line</span>
              {"\n"}
              <span className="text-pink-300">import</span>{" "}
              <span className="text-sky-300">{"{ Petfolio }"}</span>{" "}
              <span className="text-pink-300">from</span>{" "}
              <span className="text-emerald-300">{'"petfolio"'}</span>;{"\n"}
              <span className="text-pink-300">const</span> pet ={" "}
              <span className="text-sky-300">Petfolio</span>.
              <span className="text-yellow-300">summon</span>();
            </code>
          </pre>
        </div>

        {/* CTA buttons */}
        <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
          <a
            href="https://github.com/Andrew-Velox/petfolio"
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-lg bg-[var(--accent)] px-5 py-2.5 text-sm font-medium text-white shadow-lg shadow-indigo-500/25 transition hover:bg-[var(--accent-hover)]"
          >
            Star on GitHub →
          </a>
          <a
            href="https://www.npmjs.com/package/petfolio"
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-lg border border-white/15 bg-white/5 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-white/10"
          >
            View on npm
          </a>
        </div>
      </section>

      {/* Feature grid (tiny) */}
      <section className="mx-auto max-w-6xl px-6 pb-24">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[
            {
              title: "Zero config",
              body: "One import, one line. The pet auto-starts and self-manages.",
            },
            {
              title: "46 sprite frames",
              body: "Idle, walk, crawl, jump, wall-grab, ceiling crawl, and emotes.",
            },
            {
              title: "Draggable & throwable",
              body: "Pick it up, throw it — physics handle the rest.",
            },
            {
              title: "Auto-pilot",
              body: "State-machine driven random behavior. Or take full control.",
            },
            {
              title: "Tiny API",
              body: "summon, changeState, startAuto, stopAuto, destroy. That's it.",
            },
            {
              title: "MIT licensed",
              body: "Use it in any project, commercial or otherwise.",
            },
          ].map((f) => (
            <div
              key={f.title}
              className="rounded-xl border border-white/10 bg-white/5 p-5 transition hover:border-white/20 hover:bg-white/[0.07]"
            >
              <h3 className="text-sm font-semibold text-white">{f.title}</h3>
              <p className="mt-2 text-sm text-neutral-400">{f.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/5">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-6 py-6 text-xs text-neutral-500 sm:flex-row">
          <span>© {new Date().getFullYear()} Petfolio · MIT license</span>
          <span>
            Built with Next.js ·{" "}
            <a
              href="https://github.com/Andrew-Velox/petfolio"
              target="_blank"
              rel="noopener noreferrer"
              className="transition hover:text-white"
            >
              Source on GitHub
            </a>
          </span>
        </div>
      </footer>
    </main>
  );
}