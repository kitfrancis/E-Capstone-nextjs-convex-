"use client";

import { useUser, useClerk } from "@clerk/nextjs";
import { useQuery, useMutation, useConvexAuth } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

const ROLES = ["student", "instructor", "adviser", "admin"] as const;
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

  useEffect(() => {
    if (!isLoaded || !user || isLoading || !isAuthenticated) return;
    if (me === undefined) return;
    if (handled.current) return;

    // Validate instead of casting: sessionStorage can hold anything.
    const raw = sessionStorage.getItem("intendedRole");
    const intendedRole: Role | null = ROLES.find((r) => r === raw) ?? null;

    // Where a registered user belongs.
    const destinationFor = (u: NonNullable<typeof me>) =>
      u.status === "pending" ? "/pending-approval" : `/dashboard/${u.role}`;

    if (!intendedRole) {
      router.replace(me ? destinationFor(me) : "/");
      return;
    }

    handled.current = true;

    const handle = async () => {
      // ---------- ADMIN ----------
      if (intendedRole === "admin") {
        sessionStorage.removeItem("intendedRole");

        if (!me) {
          await signOut(() => router.replace("/unauthorized"));
          return;
        }
        if (me.role !== "admin") {
          router.replace("/unauthorized");
          return;
        }
        router.replace("/dashboard/admin");
        return;
      }

      // ---------- NEW USER ----------
      if (!me) {
        // Students need extra fields (studentNo, inviteCode, program, section).
        if (intendedRole === "student") {
          sessionStorage.removeItem("intendedRole");
          router.replace("/sign-up/student");
          return;
        }

        // Instructor / adviser: registered as "pending" until an admin approves.
        try {
          await registerStaff({
            name: user.fullName ?? "Unknown",
            email: user.primaryEmailAddress?.emailAddress ?? "",
            role: intendedRole, // "instructor" | "adviser"
          });
        } catch (err) {
          console.error("registerStaff failed:", err);
          setError("We couldn't finish setting up your account.");
          handled.current = false;
          return; // keep intendedRole so a retry still works
        }

        sessionStorage.removeItem("intendedRole");
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