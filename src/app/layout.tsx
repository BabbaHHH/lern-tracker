import type { Metadata, Viewport } from "next";
import Script from "next/script";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeBootstrap } from "@/components/theme-bootstrap";
import { QuotaBanner } from "@/components/quota-banner";
import { FeedbackWidget } from "@/components/feedback-widget";
import { BrandingIntro } from "@/components/branding-intro";
import { testReferenceDate } from "@/lib/dates";
import { AccountLearningBoundary } from "@/components/account-learning-boundary";
import "./globals.css";
import "@/components/branding-intro.css";

const BRANDING_INTRO_SESSION_KEY = "stex-branding-intro-seen-v1";
const BRANDING_INTRO_BOOTSTRAP = `(() => {
  const root = document.documentElement;
  try {
    if (window.sessionStorage.getItem("${BRANDING_INTRO_SESSION_KEY}") === "seen") {
      root.dataset.brandingIntro = "seen";
      return;
    }
    window.sessionStorage.setItem("${BRANDING_INTRO_SESSION_KEY}", "seen");
    root.dataset.brandingIntro = "show";
  } catch {
    root.dataset.brandingIntro = "untracked";
  }

  root.dataset.brandingIntroMode = window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ? "reduced"
    : "animated";
  root.dataset.brandingIntroStartedAt = String(performance.now());
})();`;

export const metadata: Metadata = {
  title: "Stex Tracker — 2. Staatsexamen",
  description: "Intelligenter Lernfortschritts-Tracker für das 2. juristische Staatsexamen",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const accountMode = process.env.STEX_LEARNING_MODE === "account";
  return (
    <html
      lang="de"
      data-theme="indigo"
      suppressHydrationWarning
      className="h-full antialiased"
    >
      <body className="min-h-full flex flex-col bg-white">
        <Script id="branding-intro-bootstrap" strategy="beforeInteractive">
          {BRANDING_INTRO_BOOTSTRAP}
        </Script>
        <BrandingIntro />
        {!accountMode && <ThemeBootstrap />}
        {testReferenceDate() && <div role="status" className="bg-amber-100 px-4 py-2 text-center text-sm text-amber-950">Lokaler Testmodus · Planungsdatum {testReferenceDate()} · Separates Testprofil</div>}
        <TooltipProvider><AccountLearningBoundary accountMode={accountMode}>{children}</AccountLearningBoundary></TooltipProvider>
        {!accountMode && <><QuotaBanner /><FeedbackWidget /></>}
      </body>
    </html>
  );
}
