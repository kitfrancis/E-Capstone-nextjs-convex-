"use client";

import { useUser } from "@clerk/nextjs";
import { useMutation, useQuery } from "convex/react"; // Added useQuery
import { api } from "@/convex/_generated/api";
import { useEffect } from "react";

type Role = "student" | "instructor" | "adviser";

export function SyncUser() {
  const { user, isSignedIn, isLoaded } = useUser();
  const me = useQuery(api.users.getMe); // Check if Convex already has the user
  const upsertUser = useMutation(api.users.upsertUser);

  useEffect(() => {
    // Only proceed if Clerk is loaded/signed in AND Convex has finished its check
    if (!isLoaded || !isSignedIn || !user || me === undefined) return;

    // ONLY run the mutation if the user is NOT in the Convex database yet
    if (me === null) {
      const role = (user.publicMetadata?.role as Role) ?? "student";

      upsertUser({
        clerkId: user.id,
        name: user.fullName ?? "Unknown",
        email: user.emailAddresses[0].emailAddress,
        image: user.imageUrl, 
        role,
      });
    }
  }, [isLoaded, isSignedIn, user, me, upsertUser]);

  return null;
}