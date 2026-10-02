/** Prefix a /public path with the site's base path (needed on GitHub Pages project sites). */
export const asset = (path: string) => `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}${path}`;
