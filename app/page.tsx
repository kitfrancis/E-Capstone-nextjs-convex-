"use client";

import { useRouter } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useEffect } from "react";
import {
  User,
  GraduationCap,
  UserCheck,
  Presentation,
  ArrowRight,
  ShieldCheck,
  ChartNoAxesCombined,
  Users,
} from "lucide-react";

type Role = "student" | "instructor" | "adviser" | "admin";

const ROLES: {
  role: Exclude<Role, "admin">;
  title: string;
  description: string;
  cta: string;
  Icon: typeof GraduationCap;
  circle: string;
  iconColor: string;
  button: string;
  wave: string;
}[] = [
  {
    role: "student",
    title: "Student",
    description:
      "Upload deliverables, track progress, and collaborate with your team.",
    cta: "Continue as Student",
    Icon: GraduationCap,
    circle: "bg-blue-100 dark:bg-blue-950",
    iconColor: "text-blue-800 dark:text-blue-300",
    button: "bg-blue-700 hover:bg-blue-800 dark:bg-blue-600 dark:hover:bg-blue-500",
    wave: "from-blue-200 to-blue-100/0 dark:from-blue-900/60 dark:to-blue-900/0",
  },
  {
    role: "adviser",
    title: "Thesis Adviser",
    description:
      "Review student works, provide feedback, and guide project development.",
    cta: "Continue as Adviser",
    Icon: UserCheck,
    circle: "bg-green-100 dark:bg-green-950",
    iconColor: "text-green-700 dark:text-green-300",
    button: "bg-green-700 hover:bg-green-800 dark:bg-green-600 dark:hover:bg-green-500",
    wave: "from-green-200 to-green-100/0 dark:from-green-900/60 dark:to-green-900/0",
  },
  {
    role: "instructor",
    title: "Subject Instructor",
    description: "Create teams, assign tasks, and oversee multiple projects.",
    cta: "Continue as Instructor",
    Icon: Presentation,
    circle: "bg-purple-100 dark:bg-purple-950",
    iconColor: "text-purple-700 dark:text-purple-300",
    button: "bg-purple-700 hover:bg-purple-800 dark:bg-purple-600 dark:hover:bg-purple-500",
    wave: "from-purple-200 to-purple-100/0 dark:from-purple-900/60 dark:to-purple-900/0",
  },
];

const FEATURES = [
  { Icon: ShieldCheck, label: "Organized", sub: "Workflow" },
  { Icon: ChartNoAxesCombined, label: "Real-Time", sub: "Progress Tracking" },
  { Icon: Users, label: "Collaborative", sub: "Academic Community" },
];

export default function LandingPage() {
  const router = useRouter();
  const { isSignedIn, isLoaded } = useUser();
  const me = useQuery(api.users.getMe);

  useEffect(() => {
    if (!isLoaded) return;
    if (isSignedIn && me && me.role) {
      router.replace(`/dashboard/${me.role}`);
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
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
      </div>
    );
  }

  return (
    <div className="font-Poppins relative min-h-screen overflow-hidden bg-white text-slate-900 dark:bg-slate-950 dark:text-slate-100 flex flex-col">
      {/* Background: campus photo (put your image at /public/campus.jpg) */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-cover bg-right bg-no-repeat opacity-60 dark:opacity-25"
        style={{ backgroundImage: "url('/campus.jpg')" }}
      />
      {/* Fade from the page color (left) to transparent (right) so text stays readable */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-gradient-to-r from-white via-white/80 to-white/10 dark:from-slate-950 dark:via-slate-950/85 dark:to-slate-950/40"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-white to-transparent dark:from-slate-950"
      />

      {/* Admin access */}
      <button
        onClick={() => handleClick("admin")}
        aria-label="Admin sign in"
        title="Admin sign in"
        className="fixed top-4 right-4 z-50 p-2 rounded-full text-slate-500 hover:text-slate-900 hover:bg-white/80 dark:text-slate-400 dark:hover:text-white dark:hover:bg-slate-800 transition-colors"
      >
        <User className="h-5 w-5" />
      </button>

      {/* Header */}
      <header className="relative z-10 border-b border-slate-200/70 bg-white/70 backdrop-blur-sm dark:border-slate-800 dark:bg-slate-950/70">
        <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-4 sm:px-6 lg:px-10">
          <GraduationCap
            className="h-9 w-9 text-blue-900 dark:text-blue-400"
            strokeWidth={2.2}
          />
          <span className="text-xl sm:text-2xl font-bold text-blue-950 dark:text-white">
            E-Research
          </span>
        </div>
      </header>

      {/* Hero */}
      <main className="relative z-10 flex-1">
        <div className="mx-auto grid max-w-7xl items-center gap-10 px-4 py-10 sm:px-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)] lg:gap-8 lg:px-10 lg:py-16">
          {/* Left: copy */}
          <div>
            <span className="inline-flex items-center gap-2 rounded-full bg-blue-100/90 px-4 py-2 text-sm font-medium text-blue-800 dark:bg-blue-950 dark:text-blue-300">
              <GraduationCap className="h-4 w-4" />
              An Integrated Management Portal
            </span>

            <h1 className="mt-8 text-4xl sm:text-5xl xl:text-6xl font-extrabold leading-[1.05] tracking-tight text-blue-950 dark:text-white">
              Welcome to the E-Research Portal
            </h1>

            <p className="mt-6 max-w-md text-base sm:text-lg text-slate-600 dark:text-slate-300">
              Select your role to access your personalized dashboard and start
              managing your thesis and capstone projects.
            </p>

            <div className="mt-8 h-1 w-14 rounded-full bg-blue-700 dark:bg-blue-500" />
          </div>

          {/* Right: role cards */}
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
            {ROLES.map(
              ({
                role,
                title,
                description,
                cta,
                Icon,
                circle,
                iconColor,
                button,
                wave,
              }) => (
                <div
                  key={role}
                  className="relative flex flex-col items-center overflow-hidden rounded-3xl border border-white bg-white/95 px-5 pb-8 pt-8 text-center shadow-xl shadow-slate-900/10 backdrop-blur dark:border-slate-800 dark:bg-slate-900/90 dark:shadow-black/40"
                >
                  <div
                    className={`flex h-20 w-20 items-center justify-center rounded-full ${circle}`}
                  >
                    <Icon className={`h-9 w-9 ${iconColor}`} />
                  </div>

                  <h2 className="mt-6 text-xl font-bold text-blue-950 dark:text-white">
                    {title}
                  </h2>
                  <p className="mt-3 flex-1 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
                    {description}
                  </p>

                  <button
                    onClick={() => handleClick(role)}
                    className={`relative z-10 mt-6 inline-flex w-full items-center justify-center gap-2 rounded-full px-4 py-3 text-sm font-semibold text-white shadow-md transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900 dark:focus-visible:outline-white ${button}`}
                  >
                    {cta}
                    <ArrowRight className="h-4 w-4" />
                  </button>

                  {/* Soft tinted wave at the bottom of the card */}
                  <div
                    aria-hidden
                    className={`pointer-events-none absolute inset-x-0 bottom-0 h-8 rounded-t-[100%] bg-gradient-to-t ${wave}`}
                  />
                </div>
              )
            )}
          </div>
        </div>
      </main>

      {/* Bottom wave + feature strip */}
      <div className="relative z-10 mt-6">
        <svg
          aria-hidden
          viewBox="0 0 1440 120"
          preserveAspectRatio="none"
          className="block h-16 w-full sm:h-24"
        >
          <path
            d="M0 70 C 240 10, 480 30, 760 80 S 1240 120, 1440 40 L1440 120 L0 120 Z"
            className="fill-blue-300/60 dark:fill-blue-800/40"
          />
          <path
            d="M0 95 C 260 40, 520 60, 800 100 S 1260 125, 1440 70 L1440 120 L0 120 Z"
            className="fill-blue-900 dark:fill-slate-900"
          />
        </svg>

        <div className="bg-blue-900 dark:bg-slate-900">
          <div className="mx-auto max-w-7xl px-4 pb-6 sm:px-6 lg:px-10">
            <ul className="grid grid-cols-1 gap-5 py-4 text-white sm:grid-cols-3 sm:gap-0">
              {FEATURES.map(({ Icon, label, sub }, i) => (
                <li
                  key={label}
                  className={`flex items-center gap-4 sm:px-6 ${
                    i > 0 ? "sm:border-l sm:border-white/25" : "sm:pl-0"
                  }`}
                >
                  <Icon className="h-9 w-9 shrink-0" strokeWidth={1.6} />
                  <span className="text-sm leading-snug sm:text-base">
                    {label}
                    <br />
                    {sub}
                  </span>
                </li>
              ))}
            </ul>

            <div className="mt-4 border-t border-white/15 pt-4 text-center text-xs text-blue-100/80 dark:text-slate-400">
              <p>&copy; 2026 Thesis Management System. All rights reserved.</p>
              <p>
                Developed by Kit Francis Besa, Carl Andrei Diomon, Stephen
                Gabarda and Kyle Steven Morillo.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}