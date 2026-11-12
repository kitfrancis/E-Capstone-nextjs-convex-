"use client";

import { useEffect, type ReactNode } from "react";
import { applyAppTheme } from "./theme-provider";

function getSystemTheme() {
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export default function ThemeProviderWrapper({ children }: { children: ReactNode }) {
  useEffect(() => {
    const THEME_STORAGE_KEY = "theme";
    const savedTheme = window.localStorage.getItem(THEME_STORAGE_KEY);
    const theme = savedTheme === "dark" || savedTheme === "light" ? savedTheme : getSystemTheme();
    applyAppTheme(theme);
  }, []);

  return <>{children}</>;
}
