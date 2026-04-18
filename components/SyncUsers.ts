"use client";

import { useUser } from "@clerk/nextjs";
import { useMutation, useQuery } from "convex/react"; 
import { api } from "@/convex/_generated/api";
import { useEffect } from "react";

type Role = "student" | "instructor" | "adviser";

export function SyncUser() {
  const { user, isSignedIn, isLoaded } = useUser();
  const me = useQuery(api.users.getMe);
  const upsertUser = useMutation(api.users.upsertUser);

  useEffect(() => {
    if (!isLoaded || !isSignedIn || !user || me === undefined) return;

     console.log("Clerk user:", {
    fullName: user.fullName,
    firstName: user.firstName,
    lastName: user.lastName,
    email: user.emailAddresses[0].emailAddress,
  });

    if (me === null) {
      const role = (user.publicMetadata?.role as Role) ?? "student";

     upsertUser({
  clerkId: user.id,
  name: user.fullName ?? 
        user.firstName ?? 
        user.username ?? 
        user.emailAddresses[0].emailAddress.split("@")[0], 
  email: user.emailAddresses[0].emailAddress,
  image: user.imageUrl,
  role,
});
    }
  }, [isLoaded, isSignedIn, user, me, upsertUser]);

  return null;
}