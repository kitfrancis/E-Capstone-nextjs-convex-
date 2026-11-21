"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useSignUp } from "@clerk/nextjs/legacy";
import { useClerk } from "@clerk/nextjs";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  Check,
  GraduationCap,
  Info,
  Mail,
  Presentation,
  ShieldCheck,
  UserCheck,
  UserPlus,
} from "lucide-react";
import { DataPrivacyConsent } from "@/components/data-privacy-consent";
import { Button } from "@/components/ui/button";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { InputOTP, InputOTPGroup, InputOTPSeparator, InputOTPSlot } from "@/components/ui/input-otp";
import { Label } from "@/components/ui/label";
import {
  PRIVACY_CONSENT_SESSION_KEY,
  PRIVACY_NOTICE_VERSION,
} from "@/lib/privacy-consent";

// Static labels: same as the sign-in page. Set the two URLs to real links.
const ACADEMIC_YEAR_LABEL = "AY 2026-2027 Active";
const HELPDESK_URL = "#";
const PRIVACY_URL = "#";

type StaffRole = "adviser" | "instructor";

const ROLE_COPY: Record<
  StaffRole,
  {
    badge: string;
    title: string;
    description: string;
    Icon: typeof GraduationCap;
  }
> = {
  adviser: {
    badge: "Adviser Workspace",
    title: "Adviser Sign Up",
    description:
      "Create your account to review student works, provide feedback, and guide project development.",
    Icon: UserCheck,
  },
  instructor: {
    badge: "Instructor Workspace",
    title: "Instructor Sign Up",
    description:
      "Create your account to manage teams, assign tasks, and oversee multiple projects.",
    Icon: Presentation,
  },
};

const SIGNUP_STEPS = [
  {
    Icon: UserPlus,
    title: "Enter your details",
    text: "Use your school email and a strong password, then accept the data privacy consent.",
  },
  {
    Icon: Mail,
    title: "Verify your email",
    text: "Enter the 6-digit code we send to your inbox.",
  },
  {
    Icon: ShieldCheck,
    title: "Wait for approval",
    text: "An administrator may need to approve your account before you get full access.",
  },
];

function Shell({
  role,
  step,
  children,
}: {
  role: StaffRole;
  step: "form" | "verify";
  children: ReactNode;
}) {
  const info = ROLE_COPY[role];
  const { Icon } = info;
  const current = step === "form" ? 0 : 1;

  return (
    <div className="font-Poppins relative flex min-h-screen flex-col overflow-x-clip bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      {/* Background: campus photo with a soft fade so text stays readable */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-cover bg-center bg-no-repeat opacity-50 dark:opacity-20"
        style={{ backgroundImage: "url('/ccisbuilding.jpg')" }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-linear-to-r from-white/95 via-white/80 to-white/50 dark:from-slate-950/95 dark:via-slate-950/85 dark:to-slate-950/60"
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
            <span className="hidden rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-medium text-slate-600 ring-1 ring-slate-200 dark:bg-slate-900 dark:text-slate-300 dark:ring-slate-700 sm:inline-block">
              e-capstone Portal
            </span>
          </Link>

          <div className="flex items-center gap-3">
            <span className="hidden items-center gap-2 rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-700 ring-1 ring-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:ring-emerald-900 sm:inline-flex">
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
              {ACADEMIC_YEAR_LABEL}
            </span>
            <Link
              href="/"
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition-colors hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to roles
            </Link>
          </div>
        </div>
      </header>

      {/* Main */}
      <main className="relative z-10 flex flex-1 items-center">
        <div className="mx-auto grid w-full max-w-7xl items-center gap-10 px-4 py-10 sm:px-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)] lg:gap-14 lg:px-10 lg:py-12">
          {/* Left: copy, notice, progress */}
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
              <p>
                Use your official @antiquespride.edu.ph email. Students don&apos;t
                sign up here: their accounts are created by their instructor.
              </p>
            </div>

            <div className="mt-8 max-w-xl">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Account setup
              </p>
              <ol className="relative mt-4 space-y-1">
                <span
                  aria-hidden
                  className="absolute bottom-8 left-5 top-8 w-px bg-slate-200 dark:bg-slate-700"
                />
                {SIGNUP_STEPS.map(({ Icon: StepIcon, title, text }, i) => {
                  const done = i < current;
                  const active = i === current;
                  return (
                    <li
                      key={title}
                      aria-current={active ? "step" : undefined}
                      className="relative flex items-start gap-4 p-2"
                    >
                      <span
                        className={`relative z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-full shadow-sm ring-1 ${
                          done
                            ? "bg-emerald-500 text-white ring-emerald-500"
                            : active
                              ? "bg-blue-700 text-white ring-blue-700 dark:bg-blue-600 dark:ring-blue-600"
                              : "bg-white text-slate-500 ring-slate-200 dark:bg-slate-900 dark:text-slate-400 dark:ring-slate-700"
                        }`}
                      >
                        {done ? (
                          <Check className="h-[18px] w-[18px]" />
                        ) : (
                          <StepIcon className="h-[18px] w-[18px]" />
                        )}
                      </span>
                      <span className="flex-1">
                        <span
                          className={`block text-sm font-semibold ${
                            active || done
                              ? "text-blue-950 dark:text-white"
                              : "text-slate-600 dark:text-slate-300"
                          }`}
                        >
                          {i + 1}. {title}
                        </span>
                        <span className="mt-0.5 block text-sm leading-relaxed text-slate-600 dark:text-slate-300">
                          {text}
                        </span>
                      </span>
                    </li>
                  );
                })}
              </ol>
            </div>
          </div>

          {/* Right: form in a frosted frame */}
          <div className="flex justify-center lg:justify-end">
            <div className="w-full max-w-[30rem] rounded-[2rem] border border-white/80 bg-white/85 p-3 shadow-2xl shadow-slate-900/15 backdrop-blur-md dark:border-slate-700/60 dark:bg-slate-900/70">
              <div className="rounded-[1.5rem] bg-white p-6 shadow-sm dark:bg-slate-900 sm:p-8">
                {children}
              </div>
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

export default function ClerkSignUpPage() {
  const { isLoaded, signUp } = useSignUp();
  const { isSignedIn, setActive } = useClerk();
  const router = useRouter();
  const searchParams = useSearchParams();
  const requestedRole = searchParams.get("role");
  const role: StaffRole | null =
    requestedRole === "instructor"
      ? "instructor"
      : requestedRole === "adviser" || requestedRole === null
        ? "adviser"
        : null;

  const [step, setStep] = useState<"form" | "verify">("form");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [acceptedDataPrivacy, setAcceptedDataPrivacy] = useState(false);
  const [verifyCode, setVerifyCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isSignedIn && role && step === "form") {
      router.replace("/auth-callback");
    }
  }, [isSignedIn, role, step, router]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!isLoaded || !signUp || !role) return;
    setError("");

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    if (!acceptedDataPrivacy) {
      setError("Please accept the data privacy consent to continue.");
      return;
    }

    setLoading(true);
    try {
      sessionStorage.setItem("intendedRole", role);
      sessionStorage.setItem(
        PRIVACY_CONSENT_SESSION_KEY,
        PRIVACY_NOTICE_VERSION
      );
      await signUp.create({
        firstName,
        lastName,
        emailAddress: email,
        password,
        legalAccepted: acceptedDataPrivacy,
      });
      await signUp.prepareEmailAddressVerification({ strategy: "email_code" });
      setStep("verify");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!isLoaded || !signUp || !role) return;

    setError("");
    setLoading(true);
    try {
      const result = await signUp.attemptEmailAddressVerification({
        code: verifyCode.trim().replace(/\s+/g, ""),
      });
      if (result.status !== "complete") {
        setError("Verification incomplete. Please try again.");
        return;
      }

      await setActive({ session: result.createdSessionId });
      router.replace(`/auth-callback?role=${role}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Invalid verification code.");
    } finally {
      setLoading(false);
    }
  };

  if (!role) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4 text-center">
        Adviser and instructor registration only.
      </div>
    );
  }

  if (step === "verify") {
    return (
      <Shell role={role} step="verify">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-slate-900 dark:text-white">
            Verify your email
          </h2>
          <p className="mx-auto mt-1 max-w-sm text-sm text-slate-600 dark:text-slate-300">
            Enter the verification code we sent to{" "}
            <span className="break-all font-semibold">{email}</span>.
          </p>
        </div>

        <form onSubmit={handleVerify} className="mt-6 space-y-4">
          <Field className="items-center gap-3">
            <FieldLabel htmlFor="staff-email-verification">
              Verification code
            </FieldLabel>
            <InputOTP
              maxLength={6}
              id="staff-email-verification"
              value={verifyCode}
              onChange={setVerifyCode}
              disabled={loading}
            >
              <InputOTPGroup className="*:data-[slot=input-otp-slot]:h-11 *:data-[slot=input-otp-slot]:w-9 *:data-[slot=input-otp-slot]:text-lg sm:*:data-[slot=input-otp-slot]:h-12 sm:*:data-[slot=input-otp-slot]:w-11">
                <InputOTPSlot index={0} />
                <InputOTPSlot index={1} />
                <InputOTPSlot index={2} />
              </InputOTPGroup>
              <InputOTPSeparator className="mx-1 sm:mx-2" />
              <InputOTPGroup className="*:data-[slot=input-otp-slot]:h-11 *:data-[slot=input-otp-slot]:w-9 *:data-[slot=input-otp-slot]:text-lg sm:*:data-[slot=input-otp-slot]:h-12 sm:*:data-[slot=input-otp-slot]:w-11">
                <InputOTPSlot index={3} />
                <InputOTPSlot index={4} />
                <InputOTPSlot index={5} />
              </InputOTPGroup>
            </InputOTP>
          </Field>

          {error && (
            <p role="alert" className="text-center text-sm text-red-500">
              {error}
            </p>
          )}

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Verifying..." : "Verify"}
          </Button>
          <Button
            type="button"
            variant="outline"
            className="w-full"
            disabled={loading}
            onClick={async () => {
              setError("");
              try {
                await signUp?.prepareEmailAddressVerification({
                  strategy: "email_code",
                });
              } catch (err) {
                setError(
                  err instanceof Error
                    ? err.message
                    : "Could not resend the verification code."
                );
              }
            }}
          >
            Resend code
          </Button>
        </form>
      </Shell>
    );
  }

  return (
    <Shell role={role} step="form">
      <div className="text-center">
        <h2 className="text-xl font-semibold text-slate-900 dark:text-white">
          Create your account
        </h2>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
          Fill in your details to get started.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="mt-6 space-y-4">
        <div id="clerk-captcha" />

        <div className="flex flex-row gap-3">
          <div className="flex-1 space-y-1.5">
            <Label htmlFor="first-name" className="text-xs">
              First Name
            </Label>
            <Input
              id="first-name"
              placeholder="First name"
              className="text-sm"
              value={firstName}
              onChange={(event) => setFirstName(event.target.value)}
              required
            />
          </div>
          <div className="flex-1 space-y-1.5">
            <Label htmlFor="last-name" className="text-xs">
              Last Name
            </Label>
            <Input
              id="last-name"
              placeholder="Last name"
              className="text-sm"
              value={lastName}
              onChange={(event) => setLastName(event.target.value)}
              required
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="staff-email" className="text-xs">
            Email
          </Label>
          <Input
            id="staff-email"
            type="email"
            placeholder="you@antiquespride.edu.ph"
            className="text-sm"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="staff-password" className="text-xs">
            Password
          </Label>
          <Input
            id="staff-password"
            type="password"
            placeholder="Minimum 8 characters"
            className="text-sm"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="staff-confirm-password" className="text-xs">
            Confirm Password
          </Label>
          <Input
            id="staff-confirm-password"
            type="password"
            placeholder="Re-enter your password"
            className="text-sm"
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            required
          />
        </div>

        {error && <p className="text-sm text-red-500">{error}</p>}

        <DataPrivacyConsent
          role={role}
          accepted={acceptedDataPrivacy}
          onAcceptedChange={setAcceptedDataPrivacy}
        />

        <Button type="submit" disabled={loading} className="w-full">
          {loading ? "Creating account..." : "Continue"}
        </Button>

        <p className="text-center text-xs text-muted-foreground">
          Already have an account?{" "}
          <Link
            href={`/sign-in?role=${role}`}
            className="text-primary hover:underline"
          >
            Log in
          </Link>
        </p>
      </form>
    </Shell>
  );
}