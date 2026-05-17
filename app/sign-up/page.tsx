"use client";

import { useEffect, useState } from "react";
import { useSignUp } from "@clerk/nextjs/legacy";
import { useClerk } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { useMutation, useAction, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowRight, EyeIcon, EyeOffIcon } from "lucide-react";
import Link from "next/link";
import { RefreshCwIcon } from "lucide-react"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Field, FieldLabel } from "@/components/ui/field"
import { InputOTP, InputOTPGroup, InputOTPSeparator, InputOTPSlot } from "@/components/ui/input-otp"

export default function SignUpPage() {
  const { isLoaded, signUp } = useSignUp();
  const { setActive, isSignedIn } = useClerk();
  const upsertUser = useMutation(api.users.upsertUser);
  const router = useRouter();

  const [step, setStep] = useState<"form" | "verify">("form");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [studentNo, setStudentNo] = useState("");
  const [program, setProgram] = useState("");
  const [section, setSection] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);


  //for code 
  const [verifyCode, setVerifyCode] = useState("");
  const [inviteCode, setInviteCode] = useState("");


  const joinTeamByInviteCode = useMutation(api.dashboard.joinTeamByInviteCode);


    const ValidateInviteCode = useQuery(api.dashboard.validateInviteCode, inviteCode ? { inviteCode } : "skip");

  useEffect(() => {
    if (isSignedIn) router.push("/dashboard/student");
  }, [isSignedIn]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isLoaded || !signUp) return;
    setError("");
    setLoading(true);

    try {
      if(!ValidateInviteCode) {
        setError("Invalid invite code.");
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
    setError("");
    setLoading(true);

    try {
      const result = await signUp.attemptEmailAddressVerification({ code: verifyCode });

      if (result.status === "complete") {
        await upsertUser({
          clerkId: result.createdUserId!,
          name: `${firstName} ${lastName}`,
          email,
          role: "student",
          studentNo,
          program,
          section,
          inviteCode,
        });

        await joinTeamByInviteCode({
          clerkId: result.createdUserId!,
          inviteCode,
        });

        await setActive({ session: result.createdSessionId });
        router.push("/dashboard/student");
      } else {
        setError("Verification incomplete. Please try again.");
      }
    } catch (err: any) {
      setError(err.errors?.[0]?.message ?? "Invalid code.");
    } finally {
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
                    disabled={loading}
                    onClick={() => signUp?.prepareEmailAddressVerification({ strategy: "email_code" })}
                  >
                    <RefreshCwIcon />
                    Resend Code
                  </Button>
                </div>

                <div className="flex justify-center mb-4 mt-2 px-6 md:px-2">
                  <InputOTP maxLength={6} id="otp-verification" value={verifyCode} onChange={(value) => setVerifyCode(value)}>
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
                {loading ? "Verifying..." : "Verify"}
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
            <div className="flex items-center gap-2 mb-6">
              <Input type={showPassword ? "text" : "password"} placeholder="Minimum 8 characters" onChange={(e) => setPassword(e.target.value)} required />
              <Button type="button" className="bg-card text-foreground hover:bg-accent" onClick={() => setShowPassword(prev => !prev)}>
                {showPassword ? <EyeOffIcon /> : <EyeIcon />}
              </Button>
            </div>
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
            <Label className="text-xs">Invite Code( not functional yet )</Label>
            <Input placeholder="e.g. ECAP-ABCD-EFGH" className="text-xs mb-3" onChange={(e) => setInviteCode(e.target.value.toUpperCase())} />
          </div>

          {error && <p className="text-red-500 text-sm">{error}</p>}

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