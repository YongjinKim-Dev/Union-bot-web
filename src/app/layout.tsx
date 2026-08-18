import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "아시바당 거점전 투표",
  description: "거점전 참여 투표",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
