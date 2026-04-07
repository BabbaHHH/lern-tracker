import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Inter, Newsreader } from "next/font/google";
import { TooltipProvider } from "@/components/ui/tooltip";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const newsreader = Newsreader({
  variable: "--font-newsreader",
  subsets: ["latin"],
  style: ["normal", "italic"],
});

export const metadata: Metadata = {
  title: "Stex Tracker — 2. Staatsexamen",
  description: "Intelligenter Lernfortschritts-Tracker für das 2. juristische Staatsexamen",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="de"
      className={`${geistSans.variable} ${geistMono.variable} ${inter.variable} ${newsreader.variable} h-full antialiased`}
    >
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('lerntracker-theme');if(t){document.documentElement.dataset.theme=JSON.parse(t);}else{document.documentElement.dataset.theme='indigo';}}catch(e){document.documentElement.dataset.theme='indigo';}})();`,
          }}
        />
      </head>
      <body className="min-h-full flex flex-col bg-white">
        <TooltipProvider>{children}</TooltipProvider>
      </body>
    </html>
  );
}
