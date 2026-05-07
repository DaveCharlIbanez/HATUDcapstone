import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import HeaderClient from "@/src/components/HeaderClient";
import { ConvexProvider } from "@/src/lib/convexClient";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Hatud Dashboard",
  description: "Hatud admin and operator dashboard",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <ConvexProvider>
          <div className="min-h-screen bg-[var(--background)] text-[var(--foreground)] transition-colors duration-200">
            <HeaderClient />
            <main>{children}</main>
          </div>
        </ConvexProvider>
      </body>
    </html>
  );
}
