import type { Metadata } from "next";
import { Geist, Geist_Mono, Noto_Sans, Poppins } from "next/font/google";
import "./globals.css";
import { cn } from "@/lib/utils";

// Headings use Poppins (geometric bold sans) to match the dark salon look.
const poppinsHeading = Poppins({
  subsets: ["latin"],
  weight: ["500", "600", "700", "800"],
  variable: "--font-heading",
});

const notoSans = Noto_Sans({subsets:['latin'],variable:'--font-sans'});

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Renzo — Hair & Beauty Studio",
  description: "Book haircuts, styling, colour and spa treatments at Renzo.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={cn("h-full", "antialiased", geistSans.variable, geistMono.variable, "font-sans", notoSans.variable, poppinsHeading.variable)}
    >
      <body className="min-h-full flex flex-col" suppressHydrationWarning>{children}</body>
    </html>
  );
}
