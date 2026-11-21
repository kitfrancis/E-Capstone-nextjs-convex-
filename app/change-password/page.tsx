"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useClerk } from "@clerk/nextjs";
import { useAction, useConvexAuth, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { getConvexErrorMessage } from "@/lib/convex-errors";
import { PRIVACY_NOTICE_VERSION } from "@/lib/privacy-consent";
import { DataPrivacyConsent } from "@/components/data-privacy-consent";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { EyeIcon, EyeOffIcon } from "lucide-react";

export default function ChangePasswordPage() {
  const router = useRouter();
  const { signOut } = useClerk();
  const { isAuthenticated, isLoading } = useConvexAuth();
  const me = useQuery(api.users.getMe, isAuthenticated ? {} : "skip");
  const changeInitialPassword = useAction(api.roster.changeInitialPassword);

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // Not signed in, or no account row: back to the landing page.
  // Already changed their password: on to their dashboard.
  useEffect(() => {
    if (isLoading) return;
    if (!isAuthenticated) {
      router.replace("/");
      return;
    }
    if (me === undefined) return;
    if (me === null) {
      router.replace("/");
      return;
    }
    if (me.mustChangePassword !== true) {
      router.replace(
        me.status === "pending" ? "/pending-approval" : `/dashboard/${me.role}`
      );
    }
  }, [isLoading, isAuthenticated, me, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (newPassword.length < 8) {
      setError("Your new password must be at least 8 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    if (!accepted) {
      setError("Please accept the data privacy consent to continue.");
      return;
    }

    setLoading(true);
    try {
      await changeInitialPassword({
        newPassword,
        privacyConsentVersion: PRIVACY_NOTICE_VERSION,
      });
      router.replace(`/dashboard/${me?.role ?? "student"}`);
    } catch (err) {
      setError(
        getConvexErrorMessage(
          err,
          "We couldn't change your password. Please try again."
        )
      );
      setLoading(false);
    }
  };

  if (isLoading || !me || me.mustChangePassword !== true) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-8">
      <Card className="w-full max-w-md">
        <CardHeader className="px-6 text-center sm:px-8">
          <CardTitle className="text-lg font-semibold">
            Set your password
          </CardTitle>
          <CardDescription className="text-sm">
            You signed in with a temporary password. Choose your own to
            continue.
          </CardDescription>
        </CardHeader>

        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4 px-6 pb-4 sm:px-8">
            <div className="space-y-1">
              <Label className="text-xs">New password</Label>
              <div className="flex items-center gap-2">
                <Input
                  type={showPassword ? "text" : "password"}
                  placeholder="Minimum 8 characters"
                  autoComplete="new-password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                />
                <Button
                  type="button"
                  className="bg-card text-foreground hover:bg-accent"
                  onClick={() => setShowPassword((prev) => !prev)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOffIcon /> : <EyeIcon />}
                </Button>
              </div>
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Confirm new password</Label>
              <Input
                type={showPassword ? "text" : "password"}
                placeholder="Re-enter your new password"
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
              />
            </div>

            <DataPrivacyConsent
              role="student"
              accepted={accepted}
              onAcceptedChange={setAccepted}
            />

            {error && (
              <p role="alert" className="text-sm text-red-500">
                {error}
              </p>
            )}
          </CardContent>

          <CardFooter className="flex flex-col gap-3 px-6 pb-6 sm:px-8">
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Saving..." : "Save password and continue"}
            </Button>
            <button
              type="button"
              className="text-xs text-muted-foreground underline underline-offset-4 hover:text-primary"
              onClick={() => signOut(() => router.replace("/"))}
            >
              Sign out
            </button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}