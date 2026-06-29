import type { Metadata } from "next";
import { Inter, Space_Grotesk, Cinzel_Decorative } from "next/font/google";
import "./globals.css";
import Navbar from "./components/Navbar";
import MobileTabBar from "./components/MobileTabBar";
import ClientProviders from "./components/ClientProviders";
import MobileAppPromoFab from "./components/MobileAppPromoFab";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

const spaceGrotesk = Space_Grotesk({
  variable: "--font-space",
  subsets: ["latin"],
  display: "swap",
});

const cinzel = Cinzel_Decorative({
  weight: ["400", "700", "900"],
  variable: "--font-cinzel",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "PureVerse — Stream Movies, Series & Anime",
  description:
    "PureVerse is a premium, cross-platform streaming hub for movies, TV series, and anime. Discover trending content, track your watchlist, and enjoy seamless playback.",
  keywords: ["streaming", "movies", "anime", "series", "pureverse", "aniverse"],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${inter.variable} ${spaceGrotesk.variable} ${cinzel.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-[var(--bg-primary)]">
        <ClientProviders>
          <div className="flex-1 flex flex-col min-h-screen pb-[60px] lg:pb-0">
            <Navbar />
            {children}
          </div>
          <MobileAppPromoFab />
          <MobileTabBar />
        </ClientProviders>
      </body>
    </html>
  );
}
