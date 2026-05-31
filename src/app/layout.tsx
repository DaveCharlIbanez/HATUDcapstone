import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import HeaderClient from "@/components/HeaderClient";
import { ToastProvider } from "@/components/Toast";
import { AuthProvider } from "@/lib/authContext";
import { ConvexProvider } from "@/lib/convexClient";
import "./globals.css";

const geist = Geist({
  subsets: ["latin"],
  variable: "--font-geist-sans",
});

const geistMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-geist-mono",
});

export const metadata: Metadata = {
  title: "Hatud",
  description: "Ride-hailing app for Antiquenos",
  icons: [{ rel: "icon", url: "/favicon.ico" }],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${geist.variable} ${geistMono.variable}`}>
        <ConvexProvider>
          <AuthProvider>
            <ToastProvider>
              <div className="min-h-screen bg-[var(--background)] text-[var(--foreground)] transition-colors duration-200">
                <HeaderClient />
                <main>{children}</main>
              </div>
            </ToastProvider>
          </AuthProvider>
        </ConvexProvider>
      </body>
    </html>
  );
}
