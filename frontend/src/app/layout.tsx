import type { Metadata, Viewport } from "next";
import { Inter, Outfit, Playfair_Display } from "next/font/google";
import "./globals.css";
import { QueryProvider } from "@/providers/QueryProvider";

// ─────────────────────────────────────────────────────────────────────────────
// Fonts
// ─────────────────────────────────────────────────────────────────────────────
const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const outfit = Outfit({
  subsets: ["latin"],
  variable: "--font-outfit",
  display: "swap",
});

const playfair = Playfair_Display({
  subsets: ["latin"],
  variable: "--font-playfair",
  display: "swap",
  weight: ["400", "600", "700", "800", "900"],
});

// ─────────────────────────────────────────────────────────────────────────────
// Metadata
// ─────────────────────────────────────────────────────────────────────────────
export const metadata: Metadata = {
  title: {
    default: "Smart Dining — AI-Powered Restaurant Assistant",
    template: "%s | Smart Dining",
  },
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "SpiceGarden",
  },
  description:
    "Experience the future of dining with AI-powered menu recommendations, seamless ordering, and real-time kitchen tracking.",
  keywords: [
    "smart dining",
    "AI restaurant",
    "menu recommendations",
    "food ordering",
    "digital menu",
  ],
  authors: [{ name: "Smart Dining" }],
  openGraph: {
    type: "website",
    locale: "en_IN",
    title: "Smart Dining — AI-Powered Restaurant Assistant",
    description:
      "Experience the future of dining with AI-powered menu recommendations.",
    siteName: "Smart Dining",
  },
  twitter: {
    card: "summary_large_image",
    title: "Smart Dining — AI-Powered Restaurant Assistant",
    description:
      "Experience the future of dining with AI-powered menu recommendations.",
  },
};

export const viewport: Viewport = {
  themeColor: "#10b981",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

// ─────────────────────────────────────────────────────────────────────────────
// Root Layout
// ─────────────────────────────────────────────────────────────────────────────
import { ToastProvider } from "@/components/ToastProvider";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.variable} ${outfit.variable} ${playfair.variable} antialiased`}>
        <QueryProvider>
          {children}
          <ToastProvider />
        </QueryProvider>
      </body>
    </html>
  );
}
