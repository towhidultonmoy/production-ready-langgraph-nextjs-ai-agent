import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Ally - Your AI Agent",
  description: "Your AI Agent",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=0" />
      <body>{children}</body>
    </html>
  );
}