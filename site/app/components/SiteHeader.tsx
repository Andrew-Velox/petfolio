import Link from "next/link";
import { asset } from "../lib/asset";
import { GITHUB, NPM } from "../lib/links";

const linkClass = "rounded-full px-3 py-2 transition hover:text-foreground";

/** Top bar shared by every page. On the home page the section links are in-page anchors. */
export default function SiteHeader({ home = false }: { home?: boolean }) {
  const prefix = home ? "" : "/";
  return (
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
          <Link href={`${prefix}#features`} className={`hidden sm:block ${linkClass}`}>
            Features
          </Link>
          <Link href={`${prefix}#how`} className={`hidden sm:block ${linkClass}`}>
            How it works
          </Link>
          <Link href="/avatars/" className={linkClass}>
            Avatars
          </Link>
          <a href={GITHUB} target="_blank" rel="noopener noreferrer" className={linkClass}>
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
  );
}
