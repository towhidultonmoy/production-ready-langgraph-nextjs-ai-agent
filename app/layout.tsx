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
      <body>{children}</body>
    </html>
  );
}