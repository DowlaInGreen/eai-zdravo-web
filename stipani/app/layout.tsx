import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Stipani", template: "%s · Stipani" },
  description: "Stipani — naš zajednički pregled dana. Jedan dom. Jedan pregled. Isti smjer.",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = { themeColor: "#faf6ef", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="hr">
      <body>{children}</body>
    </html>
  );
}
