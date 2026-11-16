"use client";

import { SignIn } from "@clerk/nextjs";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

export default function SignInPage() {
  const searchParams = useSearchParams();
  const role = searchParams.get("role");

  const signUpUrl =
    role === "student"
      ? "/sign-up/student"
      : `/sign-up/clerk-signup?role=${role ?? "adviser"}`;

  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-background px-4 py-8">
      <SignIn
        routing="path"
        path="/sign-in"
        fallbackRedirectUrl="/auth-callback"
        signUpUrl={signUpUrl}
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