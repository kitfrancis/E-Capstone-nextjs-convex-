"use client";

import { useUser } from "@clerk/nextjs";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useRouter, usePathname } from "next/navigation";
import { useEffect } from "react";

export function SyncUser() {
  const { user, isSignedIn, isLoaded } = useUser();
  const me = useQuery(api.users.getMe);
  const upsertUser = useMutation(api.users.upsertUser);
  const router = useRouter();
  const pathname = usePathname();

  // Accounts waiting for (or denied) admin approval can only see /pending-approval
  useEffect(() => {
    if (!isLoaded || !isSignedIn || !me) return;
    const blocked = me.status === "pending" || me.status === "rejected";
    if (blocked && pathname !== "/pending-approval") {
      router.replace("/pending-approval");
    }
  }, [isLoaded, isSignedIn, me, pathname, router]);

  useEffect(() => {
    if (!isLoaded || !isSignedIn || !user || me === undefined) return;

    // Admins are managed only in Convex; upsertUser doesn't accept "admin"
    if (me === null || me.role === "admin") return;

    upsertUser({
      clerkId: user.id,
      name:
        user.fullName ??
        user.firstName ??
        user.username ??
        user.emailAddresses[0].emailAddress.split("@")[0],
      email: user.emailAddresses[0].emailAddress,
      image: user.imageUrl,
      role: me.role,
      studentNo: me.studentNo,
      program: me.program,
      section: me.section,
    });
  }, [isLoaded, isSignedIn, user, me, upsertUser]);

  return null;
}