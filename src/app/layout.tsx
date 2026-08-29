import type { Metadata } from "next";
import { Cormorant_Garamond, JetBrains_Mono, Lora } from "next/font/google";
import "./globals.css";

const cormorant = Cormorant_Garamond({
  variable: "--font-cormorant",
  subsets: ["latin"],
  weight: ["400", "600"],
  display: "swap",
});

const lora = Lora({
  variable: "--font-lora",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "아시바당",
  description: "거점전 투표와 연맹 정보",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="ko"
      className={`${cormorant.variable} ${lora.variable} ${jetbrainsMono.variable}`}
    >
      <head>
        {/*
          Nanum Myeongjo loads from Google's CDN rather than next/font.
          next/font types this family for "latin" only, and omitting `subsets`
          to keep the Hangul ranges makes it pull ~100 subset files at build
          time — one flaky fetch there fails the whole production build (seen
          ~1 run in 5), which would make Docker deploys unreliable. Loading it
          at runtime degrades to a fallback serif instead of breaking the build.

          These sit in an explicit <head>: a <link> rendered as a direct child
          of <html> is invalid markup and trips a hydration error.
          Noto Sans KR rides along on the same request: 명조 is beautiful for
          headings and prose but its thin strokes smear below ~13px on Windows,
          so small UI chrome uses the sans instead. Both variables are declared
          in globals.css.
        */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        {/* eslint-disable-next-line @next/next/no-page-custom-font -- that rule targets the Pages Router; in the App Router the root layout is the every-page equivalent of pages/_document. */}
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Nanum+Myeongjo:wght@400;700&family=Noto+Sans+KR:wght@400;500;700&display=swap"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
