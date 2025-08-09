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
  // 你的站点主域名（便于生成绝对URL、canonical等）
  metadataBase: new URL("https://doctoral-application-readiness-calc.top"),

  // 更丰富的标题设置（可选）
  title: {
    default: "PhD Readiness Score",
    template: "%s | PhD Readiness Score",
  },
  description: "Interactive 0–10 rubric for PhD application readiness.",

  // 搜索引擎站点验证（你给的 token 已填写）
  verification: {
    google: "67Mp7Fny2XC3s23GQznzv9F3NWIqwIW1QBs4cU5CpJg",
    bing: "C850AA3E0866390AF697D64E3BE5264C",
    // 如果后续接入百度，可这样加：
    // other: { "baidu-site-verification": "你的百度验证字符串" },
  },

  // 生成 canonical（有助于收录）
  alternates: {
    canonical: "/",
  },

  // robots 建议（允许收录）
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
    },
  },

  // 简单的 Open Graph（分享卡片信息）
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
      {/* 把字体变量挂到 body 上，避免未使用 */}
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        {children}
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}

