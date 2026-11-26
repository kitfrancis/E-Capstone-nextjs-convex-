"use client";

import { useRouter } from "next/navigation";
import { useClerk } from "@clerk/nextjs";
import { useTheme } from "next-themes";
import { ArrowRight, Lock, Moon, Shield, Sun } from "lucide-react";

export default function Unauthorized() {
  const router = useRouter();
  const { signOut } = useClerk();
  const { resolvedTheme, setTheme } = useTheme();

  const handleBack = async () => {
    await signOut();
    router.push("/");
  };

  return (
    <div className="relative flex h-screen items-center justify-center overflow-hidden bg-background">
      {/* Faded campus background (swap the path for your image) */}
      <div
        className="absolute inset-0 bg-cover bg-center opacity-10"
        style={{ backgroundImage: "url('/campus.jpg')" }}
      />
      <div className="absolute inset-0 bg-gradient-to-b from-background/60 via-background/80 to-background" />

      {/* Theme toggle */}
      <button
        type="button"
        aria-label="Toggle theme"
        onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
        className="absolute right-6 top-6 z-10 flex h-10 w-10 items-center justify-center rounded-xl border bg-background/80 shadow-sm backdrop-blur transition hover:bg-muted"
      >
        <Moon className="h-4 w-4 dark:hidden" />
        <Sun className="hidden h-4 w-4 dark:block" />
      </button>

      <div className="relative z-10 flex max-w-md flex-col items-center px-6 text-center">
        {/* Icon */}
        <div className="relative mb-6 flex h-14 w-14 items-center justify-center rounded-2xl border border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-500/30 dark:bg-violet-500/10 dark:text-violet-300">
          <Shield className="h-6 w-6" />
          <Lock className="absolute h-2.5 w-2.5" />
        </div>

        {/* Badge */}
        <span className="mb-5 inline-flex items-center gap-2 rounded-full border bg-background/80 px-3 py-1 text-[11px] font-semibold uppercase tracking-widest text-violet-700 dark:text-violet-300">
          <span className="h-1.5 w-1.5 rounded-full bg-violet-600" />
          Error 401 — Unauthorized
        </span>

        {/* Heading */}
        <h1 className="text-5xl font-extrabold leading-tight tracking-tight text-foreground">
          <span className="text-violet-700 dark:text-violet-400">401</span> —
          <br />
          Unauthorized
        </h1>

        <p className="mt-5 text-base leading-relaxed text-muted-foreground">
          You do not have permission to access this page, or your role session is
          invalid. Please return to the portal and sign in with an authorized
          account.
        </p>

        {/* Actions */}
        <button
          type="button"
          onClick={handleBack}
          className="mt-8 inline-flex items-center gap-3 rounded-full bg-violet-700 py-3 pl-6 pr-3 text-sm font-semibold text-white shadow-lg shadow-violet-700/30 transition hover:bg-violet-800"
        >
          Back to Landing Page
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white/20">
            <ArrowRight className="h-4 w-4" />
          </span>
        </button>

        <button
          type="button"
          onClick={handleBack}
          className="mt-5 text-sm text-muted-foreground transition hover:text-foreground"
        >
          Switch Role
        </button>
      </div>
    </div>
  );
}