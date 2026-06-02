"use client";

import { SignIn } from "@clerk/nextjs";
import { useSearchParams } from "next/navigation";

export default function SignInPage() {
  const searchParams = useSearchParams();
  const role = searchParams.get("role");

  const signUpUrl =
    role === "student"
      ? "/sign-up/student"
      : `/sign-up/clerk-signup?role=${role ?? "adviser"}`;

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <SignIn
        routing="path"
        path="/sign-in"
        fallbackRedirectUrl="/auth-callback"
        signUpUrl={signUpUrl}
      />
    </div>
  );
}