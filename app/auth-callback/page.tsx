"use client";

import { useUser } from "@clerk/nextjs";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

type Role = "student" | "instructor" | "adviser";

export default function AuthCallback() {
  const { user, isLoaded } = useUser();
  const me = useQuery(api.users.getMe);
  const upsertUser = useMutation(api.users.upsertUser);
  const router = useRouter();

  useEffect(() => {
    if (!isLoaded || !user || me === undefined) return;

    const intendedRole = sessionStorage.getItem("intendedRole") as Role | null;

    if (!intendedRole) {
      router.push("/");
      return;
    }

    const handle = async () => {
      if (!me) {
        // 🆕 New user — save with intended role
        await upsertUser({
          clerkId: user.id,
          name: user.fullName ?? "Unknown",
          email: user.emailAddresses[0].emailAddress,
          image: user.imageUrl,
          role: intendedRole,
        });
        sessionStorage.removeItem("intendedRole");
        router.push(`/dashboard/${intendedRole}`);
      } else {
        // 👤 Existing user — STRICTLY check role
        if (me.role !== intendedRole) {
          // ❌ Wrong role selected
          sessionStorage.removeItem("intendedRole");
          router.push("/unauthorized");
          return;
        }
        // ✅ Correct role
        sessionStorage.removeItem("intendedRole");
        router.push(`/dashboard/${me.role}`);
      }
    };

    handle();

  }, [isLoaded, user, me]);

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