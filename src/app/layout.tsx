import type { Metadata } from "next";
import { Inter, Permanent_Marker } from "next/font/google";
import "./globals.css";

const inter = Inter({ variable: "--font-inter", subsets: ["latin"] });
const marker = Permanent_Marker({ variable: "--font-marker", subsets: ["latin"], weight: "400" });

export const metadata: Metadata = {
  title: "Painel SkateGo",
  description: "Moderação, contas e anúncios do SkateGo.",
  robots: { index: false, follow: false },
  icons: { icon: "/logo.png" },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="pt-BR" className={`${inter.variable} ${marker.variable} h-full antialiased`}>
      <body className="min-h-full">{children}</body>
    </html>
  );
}
