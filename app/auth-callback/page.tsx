"use client";

import { useUser, useClerk } from "@clerk/nextjs";
import { useQuery, useMutation, useConvexAuth } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { getConvexErrorMessage } from "@/lib/convex-errors";
import { DataPrivacyConsent } from "@/components/data-privacy-consent";
import { Button } from "@/components/ui/button";
import {
  PRIVACY_CONSENT_SESSION_KEY,
  PRIVACY_NOTICE_VERSION,
} from "@/lib/privacy-consent";
import { dashboardRouteForRole } from "@/lib/dashboard-routes";

const ROLES = ["student", "instructor", "adviser", "coordinator", "admin"] as const;
type Role = (typeof ROLES)[number];

export default function AuthCallback() {
  const { user, isLoaded } = useUser();
  const { signOut } = useClerk();
  const { isAuthenticated, isLoading } = useConvexAuth();

  // Don't run the query until Convex has the Clerk token, otherwise an
  // existing user can briefly look like a new one (me === null).
  const me = useQuery(api.users.getMe, isAuthenticated ? {} : "skip");

  const registerStaff = useMutation(api.users.registerStaff);
  const syncMe = useMutation(api.users.syncMe);

  const router = useRouter();
  const handled = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [registrationRole, setRegistrationRole] = useState<
    "instructor" | "adviser" | null
  >(null);
  const [privacyAccepted, setPrivacyAccepted] = useState(false);

  useEffect(() => {
    if (!isLoaded || !user || isLoading || !isAuthenticated) return;
    if (me === undefined) return;
    if (handled.current) return;

    // Validate instead of casting: sessionStorage can hold anything.
    const raw = sessionStorage.getItem("intendedRole");
    const intendedRole: Role | null = ROLES.find((r) => r === raw) ?? null;

    // Signed in with Clerk (for example Google) but there is no E-Capstone
    // account for them. Sign out and explain, instead of leaving a half-signed-in
    // session. A leftover Clerk user is harmless: the roster import reuses it.
    const noAccount = async (role?: Role) => {
      const email = user.primaryEmailAddress?.emailAddress ?? "";
      const params = new URLSearchParams({ email });
      if (role === "coordinator") params.set("role", role);
      await signOut(() =>
        router.replace(`/no-account?${params.toString()}`)
      );
    };

    // Where a registered user belongs.
    const destinationFor = (u: NonNullable<typeof me>) =>
      u.mustChangePassword
        ? "/change-password"
        : u.status === "pending"
          ? "/pending-approval"
          : dashboardRouteForRole(u.role);

    if (!intendedRole) {
      if (me) {
        router.replace(destinationFor(me));
        return;
      }
      handled.current = true;
      void noAccount();
      return;
    }

    handled.current = true;

    const handle = async () => {
      // These privileged roles are assigned by an admin, never self-registered.
      if (intendedRole === "admin" || intendedRole === "coordinator") {
        sessionStorage.removeItem("intendedRole");

        if (!me) {
          if (intendedRole === "coordinator") {
            await noAccount(intendedRole);
          } else {
            await signOut(() => router.replace("/unauthorized"));
          }
          return;
        }
        if (me.role !== intendedRole) {
          router.replace("/unauthorized");
          return;
        }
        if (me.status === "rejected") {
          await signOut(() => router.replace("/unauthorized"));
          return;
        }
        router.replace(destinationFor(me));
        return;
      }

      // ---------- NEW USER ----------
      if (!me) {
        // Students never register themselves: their account comes from the
        // instructor's roster import.
        if (intendedRole === "student") {
          sessionStorage.removeItem("intendedRole");
          await noAccount();
          return;
        }

        // Instructors await admin approval; advisers await instructor verification.
        const privacyConsentVersion = sessionStorage.getItem(
          PRIVACY_CONSENT_SESSION_KEY
        );
        if (privacyConsentVersion !== PRIVACY_NOTICE_VERSION) {
          setRegistrationRole(intendedRole);
          return;
        }

        try {
          await registerStaff({
            name: user.fullName ?? "Unknown",
            email: user.primaryEmailAddress?.emailAddress ?? "",
            role: intendedRole, // "instructor" | "adviser"
            privacyConsentVersion,
          });
        } catch (err) {
          console.error("registerStaff failed:", err);
          setError(
            getConvexErrorMessage(
              err,
              "We couldn't finish setting up your account."
            )
          );
          handled.current = false;
          return; // keep intendedRole so a retry still works
        }

        sessionStorage.removeItem("intendedRole");
        sessionStorage.removeItem(PRIVACY_CONSENT_SESSION_KEY);
        router.replace("/pending-approval");
        return;
      }

      // ---------- EXISTING USER ----------
      sessionStorage.removeItem("intendedRole");

      // Keep email/image in step with Clerk (server uses the verified identity).
      try {
        await syncMe({ image: user.imageUrl });
      } catch (err) {
        console.error("syncMe failed:", err);
      }

      if (me.role !== intendedRole) {
        router.replace("/unauthorized");
        return;
      }

      if (me.status === "rejected") {
        await signOut(() => router.replace("/unauthorized"));
        return;
      }

      router.replace(destinationFor(me));
    };

    handle();
  }, [
    isLoaded,
    user,
    isLoading,
    isAuthenticated,
    me,
    router,
    registerStaff,
    syncMe,
    signOut,
    attempt,
  ]);

  if (registrationRole) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100 px-4 py-8">
        <div className="w-full max-w-md space-y-4 rounded-lg bg-background p-6 shadow">
          <div className="space-y-2 text-center">
            <h1 className="text-lg font-semibold">Finish account setup</h1>
            <p className="text-sm text-muted-foreground">
              Review and accept the privacy notice to create your{" "}
              {registrationRole} account. It will be pending{" "}
              {registrationRole === "adviser" ? "instructor" : "admin"} approval.
            </p>
          </div>
          <DataPrivacyConsent
            role={registrationRole}
            accepted={privacyAccepted}
            onAcceptedChange={setPrivacyAccepted}
          />
          <Button
            className="w-full"
            disabled={!privacyAccepted}
            onClick={() => {
              sessionStorage.setItem(
                PRIVACY_CONSENT_SESSION_KEY,
                PRIVACY_NOTICE_VERSION
              );
              setRegistrationRole(null);
              handled.current = false;
              setAttempt((n) => n + 1);
            }}
          >
            Continue
          </Button>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="text-center">
          <p className="text-red-600 font-medium">{error}</p>
          <button
            className="mt-4 rounded bg-blue-600 px-4 py-2 text-white"
            onClick={() => {
              setError(null);
              setAttempt((n) => n + 1);
            }}
          >
            Try again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto" />
        <p className="mt-4 text-gray-600 font-medium animate-pulse">
          Verifying your role...
        </p>
      </div>
    </div>
  );
}