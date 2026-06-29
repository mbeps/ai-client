import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

/**
 * Default SEO metadata shared across all routes.
 */
export const metadata: Metadata = {
  title: "AI Chat Client",
  description:
    "AI chat client with support for streaming, tools and knowledge bases.",
};

import { TooltipProvider } from "@/components/ui/tooltip";
import { PopoverProvider } from "@/components/ui/popover";
import { NuqsAdapter } from "nuqs/adapters/next/app";

/**
 * Root layout providing global fonts (Geist), CSS, and UI providers.
 * Establishes the HTML scaffold, theme context, and toast notification system for all routes.
 * Public route — no authentication required.
 *
 * @param children - Page content rendered within the layout.
 * @author Maruf Bepary
 * @see {@link AuthenticatedLayout} for auth-protected routes.
 */
export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <TooltipProvider>
          <PopoverProvider>
            <NuqsAdapter>
              {children}
              <Toaster position="bottom-right" />
            </NuqsAdapter>
          </PopoverProvider>
        </TooltipProvider>
      </body>
    </html>
  );
}
