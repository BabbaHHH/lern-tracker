"use client";

import { useEffect } from "react";
import { getTheme } from "@/lib/store";

export function ThemeBootstrap() {
  useEffect(() => {
    try {
      document.documentElement.dataset.theme = getTheme();
    } catch {
      document.documentElement.dataset.theme = "indigo";
    }
  }, []);
  return null;
}
