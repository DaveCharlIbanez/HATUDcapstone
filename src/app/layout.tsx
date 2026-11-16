import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { AppShell } from "@/components/AppShell";
import HeaderClient from "@/components/HeaderClient";
import { RouteGuard } from "@/components/RouteGuard";
import { ToastProvider } from "@/components/Toast";
import { AuthProvider } from "@/lib/authContext";
import { ConvexProvider } from "@/lib/convexClient";
import { BOTTOM_NAV_HEIGHT, BOTTOM_NAV_HEIGHT_VAR } from "@/lib/layout";
import { ThemeProvider } from "@/lib/themeContext";
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
      <body
        className={`${geist.variable} ${geistMono.variable}`}
        style={
          {
            [BOTTOM_NAV_HEIGHT_VAR]: `${BOTTOM_NAV_HEIGHT}px`,
          } as React.CSSProperties
        }
      >
        <ConvexProvider>
          <AuthProvider>
            <ThemeProvider>
              <ToastProvider>
                <div className="min-h-screen bg-[var(--background)] text-[var(--foreground)] transition-colors duration-200">
                  {/* The header carries the menu button, so it has to be
                      inside the shell that owns the drawer. */}
                  <AppShell>
                    <HeaderClient />
                    <main>
                      <RouteGuard>{children}</RouteGuard>
                    </main>
                  </AppShell>
                </div>
              </ToastProvider>
            </ThemeProvider>
          </AuthProvider>
        </ConvexProvider>
      </body>
    </html>
  );
}
