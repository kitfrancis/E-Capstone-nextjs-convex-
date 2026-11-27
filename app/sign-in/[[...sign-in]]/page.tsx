"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { SignIn } from "@clerk/nextjs";
import { useSearchParams } from "next/navigation";
import {
  GraduationCap,
  UserCheck,
  Presentation,
  ShieldCheck,
  ArrowLeft,
  Info,
  Mail,
  KeyRound,
  LayoutDashboard,
  UserPlus,
  Clock,
  FileSpreadsheet,
  Users,
  ScrollText,
  ChevronDown,
  ClipboardCheck,
} from "lucide-react";

// Set these to real links.
const HELPDESK_URL = "#";
const PRIVACY_URL = "#";

type RoleKey =
  | "student"
  | "adviser"
  | "instructor"
  | "coordinator"
  | "admin";

type Step = {
  Icon: typeof Mail;
  title: string;
  summary: string;
  detail: string;
};

const ROLE_INFO: Record<
  RoleKey,
  {
    badge: string;
    title: string;
    description: string;
    notice: string;
    Icon: typeof GraduationCap;
    accent: string;
    steps: Step[];
  }
> = {
  student: {
    badge: "Student Researcher Workspace",
    title: "Student Sign In",
    description:
      "Upload deliverables, track progress, and collaborate with your capstone team in real time.",
    notice:
      "Sign in with your official @antiquespride.edu.ph Google account. Only students on your instructor's roster can get in.",
    Icon: GraduationCap,
    accent: "#1d4ed8",
    steps: [
      {
        Icon: Mail,
        title: "Use your school Google account",
        summary:
          "Click Continue with Google and choose your @antiquespride.edu.ph account.",
        detail:
          "Personal Gmail accounts won't work unless your instructor listed that exact address in the roster. There is no password to remember.",
      },
      {
        Icon: ShieldCheck,
        title: "Accept the privacy notice",
        summary:
          "The first time you sign in, review and accept the data privacy notice.",
        detail:
          "This only appears once. After that you go straight to your dashboard.",
      },
      {
        Icon: LayoutDashboard,
        title: "Land on your team dashboard",
        summary: "Your team and project are already set up by your instructor.",
        detail:
          "If you see “no account”, your email isn't on the roster yet. Ask your instructor to check the email they uploaded for you.",
      },
    ],
  },
  adviser: {
    badge: "Adviser Workspace",
    title: "Adviser Sign In",
    description:
      "Review student works, provide feedback, and guide project development.",
    notice:
      "New adviser? Use Sign up below with your school email. An instructor verifies advisers before they get access.",
    Icon: UserCheck,
    accent: "#15803d",
    steps: [
      {
        Icon: UserPlus,
        title: "Create your account",
        summary: "New adviser? Use Sign up with your school email.",
        detail:
          "Already registered? Just sign in with the email and password you chose.",
      },
      {
        Icon: Clock,
        title: "Wait for approval",
        summary: "An instructor verifies advisers before they get access.",
        detail:
          "You'll get a notification in the system once your account is approved.",
      },
      {
        Icon: LayoutDashboard,
        title: "Guide your teams",
        summary: "Review deliverables and send feedback from your dashboard.",
        detail:
          "Your assigned teams, their chapters, and review requests all appear on your dashboard.",
      },
    ],
  },
  instructor: {
    badge: "Instructor Workspace",
    title: "Instructor Sign In",
    description: "Create teams, assign tasks, and oversee multiple projects.",
    notice:
      "New here? Use Sign up below with your school email. Already registered? Sign in with your email and password.",
    Icon: Presentation,
    accent: "#7e22ce",
    steps: [
      {
        Icon: KeyRound,
        title: "Sign in",
        summary: "Use your registered email and password.",
        detail:
          "If you're new, use Sign up first, then come back here to sign in.",
      },
      {
        Icon: FileSpreadsheet,
        title: "Import your roster",
        summary:
          "Upload the team list. Listed students can then sign in with their school Google account.",
        detail:
          "Students are placed on their team the first time they sign in. No passwords or emails are sent.",
      },
      {
        Icon: Users,
        title: "Oversee projects",
        summary:
          "Track progress, review submissions, and manage defense steps.",
        detail:
          "Teams, tasks, deliverables, and the defense pipeline are all managed from your dashboard.",
      },
    ],
  },
  admin: {
    badge: "Admin Console",
    title: "Admin Sign In",
    description: "Manage users, approvals, archives, and system settings.",
    notice:
      "Administrator accounts are created by the system owner. Sign in with your administrator email and password.",
    Icon: ShieldCheck,
    accent: "#1e3a8a",
    steps: [
      {
        Icon: KeyRound,
        title: "Sign in",
        summary: "Use your administrator email and password.",
        detail: "Admin accounts are not created through sign up.",
      },
      {
        Icon: UserCheck,
        title: "Review approvals",
        summary: "Verify advisers and manage user roles.",
        detail:
          "Pending advisers appear in your user management page until you approve them.",
      },
      {
        Icon: ScrollText,
        title: "Monitor activity",
        summary: "Check audit logs, archives, and system settings.",
        detail:
          "Every sensitive action is recorded in the audit log for review.",
      },
    ],
  },
  coordinator: {
    badge: "Research Coordinator Workspace",
    title: "Research Coordinator Sign In",
    description:
      "Review final IMRaD submissions, verify research work, and manage the archive.",
    notice:
      "Sign in with your registered account. New coordinators can request access; an administrator must approve it before the workspace is available.",
    Icon: ClipboardCheck,
    accent: "#be123c",
    steps: [
      {
        Icon: KeyRound,
        title: "Sign in",
        summary: "Sign in with your registered coordinator account.",
        detail:
          "New coordinator accounts are reviewed by an administrator before access is granted.",
      },
      {
        Icon: UserCheck,
        title: "Verify final IMRaD submissions",
        summary: "Approve a final document or request changes from the instructor.",
        detail:
          "Only submissions awaiting final verification appear in your review queue.",
      },
      {
        Icon: ScrollText,
        title: "Manage the archive",
        summary: "Maintain archived project records and files.",
        detail:
          "Archive access includes uploading, editing, and deleting archived projects.",
      },
    ],
  },
};

export default function SignInPage() {
  const searchParams = useSearchParams();
  const role = searchParams.get("role");
  const isStudent = role === "student";
  const noSelfSignUp = isStudent;
  const [openStep, setOpenStep] = useState<number | null>(0);

  const roleKey: RoleKey =
    role && role in ROLE_INFO ? (role as RoleKey) : "student";
  const info = ROLE_INFO[roleKey];
  const { Icon } = info;

  useEffect(() => {
    if (role && Object.prototype.hasOwnProperty.call(ROLE_INFO, role)) {
      sessionStorage.setItem("intendedRole", role);
    }
  }, [role]);

  // Students never self-register and have no password: they sign in with
  // Google, and the callback only lets in emails that are on a roster.
  // Coordinator sign-ups create pending requests.
  const signUpUrl = noSelfSignUp
    ? `/no-account?role=${role}`
    : `/sign-up/clerk-signup?role=${role ?? "adviser"}`;

  return (
    <div className="font-Poppins relative flex min-h-screen flex-col overflow-x-clip bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      {/* Background: campus photo with a soft fade so text stays readable */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 bg-cover bg-center bg-no-repeat opacity-50 dark:opacity-20"
        style={{ backgroundImage: "url('/ccisbuilding.jpg')" }}
      />
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 bg-linear-to-r from-white/95 via-white/80 to-white/50 dark:from-slate-950/95 dark:via-slate-950/85 dark:to-slate-950/60"
      />

      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-slate-200/70 bg-white/80 backdrop-blur-sm dark:border-slate-800 dark:bg-slate-950/80">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6 lg:px-10">
          <Link href="/" className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-700 text-white shadow-sm dark:bg-blue-600">
              <GraduationCap className="h-5 w-5" strokeWidth={2.2} />
            </span>
            <span className="text-lg font-bold text-blue-950 dark:text-white sm:text-xl">
              E-Research
            </span>
          </Link>

          <Link
            href="/"
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition-colors hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to roles
          </Link>
        </div>
      </header>

      {/* Main */}
      <main className="relative z-10 flex flex-1 items-center">
        <div className="mx-auto grid w-full max-w-7xl items-center gap-10 px-4 py-10 sm:px-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)] lg:gap-14 lg:px-10 lg:py-12">
          {/* Left: copy, notice, first-time access guide */}
          <div>
            <div className="flex items-center gap-3">
              <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-blue-800 ring-1 ring-blue-100 dark:bg-blue-950 dark:text-blue-300 dark:ring-blue-900">
                <Icon className="h-6 w-6" />
              </span>
              <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700 ring-1 ring-blue-100 dark:bg-blue-950 dark:text-blue-300 dark:ring-blue-900">
                {info.badge}
              </span>
            </div>

            <h1 className="mt-5 text-4xl font-extrabold leading-[1.05] tracking-tight text-blue-950 dark:text-white sm:text-5xl">
              {info.title}
            </h1>
            <p className="mt-4 max-w-xl text-base text-slate-600 dark:text-slate-300 sm:text-lg">
              {info.description}
            </p>
            <div className="mt-5 h-1 w-14 rounded-full bg-blue-700 dark:bg-blue-500" />

            <div className="mt-6 flex max-w-xl items-start gap-3 rounded-2xl border border-blue-200 bg-blue-50/90 px-4 py-3.5 text-sm text-blue-950 dark:border-blue-900 dark:bg-blue-950/70 dark:text-blue-100">
              <Info className="mt-0.5 h-4 w-4 shrink-0 text-blue-700 dark:text-blue-300" />
              <p>{info.notice}</p>
            </div>

            {/* First-time access guide */}
            <div className="mt-8 max-w-xl">
              <div className="flex items-center justify-between text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                <span>First-time access &amp; security guide</span>
                <span className="font-normal normal-case tracking-normal">
                  Click any step for details
                </span>
              </div>

              <ol className="relative mt-4 space-y-1">
                <span
                  aria-hidden
                  className="absolute bottom-8 left-5 top-8 w-px bg-slate-200 dark:bg-slate-700"
                />
                {info.steps.map(
                  ({ Icon: StepIcon, title, summary, detail }, i) => {
                    const open = openStep === i;
                    const panelId = `signin-step-panel-${i}`;
                    return (
                      <li key={title} className="relative">
                        <button
                          type="button"
                          onClick={() => setOpenStep(open ? null : i)}
                          aria-expanded={open}
                          aria-controls={panelId}
                          className="flex w-full items-start gap-4 rounded-2xl p-2 text-left transition-colors hover:bg-white/60 dark:hover:bg-slate-900/60"
                        >
                          <span className="relative z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white text-blue-700 shadow-sm ring-1 ring-slate-200 dark:bg-slate-900 dark:text-blue-300 dark:ring-slate-700">
                            <StepIcon className="h-4.5 w-4.5" />
                          </span>
                          <span className="flex-1">
                            <span className="block text-sm font-semibold text-blue-950 dark:text-white">
                              {i + 1}. {title}
                            </span>
                            <span className="mt-0.5 block text-sm leading-relaxed text-slate-600 dark:text-slate-300">
                              {summary}
                            </span>
                          </span>
                          <ChevronDown
                            className={`mt-2 h-4 w-4 shrink-0 text-slate-400 transition-transform duration-300 ease-out motion-reduce:transition-none ${
                              open ? "rotate-180" : ""
                            }`}
                          />
                        </button>

                        {/* Animated detail panel: height + fade */}
                        <div
                          id={panelId}
                          className={`grid pl-16 pr-2 transition-[grid-template-rows,opacity] duration-300 ease-out motion-reduce:transition-none ${
                            open
                              ? "grid-rows-[1fr] opacity-100"
                              : "grid-rows-[0fr] opacity-0"
                          }`}
                        >
                          <div className="overflow-hidden">
                            <p className="mb-2 rounded-xl bg-white/80 px-3 py-2 text-sm leading-relaxed text-slate-700 ring-1 ring-slate-200 dark:bg-slate-900/80 dark:text-slate-200 dark:ring-slate-700">
                              {detail}
                            </p>
                          </div>
                        </div>
                      </li>
                    );
                  }
                )}
              </ol>
            </div>
          </div>

          {/* Right: Clerk sign-in only (no role tabs) */}
          <div className="flex justify-center lg:justify-end">
            <div className="w-full max-w-120 rounded-[2rem] border border-white/80 bg-white/85 p-3 shadow-2xl shadow-slate-900/15 backdrop-blur-md dark:border-slate-700/60 dark:bg-slate-900/70">
              <SignIn
                routing="path"
                path="/sign-in"
                fallbackRedirectUrl="/auth-callback"
                signUpUrl={signUpUrl}
                // If Clerk does create the user from an OAuth sign-in, land on the
                // callback so it can check the roster (otherwise Clerk sends
                // them to "/").
                signUpFallbackRedirectUrl="/auth-callback"
                appearance={{
                  variables: {
                    colorPrimary: info.accent,
                    borderRadius: "0.9rem",
                    fontFamily: "inherit",
                  },
                  // Inline style objects, not Tailwind classes: Clerk injects its
                  // own CSS at runtime and can override a utility class.
                  elements: {
                    rootBox: { width: "100%" },
                    cardBox: { width: "100%", boxShadow: "none" },
                    card: { boxShadow: "none" },
                    // Students use Google only: hide the email/password form.
                    ...(noSelfSignUp && {
                      form: { display: "none" },
                      dividerRow: { display: "none" },
                      footerAction: { display: "none" }, // "Don't have an account? Sign up"
                    }),
                  },
                }}
              />
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 border-t border-slate-200/70 bg-white/85 backdrop-blur-sm dark:border-slate-800 dark:bg-slate-950/85">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-2 px-4 py-4 text-xs text-slate-600 dark:text-slate-400 sm:flex-row sm:px-6 lg:px-10">
          <p>
            &copy; 2026 University of Antique &bull; E-Research &amp;
            e-capstone Management System
          </p>
          <div className="flex items-center gap-3">
            <a
              href={HELPDESK_URL}
              className="hover:text-slate-900 dark:hover:text-white"
            >
              IT Helpdesk
            </a>
            <span aria-hidden>&bull;</span>
            <a
              href={PRIVACY_URL}
              className="hover:text-slate-900 dark:hover:text-white"
            >
              Privacy &amp; Ethics
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}