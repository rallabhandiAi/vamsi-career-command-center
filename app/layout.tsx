import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Vamsi Career Command Center",
  description: "Private career-search intelligence, applications and interview preparation.",
  other: {
    "codex-preview": "development",
  },
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
  robots: {
    index: false,
    follow: false,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
