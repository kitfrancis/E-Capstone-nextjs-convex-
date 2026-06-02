"use client";

import { SignUp } from "@clerk/nextjs";
import { useSearchParams } from "next/navigation";

export default function ClerkSignUpPage() {
  const searchParams = useSearchParams();
  const role = searchParams.get("role") ?? "adviser";

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <SignUp
        routing="path"
        path="/sign-up/clerk-signup"
        fallbackRedirectUrl={`/auth-callback?role=${role}`}
        signInUrl={`/sign-in?role=${role}`}
      />
    </div>
  );
}