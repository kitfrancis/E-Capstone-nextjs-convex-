"use client";

import * as React from "react";
import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";

const THEME_STORAGE_KEY = "theme";
const DARK_CLASS = "dark";
const THEME_CHANGE_EVENT = "app-theme-change";
const EDITOR_WORKSPACE_EVENT = "onlyoffice-workspace-change";
export type AppTheme = "light" | "dark";
let openEditorWorkspaces = 0;

function getSystemTheme() {
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function applyTheme(theme: AppTheme) {
  const root = document.documentElement;
  if (theme === "dark") {
    root.classList.add(DARK_CLASS);
  } else {
    root.classList.remove(DARK_CLASS);
  }
  root.dataset.theme = theme;
  window.dispatchEvent(new CustomEvent<AppTheme>(THEME_CHANGE_EVENT, { detail: theme }));
}

export function applyAppTheme(theme: AppTheme) {
  applyTheme(theme);
}

export function registerEditorWorkspace() {
  openEditorWorkspaces += 1;
  window.dispatchEvent(
    new CustomEvent<boolean>(EDITOR_WORKSPACE_EVENT, { detail: true }),
  );
  return () => {
    openEditorWorkspaces = Math.max(0, openEditorWorkspaces - 1);
    window.dispatchEvent(
      new CustomEvent<boolean>(EDITOR_WORKSPACE_EVENT, {
        detail: openEditorWorkspaces > 0,
      }),
    );
  };
}

export function useAppTheme() {
  const [theme, setTheme] = React.useState<AppTheme>("light");
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    const savedTheme = window.localStorage.getItem(THEME_STORAGE_KEY);
    const resolvedTheme = savedTheme === "dark" || savedTheme === "light" ? savedTheme : getSystemTheme();
    setTheme(resolvedTheme);
    applyTheme(resolvedTheme);
    setMounted(true);

    const syncTheme = (event: Event) => {
      const nextTheme = (event as CustomEvent<AppTheme>).detail;
      if (nextTheme === "light" || nextTheme === "dark") setTheme(nextTheme);
    };
    window.addEventListener(THEME_CHANGE_EVENT, syncTheme);
    return () => window.removeEventListener(THEME_CHANGE_EVENT, syncTheme);
  }, []);

  const handleToggle = () => {
    const nextTheme = theme === "dark" ? "light" : "dark";
    window.localStorage.setItem(THEME_STORAGE_KEY, nextTheme);
    applyTheme(nextTheme);
  };

  return { theme, mounted, toggleTheme: handleToggle };
}

export function ThemeToggle() {
  const { theme, mounted, toggleTheme } = useAppTheme();
  const [editorWorkspaceOpen, setEditorWorkspaceOpen] = React.useState(false);

  React.useEffect(() => {
    setEditorWorkspaceOpen(openEditorWorkspaces > 0);
    const handleWorkspaceChange = (event: Event) => {
      setEditorWorkspaceOpen((event as CustomEvent<boolean>).detail);
    };
    window.addEventListener(EDITOR_WORKSPACE_EVENT, handleWorkspaceChange);
    return () =>
      window.removeEventListener(EDITOR_WORKSPACE_EVENT, handleWorkspaceChange);
  }, []);

  if (!mounted) return null;
  if (editorWorkspaceOpen) return null;

  return (
    <Button
      variant="outline"
      size="icon"
      onClick={toggleTheme}
      aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
      title={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
    >
      <Sun className="h-5 w-5 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
      <Moon className="absolute h-5 w-5 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
      <span className="sr-only">Toggle theme</span>
    </Button>
  );
}