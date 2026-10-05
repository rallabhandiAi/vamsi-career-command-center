import type { Metadata } from "next";
import "./globals.css";

// GitHub Pages serves the site under /<repo>, so static asset links need the prefix.
const basePath = process.env.NEXT_PUBLIC_SITE_BASE_PATH ?? "";

export const metadata: Metadata = {
  title: "Vamsi Career Command Center",
  description: "Private career-search intelligence, applications and interview preparation.",
  other: {
    "codex-preview": "development",
  },
  icons: {
    icon: `${basePath}/favicon.svg`,
    shortcut: `${basePath}/favicon.svg`,
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
