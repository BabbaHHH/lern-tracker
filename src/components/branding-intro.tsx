"use client";

import { useEffect, useRef, useState, type AnimationEvent } from "react";

const SESSION_KEY = "stex-branding-intro-seen-v1";
let claimedInThisDocument = false;

type IntroPhase = "animated" | "hidden";

export function BrandingIntro() {
  const [phase, setPhase] = useState<IntroPhase>("animated");
  const instanceClaimed = useRef(false);

  useEffect(() => {
    const root = document.documentElement;
    let introState = root.dataset.brandingIntro;

    if (introState === "seen") return;
    if (instanceClaimed.current) return;
    instanceClaimed.current = true;

    if (claimedInThisDocument) {
      root.dataset.brandingIntro = "seen";
      return;
    }
    claimedInThisDocument = true;

    if (introState !== "show" && introState !== "untracked" && introState !== "claimed") {
      try {
        if (window.sessionStorage.getItem(SESSION_KEY) === "seen") {
          root.dataset.brandingIntro = "seen";
          return;
        }
        window.sessionStorage.setItem(SESSION_KEY, "seen");
        introState = "show";
      } catch {
        introState = "untracked";
      }

      root.dataset.brandingIntroMode = window.matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "reduced"
        : "animated";
      root.dataset.brandingIntroStartedAt = String(performance.now());
    }

    if (introState === "claimed") return;
    root.dataset.brandingIntro = "claimed";
  }, []);

  useEffect(() => {
    if (phase !== "animated") return;

    const root = document.documentElement;
    if (root.dataset.brandingIntro === "seen") return;

    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const finish = () => setPhase("hidden");
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") finish();
    };
    const handleMotionChange = (event: MediaQueryListEvent) => {
      if (event.matches) finish();
    };

    window.addEventListener("keydown", handleKeyDown);
    media.addEventListener("change", handleMotionChange);
    const reduced = root.dataset.brandingIntroMode === "reduced" || media.matches;
    const duration = reduced ? 2800 : 2000;
    const startedAt = Number(document.documentElement.dataset.brandingIntroStartedAt);
    const elapsed = !reduced && Number.isFinite(startedAt)
      ? Math.max(0, performance.now() - startedAt)
      : 0;
    const timeout = window.setTimeout(finish, Math.max(0, duration - elapsed));

    return () => {
      window.clearTimeout(timeout);
      window.removeEventListener("keydown", handleKeyDown);
      media.removeEventListener("change", handleMotionChange);
    };
  }, [phase]);

  if (phase === "hidden") return null;

  return (
    <div className="branding-intro" role="status" aria-label="NH Studios">
      <div className="branding-intro__frame">
        <div
          className="branding-intro__card branding-intro__card--animated"
          onAnimationEnd={(event: AnimationEvent<HTMLDivElement>) => {
            if (event.animationName === "branding-intro-fade") setPhase("hidden");
          }}
        >
          <h2 className="branding-intro__title">Es wird groß!</h2>
          <p className="branding-intro__studio">NH Studios</p>
        </div>
        <button
          className="branding-intro__close"
          type="button"
          aria-label="Banner schließen"
          onClick={() => setPhase("hidden")}
        >
          ×
        </button>
      </div>
    </div>
  );
}
