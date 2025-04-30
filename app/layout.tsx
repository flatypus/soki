import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { ThemeProvider } from "@/components/theme-provider"; // Import ThemeProvider

const inter = Inter({ subsets: ["latin"] });

// Define metadata
export const metadata: Metadata = {
  title: "Soki - Kanji & Phrase SRS",
  description: "Learn Japanese Kanji and Phrases efficiently with this Spaced Repetition System (SRS) flashcard app.",
  openGraph: {
    title: "Soki - Kanji & Phrase SRS",
    description: "Master Japanese Kanji and vocabulary with Soki, an intuitive SRS flashcard application.",
    url: "https://soki.example.com", // Replace with actual deployment URL later
    siteName: "Soki SRS",
    // Add an image URL later if available
    // images: [
    //   {
    //     url: "https://soki.example.com/og-image.png", // Replace with actual image URL
    //     width: 1200,
    //     height: 630,
    //   },
    // ],
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Soki - Kanji & Phrase SRS",
    description: "Learn Japanese Kanji and Phrases efficiently with Soki SRS.",
    // Add Twitter image URL later if available
    // images: ["https://soki.example.com/twitter-image.png"], // Replace with actual image URL
  },
  // Add theme color, manifest link etc. if needed
  // themeColor: "#ffffff",
  // manifest: "/manifest.json",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning> {/* Add suppressHydrationWarning for theme provider */}
      <body className={inter.className}>
        <ThemeProvider
            attribute="class"
            defaultTheme="system"
            enableSystem
            disableTransitionOnChange
          >
          {children}
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  );
}

