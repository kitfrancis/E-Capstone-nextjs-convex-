"use client";

import { useEffect, useState } from "react";
import { useSignUp } from "@clerk/nextjs/legacy";
import { useClerk } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useConvexAuth } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowRight, EyeIcon, EyeOffIcon, RefreshCwIcon } from "lucide-react";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldLabel } from "@/components/ui/field";
import { InputOTP, InputOTPGroup, InputOTPSeparator, InputOTPSlot } from "@/components/ui/input-otp";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

// idle    = nothing happening yet
// waiting = Clerk session is active, waiting for Convex to receive the token
// failed  = registration on the server failed; the user can retry
type SetupState = "idle" | "waiting" | "failed";

export default function SignUpPage() {
  const { isLoaded, signUp } = useSignUp();
  const { setActive, isSignedIn } = useClerk();
  const { isAuthenticated } = useConvexAuth();
  const registerStudent = useMutation(api.users.registerStudent);
  const router = useRouter();

  const [step, setStep] = useState<"form" | "verify">("form");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [acceptedDataPrivacy, setAcceptedDataPrivacy] = useState(false);
  const [privacyDialogOpen, setPrivacyDialogOpen] = useState(false);
  const [studentNo, setStudentNo] = useState("");
  const [program, setProgram] = useState("");
  const [section, setSection] = useState("");
  const [error, setError] = useState("");
  const [inviteCodeError, setInviteCodeError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const [verifyCode, setVerifyCode] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [setupState, setSetupState] = useState<SetupState>("idle");

  const inviteCodeValid = useQuery(
    api.dashboard.validateInviteCode,
    inviteCode ? { inviteCode } : "skip"
  );

  // Already signed in and not in the middle of signing up -> go to dashboard
  useEffect(() => {
    if (isSignedIn && setupState === "idle" && step === "form") {
      router.push("/dashboard/student");
    }
  }, [isSignedIn, setupState, step, router]);

  // Create the Convex user + join the team in ONE server call.
  // Runs only after the Clerk session exists AND Convex has the auth token.
  const runSetup = async () => {
    setError("");
    setLoading(true);
    try {
      await registerStudent({
        name: `${firstName} ${lastName}`.trim(),
        email,
        studentNo: studentNo.trim(),
        program,
        section,
        inviteCode,
      });
      router.push("/dashboard/student");
    } catch (err: any) {
      setError(
        err?.data ??
          err?.message ??
          "Your account was created but setup failed. Please try again."
      );
      setSetupState("failed");
      setLoading(false);
    }
  };

  useEffect(() => {
    if (setupState === "waiting" && isAuthenticated) {
      runSetup();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setupState, isAuthenticated]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isLoaded || !signUp) return;
    setError("");
    setInviteCodeError("");

    if (!inviteCode) {
      setInviteCodeError("An invite code is required.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    if (!acceptedDataPrivacy) {
      setError("Please accept the data privacy consent to continue.");
      return;
    }
    if (!program || !section) {
      setError("Please select your program and section.");
      return;
    }

    setLoading(true);

    try {
      if (inviteCodeValid === undefined) {
        setInviteCodeError("Still validating code, please try again.");
        setLoading(false);
        return;
      }

      if (!inviteCodeValid) {
        setInviteCodeError("Invalid or expired invite code.");
        setLoading(false);
        return;
      }

      await signUp.create({ firstName, lastName, emailAddress: email, password });
      await signUp.prepareEmailAddressVerification({ strategy: "email_code" });
      setStep("verify");
    } catch (err: any) {
      setError(err.errors?.[0]?.message ?? "Something went wrong.");
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isLoaded || !signUp) return;

    // Session already exists from a previous attempt: just retry the setup
    if (setupState === "failed") {
      if (isAuthenticated) await runSetup();
      return;
    }

    setError("");
    setLoading(true);

    let result;
    try {
      const code = verifyCode.trim().replace(/\s+/g, "");
      result = await signUp.attemptEmailAddressVerification({ code });
    } catch (err: any) {
      setError(err.errors?.[0]?.message ?? "Invalid verification code.");
      setLoading(false);
      return;
    }

    if (result.status !== "complete") {
      setError("Verification incomplete. Please try again.");
      setLoading(false);
      return;
    }

    try {
      // Mark "waiting" BEFORE activating the session so the redirect effect
      // above doesn't send the user to the dashboard before setup finishes.
      setSetupState("waiting");
      await setActive({ session: result.createdSessionId });
      // The effect above calls registerStudent once Convex is authenticated.
    } catch (err: any) {
      setSetupState("idle");
      setError(err.message ?? "Could not sign you in. Please try again.");
      setLoading(false);
    }
  };

  if (step === "verify") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <Card className="w-full max-w-sm">
          <CardHeader className="px-6">
            <CardTitle className="mt-2 text-base text-center md:text-left">Verify your email</CardTitle>
            <CardDescription className="text-center md:text-left">
              Enter the verification code we sent to{" "}
              <span className="font-semibold">{email}</span>.
            </CardDescription>
          </CardHeader>

          <form onSubmit={handleVerify}>
            <CardContent className="px-6 pb-2">
              <Field>
                <div className="flex items-center justify-between gap-2 px-6 md:px-10">
                  <FieldLabel htmlFor="otp-verification">Verification code</FieldLabel>
                  <Button
                    type="button"
                    variant="outline"
                    size="xs"
                    disabled={loading || setupState !== "idle"}
                    onClick={() => signUp?.prepareEmailAddressVerification({ strategy: "email_code" })}
                  >
                    <RefreshCwIcon />
                    Resend Code
                  </Button>
                </div>

                <div className="flex justify-center mb-4 mt-2 px-6 md:px-2">
                  <InputOTP
                    maxLength={6}
                    id="otp-verification"
                    value={verifyCode}
                    onChange={(value) => setVerifyCode(value)}
                    disabled={setupState !== "idle"}
                  >
                    <InputOTPGroup className="*:data-[slot=input-otp-slot]:h-11 md:*:data-[slot=input-otp-slot]:h-12 *:data-[slot=input-otp-slot]:w-10 md:*:data-[slot=input-otp-slot]:w-11 *:data-[slot=input-otp-slot]:text-xl">
                      <InputOTPSlot index={0} />
                      <InputOTPSlot index={1} />
                      <InputOTPSlot index={2} />
                    </InputOTPGroup>
                    <InputOTPSeparator className="mx-0 md:mx-2" />
                    <InputOTPGroup className="*:data-[slot=input-otp-slot]:h-11 md:*:data-[slot=input-otp-slot]:h-12 *:data-[slot=input-otp-slot]:w-10 md:*:data-[slot=input-otp-slot]:w-11 *:data-[slot=input-otp-slot]:text-xl">
                      <InputOTPSlot index={3} />
                      <InputOTPSlot index={4} />
                      <InputOTPSlot index={5} />
                    </InputOTPGroup>
                  </InputOTP>
                </div>

                {error && <p className="text-red-500 text-sm mt-2">{error}</p>}
              </Field>
            </CardContent>

            <CardFooter className="flex flex-col gap-3 px-6 pb-6">
              <Button type="submit" className="w-full" disabled={loading}>
                {setupState === "failed"
                  ? loading
                    ? "Retrying..."
                    : "Retry setup"
                  : loading
                    ? setupState === "waiting"
                      ? "Setting up your account..."
                      : "Verifying..."
                    : "Verify"}
              </Button>
              <div className="text-xs text-muted-foreground text-center">
                Having trouble?{" "}
                <a href="#" className="underline text-xs underline-offset-4 hover:text-primary">Contact support</a>
              </div>
            </CardFooter>
          </form>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-2 py-8">
      <div className="bg-card w-full max-w-md p-6 sm:p-10 rounded-lg shadow-md">
        <div className="flex flex-col items-center mb-4">
          <h1 className="text-base md:text-lg font-bold text-card-foreground">Sign up to E-Capstone</h1>
          <p className="text-xs md:text-sm text-foreground">Create your account.</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          <div id="clerk-captcha" />

          <div className="flex flex-row gap-3">
            <div className="space-y-1 flex-1">
              <Label className="text-xs">First Name</Label>
              <Input placeholder="First name" className="text-xs" onChange={(e) => setFirstName(e.target.value)} required />
            </div>
            <div className="space-y-1 flex-1">
              <Label className="text-xs">Last Name</Label>
              <Input placeholder="Last name" className="text-xs" onChange={(e) => setLastName(e.target.value)} required />
            </div>
          </div>

          <div className="space-y-1">
            <Label>Email</Label>
            <Input type="email" placeholder="you@antiquespride.edu.ph" className="mb-3" onChange={(e) => setEmail(e.target.value)} required />
            <Label className="text-xs">Password</Label>
            <div className="flex items-center gap-2 mb-3">
              <Input type={showPassword ? "text" : "password"} placeholder="Minimum 8 characters" onChange={(e) => setPassword(e.target.value)} required />
              <Button type="button" className="bg-card text-foreground hover:bg-accent" onClick={() => setShowPassword((prev) => !prev)}>
                {showPassword ? <EyeOffIcon /> : <EyeIcon />}
              </Button>
            </div>
            <Label className="text-xs">Confirm Password</Label>
            <Input
              type={showPassword ? "text" : "password"}
              placeholder="Re-enter your password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
            />
          </div>

          <div className="flex items-center gap-2">
            <hr className="flex-1" />
            <span className="text-xs text-muted-foreground font-medium whitespace-nowrap">STUDENT INFO</span>
            <hr className="flex-1" />
          </div>

          <div className="space-y-3">
            <div className="space-y-1">
              <Label className="text-xs">Student No.</Label>
              <Input placeholder="e.g 2023-1309-A" className="text-xs" onChange={(e) => setStudentNo(e.target.value)} required />
            </div>

            <div className="flex flex-col sm:flex-row gap-3 mb-6">
              <div className="space-y-1 flex-1">
                <Label className="text-xs">Program</Label>
                <Select onValueChange={(value) => setProgram(value)}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select a program" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      <SelectItem value="BSIT">Information Technology</SelectItem>
                      <SelectItem value="BSCS">Computer Science</SelectItem>
                      <SelectItem value="BLIS">Library and Information Science</SelectItem>
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1 flex-1">
                <Label className="text-xs">Section</Label>
                <Select onValueChange={(value) => setSection(value)}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Section" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      <SelectItem value="3A">3A</SelectItem>
                      <SelectItem value="3B">3B</SelectItem>
                      <SelectItem value="3C">3C</SelectItem>
                      <SelectItem value="3D">3D</SelectItem>
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <hr className="flex-1" />
            <span className="text-xs text-muted-foreground font-medium whitespace-nowrap">INVITE CODE</span>
            <hr className="flex-1" />
          </div>

          <div className="space-y-1">
            <Label className="text-xs">Invite Code</Label>
            <Input
              placeholder="e.g. ECAP-ABCD-EFGH"
              className={`text-xs mb-1 ${inviteCodeError ? "border-red-500 focus-visible:ring-red-500" : ""}`}
              onChange={(e) => {
                setInviteCode(e.target.value.trim().toUpperCase());
                setInviteCodeError("");
              }}
              required
            />
            {inviteCodeError && (
              <p className="text-red-500 text-xs mt-1">{inviteCodeError}</p>
            )}
          </div>

          {error && <p className="text-red-500 text-sm">{error}</p>}

          <div className="flex items-start gap-2 text-xs text-muted-foreground">
            <input
              type="checkbox"
              checked={acceptedDataPrivacy}
              onChange={(e) => setAcceptedDataPrivacy(e.target.checked)}
              required
              disabled={!acceptedDataPrivacy}
              className="mt-0.5 h-4 w-4 shrink-0 accent-blue-600"
            />
            <span>
              I agree to the collection and processing of my information.{" "}
              <button
                type="button"
                className="font-medium text-primary underline underline-offset-2 hover:text-primary/80"
                onClick={() => setPrivacyDialogOpen(true)}
              >
                Read the Data Privacy Notice
              </button>
            </span>
          </div>

          <Dialog open={privacyDialogOpen} onOpenChange={setPrivacyDialogOpen}>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>Data Privacy Notice and Consent</DialogTitle>
                <DialogDescription>
                  Please review this notice before creating your E-Capstone account.
                </DialogDescription>
              </DialogHeader>

              <div className="max-h-[55vh] space-y-3 overflow-y-auto pr-2 text-xs leading-relaxed text-muted-foreground">
                {/* Internal note: have the institution's Data Protection Officer or legal adviser review and approve this template before production use. */}
                <p>
                  <strong className="text-foreground">Information collected.</strong>{" "}
                  We collect the information you provide during registration, including
                  your name, email address, student number, program, section, and team
                  invite code. The system may also store account activity, uploaded
                  capstone files, comments, reviews, and related academic records.
                </p>
                <p>
                  <strong className="text-foreground">Purpose and lawful basis.</strong>{" "}
                  We process this information to create and secure your account,
                  connect you with your capstone team, manage submissions and reviews,
                  support collaboration, maintain academic records, and operate the
                  E-Capstone service. Processing should be based on the lawful basis
                  identified by the institution under the Data Privacy Act of 2012
                  (Republic Act No. 10173) and its implementing rules.
                </p>
                <p>
                  <strong className="text-foreground">Access and sharing.</strong>{" "}
                  Information is available only to authorized students, advisers,
                  instructors, administrators, and service providers who need it for
                  the purposes described above. We do not sell your personal
                  information. Disclosures required by law or institutional policy may
                  still apply.
                </p>
                <p>
                  <strong className="text-foreground">Storage and retention.</strong>{" "}
                  Records are stored using the systems configured by the institution
                  and retained only as long as reasonably necessary for academic,
                  operational, security, audit, or legal purposes, subject to the
                  institution&apos;s retention policy.
                </p>
                <p>
                  <strong className="text-foreground">Your rights.</strong>{" "}
                  Subject to applicable law and institutional procedures, you may
                  request access to, correction of, or information about the processing
                  of your personal data, and may raise concerns about its handling.
                  Contact the institution&apos;s Data Protection Officer or designated
                  privacy office for requests and complaints.
                </p>
                <p>
                  By selecting <strong className="text-foreground">I Understand and Agree</strong>,
                  you confirm that you have read this notice and consent to the
                  processing described above, to the extent consent is the applicable
                  lawful basis.
                </p>
              </div>

              <DialogFooter>
                <DialogClose asChild>
                  <Button type="button" variant="outline">Cancel</Button>
                </DialogClose>
                <Button
                  type="button"
                  onClick={() => {
                    setAcceptedDataPrivacy(true);
                    setPrivacyDialogOpen(false);
                  }}
                >
                  I Understand and Agree
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Button type="submit" disabled={loading} className="w-full flex items-center justify-center gap-1">
            {loading ? "Creating account..." : "Continue"}
            <ArrowRight className="h-3 w-3" />
          </Button>

          <p className="text-xs text-muted-foreground text-center">
            Already have an account?{" "}
            <Link href="/sign-in" className="text-primary hover:underline">Log in</Link>
          </p>
        </form>
      </div>
    </div>
  );
}