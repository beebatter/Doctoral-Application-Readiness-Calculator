import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  // 主域名（便于生成绝对URL、canonical等）
  metadataBase: new URL("https://doctoral-application-readiness-calc.top"),

  // 标题与描述
  title: {
    default: "PhD Readiness Score",
    template: "%s | PhD Readiness Score",
  },
  description: "Interactive 0–10 rubric for PhD application readiness.",

  // 搜索引擎站点验证
  verification: {
    google: "aCvitL2FdmB2CFVbwWkLIjFWnLH0MvnZH5s-nm48TQU",
    other: {
      "msvalidate.01": "C850AA3E0866309AF697D64E3EE5264C", // Bing
      "baidu-site-verification": "codeva-m88WZWLgpO",          // 百度
    },
  },

  // canonical
  alternates: {
    canonical: "/",
  },

  // robots
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
    },
  },

  // Open Graph
  openGraph: {
    title: "PhD Readiness Score",
    description:
      "Evaluate your PhD application readiness with a unified 0–10 rubric.",
    url: "https://doctoral-application-readiness-calc.top",
    siteName: "PhD Readiness Score",
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
      {/* 应用字体变量 */}
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        {children}
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
