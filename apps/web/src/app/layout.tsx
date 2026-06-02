import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AIDC Carbon Monitor",
  description: "Near-real-time lifecycle carbon monitoring for AI data centers."
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
