import type { Metadata, Viewport } from "next";
import { Cormorant_Garamond, JetBrains_Mono, Lora } from "next/font/google";
import "./globals.css";
import { THEME_INIT_SCRIPT } from "@/components/theme";

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

const SITE_URL = process.env.NEXTAUTH_URL ?? "https://vote.jan-azhidahaka.com";
const SITE_DESCRIPTION = "디스코드 계정으로 로그인하면 이번 거점전 투표에 참여할 수 있습니다.";

/*
 * 디스코드와 카톡에 링크를 올리면 뜨는 미리보기.
 *
 * 투표 링크는 로그인 가드에 걸려 /login 으로 넘어가므로, 미리보기를 만드는
 * 크롤러가 실제로 읽는 것은 로그인 페이지다. 그래서 페이지마다 따로 두지 않고
 * 루트 레이아웃에 한 번만 둔다. 모든 페이지가 이 값을 물려받는다.
 *
 * metadataBase 가 있어야 "/og.jpg" 같은 상대 경로가 절대 주소로 바뀐다.
 * 크롤러는 상대 경로를 읽지 못한다.
 */
export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: "아시바당",
  description: SITE_DESCRIPTION,
  openGraph: {
    type: "website",
    locale: "ko_KR",
    siteName: "아시바당",
    title: "아시바당 거점전 투표",
    description: SITE_DESCRIPTION,
    url: "/vote",
    images: [{ url: "/og.jpg", width: 1200, height: 630, alt: "아시바당 거점전" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "아시바당 거점전 투표",
    description: SITE_DESCRIPTION,
    images: ["/og.jpg"],
  },
};

/* 디스코드 임베드 왼쪽에 그어지는 색 막대. 사이트 강조색과 맞춘다. */
export const viewport: Viewport = {
  themeColor: "#b68235",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="ko"
      suppressHydrationWarning
      className={`${cormorant.variable} ${lora.variable} ${jetbrainsMono.variable}`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
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
          href="https://fonts.googleapis.com/css2?family=Nanum+Myeongjo:wght@400;700&family=Noto+Sans+KR:wght@400;500;700&family=Cinzel:wght@400;600;700&display=swap"
        />
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
