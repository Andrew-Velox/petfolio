/**
 * Normal build (Vercel, `next start`): a regular Next.js server, so the
 * /api/petfolio chat route works.
 *
 * GitHub Pages build (GITHUB_PAGES=true, see .github/workflows/pages.yml):
 * a fully static export in ./out. Pages can't run server code, so the workflow
 * removes app/api, and the chat is either hidden or pointed at a server hosted
 * elsewhere (NEXT_PUBLIC_PETFOLIO_ENDPOINT).
 */
const isPages = process.env.GITHUB_PAGES === "true";

// A project page lives under /<repo>; a user page or custom domain lives at the root ("/" = no prefix).
const rawBase = isPages ? (process.env.NEXT_PUBLIC_BASE_PATH ?? "") : "";
const basePath = rawBase === "/" ? "" : rawBase.replace(/\/$/, "");

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  ...(isPages && {
    output: "export",
    trailingSlash: true,
    images: { unoptimized: true },
  }),
  ...(basePath && { basePath }),
  env: {
    NEXT_PUBLIC_BASE_PATH: basePath,
    ...(isPages && { NEXT_PUBLIC_STATIC_EXPORT: "1" }),
  },
};

export default nextConfig;
