"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth, useClerk } from "@clerk/nextjs";
import {
  GraduationCap,
  Loader2,
  Mail,
  ShieldCheck,
  UserCheck,
  UserX,
} from "lucide-react";
import { Button } from "@/components/ui/button";

function InfoRow({
  icon: Icon,
  tone,
  title,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  tone: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex gap-3.5 rounded-2xl border p-4 text-left">
      <div
        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${tone}`}
      >
        <Icon className="h-5 w-5" />
      </div>
      <div className="min-w-0">
        <p className="text-sm font-semibold text-foreground">{title}</p>
        <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">
          {children}
        </p>
      </div>
    </div>
  );
}

function NoAccountContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { isSignedIn } = useAuth();
  const { signOut } = useClerk();
  const [leaving, setLeaving] = useState(false);

  const email = searchParams.get("email");
  const isCoordinator = searchParams.get("role") === "coordinator";
  const signInHref = isCoordinator
    ? "/sign-in?role=coordinator"
    : "/sign-in?role=student";

  // Signed in with the wrong account? Sign out first so the next sign-in starts clean.
  const handleUseDifferentAccount = async () => {
    setLeaving(true);
    try {
      if (isSignedIn) {
        await signOut({ redirectUrl: signInHref });
      } else {
        router.push(signInHref);
      }
    } catch {
      router.push(signInHref);
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-linear-to-b from-blue-100 via-blue-50 to-background px-4 py-10 dark:from-blue-950/50 dark:via-blue-950/20 dark:to-background">
      {/* Brand */}
      <div className="flex items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-full border border-blue-200 bg-card text-lg font-bold text-blue-700 dark:border-blue-900 dark:text-blue-300">
          E
        </div>
        <div>
          <p className="text-xl font-bold leading-tight text-foreground">
            E-Research
          </p>
          <p className="text-xs leading-tight text-muted-foreground">
            Thesis &amp; Capstone Management
          </p>
        </div>
      </div>

      {/* Card */}
      <div className="flex w-full max-w-xl flex-col items-center rounded-3xl border bg-card p-8 text-center shadow-lg shadow-blue-600/5 sm:p-10">
        <div className="flex h-18 w-18 items-center justify-center rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300">
          {isCoordinator ? (
            <ShieldCheck className="h-8 w-8" />
          ) : (
            <UserX className="h-8 w-8" />
          )}
        </div>

        <h1 className="mt-5 text-2xl font-bold text-foreground">
          {isCoordinator
            ? "No Research Coordinator access yet"
            : "This account isn't registered"}
        </h1>

        <p className="mt-2.5 max-w-sm text-[15px] leading-relaxed text-muted-foreground">
          {isCoordinator
            ? email
              ? "Coordinator access isn't enabled for"
              : "Coordinator access isn't enabled for the email you signed in with."
            : email
              ? "We couldn't find an E-Research account for"
              : "We couldn't find an E-Research account for the email you signed in with."}
        </p>

        {email && (
          <div className="mt-2.5 flex max-w-full items-center gap-2 rounded-full border bg-muted/40 px-4 py-2 text-sm font-medium text-foreground">
            <Mail className="h-4 w-4 shrink-0 text-muted-foreground" />
            <span className="truncate">{email}</span>
          </div>
        )}

        <div className="mt-7 flex w-full flex-col gap-3">
          {isCoordinator ? (
            <InfoRow
              icon={ShieldCheck}
              tone="bg-violet-100 text-violet-700 dark:bg-violet-900/50 dark:text-violet-300"
              title="Research Coordinator"
            >
              Create an account to request Research Coordinator access. An
              administrator must approve your request before you can use the
              coordinator workspace.
            </InfoRow>
          ) : (
            <>
              <InfoRow
                icon={GraduationCap}
                tone="bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300"
                title="Students"
              >
                Your instructor registers you by uploading the class roster. Ask
                them to add this exact email, then sign in with Google using
                your school account.
              </InfoRow>
              <InfoRow
                icon={UserCheck}
                tone="bg-violet-100 text-violet-700 dark:bg-violet-900/50 dark:text-violet-300"
                title="Advisers and instructors"
              >
                Sign up first. Advisers wait for instructor approval;
                instructors wait for admin approval.
              </InfoRow>
            </>
          )}
        </div>

        <Button
          onClick={handleUseDifferentAccount}
          disabled={leaving}
          className="mt-6 h-12 w-full gap-2 rounded-xl bg-blue-600 text-[15px] font-semibold text-white hover:bg-blue-700"
        >
          {leaving && <Loader2 className="h-4 w-4 animate-spin" />}
          Use a different account
        </Button>

        <Button
          asChild
          variant="outline"
          className="mt-2.5 h-12 w-full rounded-xl text-[15px]"
        >
          <Link
            href={
              isCoordinator
                ? "/sign-up/clerk-signup?role=coordinator"
                : "/sign-up/clerk-signup?role=adviser"
            }
          >
            {isCoordinator
              ? "Request coordinator access"
              : "Adviser or instructor? Sign up"}
          </Link>
        </Button>

        {!isCoordinator && (
          <p className="mt-4 text-xs text-muted-foreground">
            Need help? Contact your instructor.
          </p>
        )}
      </div>
    </div>
  );
}

export default function NoAccountPage() {
  return (
    <Suspense fallback={null}>
      <NoAccountContent />
    </Suspense>
  );
}