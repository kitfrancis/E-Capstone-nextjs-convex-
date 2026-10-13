"use client";

import { useUser, useClerk } from "@clerk/nextjs";
import { useQuery, useMutation, useConvexAuth } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";

type PublicRole = "student" | "instructor" | "adviser";
type Role = PublicRole | "admin";

export default function AuthCallback() {
  const { user, isLoaded } = useUser();
  const { signOut } = useClerk();
  const { isAuthenticated, isLoading } = useConvexAuth();
  const me = useQuery(api.users.getMe);
  const upsertUser = useMutation(api.users.upsertUser);
  const router = useRouter();
  const handled = useRef(false);

  useEffect(() => {
    // Wait until Convex has the Clerk token, or getMe returns a false null
    if (!isLoaded || !user || isLoading || !isAuthenticated) return;
    if (me === undefined) return;
    if (handled.current) return;

    const intendedRole = sessionStorage.getItem("intendedRole") as Role | null;

    if (!intendedRole) {
      router.replace("/");
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
        try {
          await upsertUser({
            clerkId: user.id,
            name: user.fullName ?? "Unknown",
            email: user.emailAddresses[0].emailAddress,
            image: user.imageUrl,
            role: intendedRole,
          });
        } catch (err) {
          console.error("upsertUser failed:", err);
          handled.current = false;
          return;
        }
        sessionStorage.removeItem("intendedRole");
        router.replace(`/dashboard/${intendedRole}`);
        return;
      }

      // ---------- EXISTING USER ----------
      sessionStorage.removeItem("intendedRole");
      if (me.role !== intendedRole) {
        router.replace("/unauthorized");
        return;
      }
      router.replace(`/dashboard/${me.role}`);
    };

    handle();
  }, [isLoaded, user, isLoading, isAuthenticated, me, router, upsertUser, signOut]);

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