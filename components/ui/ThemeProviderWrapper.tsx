"use client";

import { useEffect, type ReactNode } from "react";

const THEME_STORAGE_KEY = "theme";
const DARK_CLASS = "dark";

function getSystemTheme() {
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function applyTheme(theme: string) {
  const root = document.documentElement;
  if (theme === "dark") {
    root.classList.add(DARK_CLASS);
  } else {
    root.classList.remove(DARK_CLASS);
  }
  root.dataset.theme = theme;
}

export default function ThemeProviderWrapper({ children }: { children: ReactNode }) {
  useEffect(() => {
    const savedTheme = window.localStorage.getItem(THEME_STORAGE_KEY);
    const theme = savedTheme === "dark" || savedTheme === "light" ? savedTheme : getSystemTheme();
    applyTheme(theme);
  }, []);

  return <>{children}</>;
}
