import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "DengueSpot · Safer neighborhoods",
  description:
    "Report suspected mosquito breeding conditions and follow community cleanup in Bangladesh.",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "DengueSpot",
    statusBarStyle: "default",
  },
  icons: { icon: "/icon.svg", apple: "/icon-192.png" },
};
export const viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#087e75",
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="bn-BD">
      <body>{children}</body>
    </html>
  );
}
