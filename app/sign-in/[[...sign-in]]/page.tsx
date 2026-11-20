"use client";

import { SignIn } from "@clerk/nextjs";
import { useSearchParams } from "next/navigation";

export default function SignInPage() {
  const searchParams = useSearchParams();
  const role = searchParams.get("role");
  const isStudent = role === "student";

  // Students no longer self-register: their account is created by the
  // instructor's roster import. Staff still sign up (admin approves advisers).
  const signUpUrl = isStudent
    ? "/sign-in?role=student"
    : `/sign-up/clerk-signup?role=${role ?? "adviser"}`;

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="flex flex-col items-center gap-4">
        {isStudent && (
          <p className="max-w-sm text-center text-sm text-muted-foreground">
            Your account is created by your instructor. Sign in with your
            school email and the temporary password sent to it.
          </p>
        )}
        <SignIn
          routing="path"
          path="/sign-in"
          fallbackRedirectUrl="/auth-callback"
          signUpUrl={signUpUrl}
          appearance={
            isStudent
              ? {
                  // Inline style objects, not the Tailwind "hidden" class:
                  // Clerk injects its own CSS at runtime and can override a
                  // utility class, which is why the Sign up link stayed visible.
                  elements: {
                    footerAction: { display: "none" }, // "Don't have an account? Sign up"
                    socialButtonsRoot: { display: "none" }, // GitHub / Google
                    dividerRow: { display: "none" }, // the "or" line
                  },
                }
              : undefined
          }
        />
      </div>
    </div>
  );
}