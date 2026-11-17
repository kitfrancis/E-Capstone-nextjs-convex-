"use client";

import { useEffect, useState } from "react";
import { useSignUp } from "@clerk/nextjs/legacy";
import { useClerk } from "@clerk/nextjs";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { DataPrivacyConsent } from "@/components/data-privacy-consent";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { InputOTP, InputOTPGroup, InputOTPSeparator, InputOTPSlot } from "@/components/ui/input-otp";
import { Label } from "@/components/ui/label";
import {
  PRIVACY_CONSENT_SESSION_KEY,
  PRIVACY_NOTICE_VERSION,
} from "@/lib/privacy-consent";

type StaffRole = "adviser" | "instructor";

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
      <div className="flex min-h-screen items-center justify-center bg-background px-4 py-8">
        <Card className="w-full max-w-md">
          <CardHeader className="px-6 text-center sm:px-8">
            <CardTitle className="w-full text-lg font-semibold">
              Verify your email
            </CardTitle>
            <CardDescription className="mx-auto max-w-sm text-sm">
              Enter the verification code we sent to{" "}
              <span className="break-all font-semibold">{email}</span>.
            </CardDescription>
          </CardHeader>

          <form onSubmit={handleVerify}>
            <CardContent className="space-y-4 px-6 pb-6 sm:px-8">
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
            </CardContent>
          </form>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-2 py-8">
      <div className="w-full max-w-md rounded-lg bg-card p-6 shadow-md sm:p-10">
        <div className="mb-4 flex flex-col items-center">
          <h1 className="text-base font-bold text-card-foreground md:text-lg">
            Sign up as {role === "adviser" ? "an adviser" : "an instructor"}
          </h1>
          <p className="text-xs text-foreground md:text-sm">
            Create your E-Capstone account.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="mt-2 space-y-4">
          <div id="clerk-captcha" />

          <div className="flex flex-row gap-3">
            <div className="flex-1 space-y-1">
              <Label htmlFor="first-name" className="text-xs">
                First Name
              </Label>
              <Input
                id="first-name"
                placeholder="First name"
                className="text-xs"
                value={firstName}
                onChange={(event) => setFirstName(event.target.value)}
                required
              />
            </div>
            <div className="flex-1 space-y-1">
              <Label htmlFor="last-name" className="text-xs">
                Last Name
              </Label>
              <Input
                id="last-name"
                placeholder="Last name"
                className="text-xs"
                value={lastName}
                onChange={(event) => setLastName(event.target.value)}
                required
              />
            </div>
          </div>

          <div className="space-y-1">
            <Label htmlFor="staff-email">Email</Label>
            <Input
              id="staff-email"
              type="email"
              placeholder="you@antiquespride.edu.ph"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
            <Label htmlFor="staff-password" className="text-xs">
              Password
            </Label>
            <Input
              id="staff-password"
              type="password"
              placeholder="Minimum 8 characters"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
            />
            <Label htmlFor="staff-confirm-password" className="text-xs">
              Confirm Password
            </Label>
            <Input
              id="staff-confirm-password"
              type="password"
              placeholder="Re-enter your password"
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
      </div>
    </div>
  );
}
