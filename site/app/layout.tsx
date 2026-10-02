import type { Metadata } from "next";
import { Nunito } from "next/font/google";
import "./globals.css";
import PetfolioMount from "./components/PetfolioMount";

const nunito = Nunito({
  subsets: ["latin"],
  weight: ["400", "600", "700", "800", "900"],
  variable: "--font-nunito",
});

export const metadata: Metadata = {
  title: "Petfolio — A tiny friend for every website",
  description:
    "A Shimeji-style PixiJS companion that walks, climbs, jumps and chats about your site — one line of code.",
  openGraph: {
    title: "Petfolio",
    description: "A tiny friend for every website. One line of code.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={nunito.variable}>
      <body>{children}<PetfolioMount /></body>
    </html>
  );
}
