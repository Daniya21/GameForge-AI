import type { Metadata } from "next";
import AppPreloader from "./components/AppPreloader";
import Navbar from "./components/Navbar";
import "./globals.css";

export const metadata: Metadata = {
  title: "GameForge AI — Game Pre-Production Studio",
  description: "Transform scattered game ideas into a connected, validated, documented, and development-ready pre-production plan.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className="h-full antialiased" data-gf-ready="false" suppressHydrationWarning>
      <body className="min-h-full bg-zinc-950 text-white">
        <AppPreloader />
        <div className="gf-app-shell">
          <Navbar />
          {children}
        </div>
        <noscript><style>{`.gf-app-shell{opacity:1!important;visibility:visible!important;transform:none!important}`}</style></noscript>
      </body>
    </html>
  );
}
