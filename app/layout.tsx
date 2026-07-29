import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "qze的第一个网站",
  description: "qze 的第一个网站。",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
  openGraph: {
    title: "qze的第一个网站",
    description: "qze 的第一个网站。",
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
