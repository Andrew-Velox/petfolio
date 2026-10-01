import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Petfolio — Drop-in animated desktop pet for any website",
  description:
    "A Shimeji-style PixiJS companion that walks, crawls, jumps, waves, and responds to dragging — all with zero configuration.",
  openGraph: {
    title: "Petfolio",
    description:
      "Drop-in animated desktop pet for any website. Zero config.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}