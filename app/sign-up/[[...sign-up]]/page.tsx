"use client";

import { SignUp } from "@clerk/nextjs";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

export default function ClerkSignUpPage() {
  const searchParams = useSearchParams();
  const role = searchParams.get("role") ?? "adviser";

  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-background px-4 py-8">
      <SignUp
        routing="path"
        path="/sign-up/clerk-signup"
        fallbackRedirectUrl={`/auth-callback?role=${role}`}
        signInUrl={`/sign-in?role=${role}`}
      />
      <p className="text-center text-xs text-muted-foreground">
        <Link href="/privacy-policy" className="text-primary hover:underline">
          Privacy Policy
        </Link>
        {" · "}
        <Link href="/terms-of-service" className="text-primary hover:underline">
          Terms of Service
        </Link>
      </p>
    </div>
  );
}