import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "我的学习小站",
  description: "把生活与知识折进自己的时间册。",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
  openGraph: {
    title: "我的学习小站",
    description: "把生活与知识折进自己的时间册。",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
