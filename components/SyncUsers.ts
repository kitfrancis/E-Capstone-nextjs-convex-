"use client";

import { useUser } from "@clerk/nextjs";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useEffect } from "react";

export function SyncUser() {
  const { user, isSignedIn, isLoaded } = useUser();
  const me = useQuery(api.users.getMe);
  const upsertUser = useMutation(api.users.upsertUser);

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