"use client";

import { useRouter } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useEffect } from "react";
import { dashboardRouteForRole } from "@/lib/dashboard-routes";
import {
  GraduationCap,
  UserCheck,
  Presentation,
  Building2,
  ClipboardCheck,
  ArrowRight,
} from "lucide-react";

type Role = "student" | "instructor" | "adviser" | "admin" | "coordinator";

const ROLES: {
  role: Role;
  title: string;
  description: string;
  cta: string;
  Icon: typeof GraduationCap;
  tile: string;
  iconColor: string;
  accent: string;
  span: string;
}[] = [
  {
    role: "student",
    title: "Student",
    description: "Submit research outputs and keep every milestone on track.",
    cta: "Continue as Student",
    Icon: GraduationCap,
    tile: "bg-violet-100 dark:bg-violet-950",
    iconColor: "text-violet-700 dark:text-violet-300",
    accent: "text-violet-800 dark:text-violet-300",
    span: "lg:col-span-2",
  },
  {
    role: "adviser",
    title: "Thesis Adviser",
    description: "Guide researchers, review work, and share timely feedback.",
    cta: "Continue as Thesis Adviser",
    Icon: UserCheck,
    tile: "bg-emerald-100 dark:bg-emerald-950",
    iconColor: "text-emerald-700 dark:text-emerald-300",
    accent: "text-violet-800 dark:text-violet-300",
    span: "lg:col-span-2",
  },
  {
    role: "instructor",
    title: "Subject Instructor",
    description: "Manage classes, assign deliverables, and monitor teams.",
    cta: "Continue as Subject Instructor",
    Icon: Presentation,
    tile: "bg-purple-100 dark:bg-purple-950",
    iconColor: "text-purple-700 dark:text-purple-300",
    accent: "text-violet-800 dark:text-violet-300",
    span: "lg:col-span-2",
  },
  {
    // Program Head = admin
    role: "admin",
    title: "Program Head/admin",
    description:
      "Oversee program performance, faculty, and research progress.",
    cta: "Continue as Program Head",
    Icon: Building2,
    tile: "bg-amber-100 dark:bg-amber-950",
    iconColor: "text-amber-700 dark:text-amber-300",
    accent: "text-violet-800 dark:text-violet-300",
    span: "lg:col-span-3",
  },
  {
    role: "coordinator",
    title: "Research Coordinator",
    description: "Coordinate studies, compliance, schedules, and reporting.",
    cta: "Sign in or request access",
    Icon: ClipboardCheck,
    tile: "bg-rose-100 dark:bg-rose-950",
    iconColor: "text-rose-700 dark:text-rose-300",
    accent: "text-violet-800 dark:text-violet-300",
    span: "lg:col-span-3",
  },
];

export default function LandingPage() {
  const router = useRouter();
  const { isSignedIn, isLoaded } = useUser();
  const me = useQuery(api.users.getMe);

  useEffect(() => {
    if (!isLoaded) return;
    if (isSignedIn && me && me.role) {
      router.replace(
        me.mustChangePassword
          ? "/change-password"
          : me.status === "pending"
            ? "/pending-approval"
            : dashboardRouteForRole(me.role)
      );
    }
  }, [isLoaded, isSignedIn, me, router]);

  const handleClick = (role: Role) => {
    if (typeof window !== "undefined") {
      sessionStorage.setItem("intendedRole", role);
    }
    router.push(`/sign-in?role=${role}`);
  };

  if (!isLoaded) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white dark:bg-slate-950">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-violet-600" />
      </div>
    );
  }

  return (
    <div className="font-Poppins relative flex min-h-screen flex-col overflow-hidden bg-white text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      {/* Background: campus photo */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-cover bg-center bg-no-repeat opacity-70 dark:opacity-25"
        style={{ backgroundImage: "url('/ccisbuilding.jpg')" }}
      />
      {/* Fade from page color (left) to transparent (right) */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-linear-to-r from-white via-white/70 to-violet-200/20 dark:from-slate-950 dark:via-slate-950/85 dark:to-slate-950/40"
      />
      {/* Soft purple fade at the bottom */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 bottom-0 h-56 bg-linear-to-t from-violet-200/70 to-transparent dark:from-violet-950/60"
      />

      {/* Header */}
      <header className="relative z-10 border-b border-slate-200/70 bg-white/90 backdrop-blur-sm dark:border-slate-800 dark:bg-slate-950/80">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-4 sm:px-6 lg:px-10">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-700 shadow-lg shadow-violet-700/30">
              <GraduationCap className="h-5 w-5 text-white" />
            </div>
            <div className="leading-tight">
              <p className="text-[10px] font-medium uppercase tracking-[0.25em] text-slate-500 dark:text-slate-400">
                Academic Portal
              </p>
              <p className="text-xl font-bold text-slate-900 dark:text-white">
                E-Research
              </p>
            </div>
          </div>

          
        </div>
      </header>

      {/* Hero */}
      <main className="relative z-10 flex-1">
        <div className="mx-auto grid max-w-7xl items-center gap-10 px-4 py-10 sm:px-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)] lg:gap-10 lg:px-10 lg:py-14">
          {/* Left: copy */}
          <div>
            <span className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white/90 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-violet-800 shadow-sm dark:border-slate-700 dark:bg-slate-900 dark:text-violet-300">
              <span className="h-2 w-2 rounded-full bg-violet-600" />
              Integrated Research Management
            </span>

            <h1 className="mt-8 text-5xl font-extrabold leading-[1.02] tracking-tight sm:text-6xl xl:text-7xl">
              <span className="block text-violet-950 dark:text-white">
                Research,
              </span>
              <span className="block text-violet-600 dark:text-violet-400">
                made clearer.
              </span>
            </h1>

            <p className="mt-6 max-w-md text-base text-slate-600 dark:text-slate-300 sm:text-lg">
              One secure space to guide every study—from the first proposal to
              the final defense.
            </p>

            <div className="mt-8 flex items-center gap-4 text-sm font-medium text-slate-800 dark:text-slate-200">
              <span className="h-px w-12 bg-violet-700 dark:bg-violet-400" />
              Select your role to continue
            </div>
          </div>

          {/* Right: role cards */}
          <section>
            <div className="mb-4 flex items-end justify-between gap-4">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-600 dark:text-slate-400">
                  Portal Access
                </p>
                <h2 className="mt-1 text-2xl font-bold text-slate-900 dark:text-white sm:text-3xl">
                  How are you signing in?
                </h2>
              </div>
              <span className="shrink-0 rounded-full bg-slate-900 px-3 py-1 text-xs font-semibold text-white dark:bg-slate-100 dark:text-slate-900">
                {ROLES.length} user portals
              </span>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-6">
              {ROLES.map(
                ({
                  role,
                  title,
                  description,
                  cta,
                  Icon,
                  tile,
                  iconColor,
                  accent,
                  span,
                }) => (
                  <button
                    key={role}
                    type="button"
                    onClick={() => handleClick(role)}
                    className={`group flex flex-col rounded-3xl border border-white/80 bg-white/95 p-5 text-left shadow-xl shadow-slate-900/10 backdrop-blur transition-all hover:-translate-y-0.5 hover:shadow-2xl focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-600 dark:border-slate-800 dark:bg-slate-900/90 dark:shadow-black/40 ${span}`}
                  >
                    <div
                      className={`flex h-11 w-11 items-center justify-center rounded-xl ${tile}`}
                    >
                      <Icon className={`h-5 w-5 ${iconColor}`} />
                    </div>

                    <h3 className="mt-5 text-lg font-bold text-slate-900 dark:text-white">
                      {title}
                    </h3>
                    <p className="mt-1 flex-1 text-sm leading-snug text-slate-600 dark:text-slate-300">
                      {description}
                    </p>

                    <div className="mt-4 flex items-center justify-between gap-3 border-t border-slate-200 pt-3 dark:border-slate-700">
                      <span className={`text-sm font-semibold ${accent}`}>
                        {cta}
                      </span>
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-violet-100 text-violet-800 transition-colors group-hover:bg-violet-700 group-hover:text-white dark:bg-violet-950 dark:text-violet-300">
                        <ArrowRight className="h-4 w-4" />
                      </span>
                    </div>
                  </button>
                )
              )}
            </div>
          </section>
        </div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 px-4 pb-6 pt-2 text-center text-xs text-slate-700 dark:text-slate-400">
        <p>Authorized users only · Your access is protected and role-based</p>
        <p className="mt-1 text-slate-500 dark:text-slate-500">
          &copy; 2026 Thesis Management System. Developed by Kit Francis Besa,
          Carl Andrei Diomon, Stephen Gabarda and Kyle Steven Morillo.
        </p>
      </footer>
    </div>
  );
}