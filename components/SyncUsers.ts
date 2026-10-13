"use client";

import { useUser } from "@clerk/nextjs";
import { useConvexAuth, useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useRouter, usePathname } from "next/navigation";
import { useEffect } from "react";

export function SyncUser() {
  const { user, isSignedIn, isLoaded } = useUser();
  const { isAuthenticated } = useConvexAuth();
  const me = useQuery(api.users.getMe, isAuthenticated ? {} : "skip");
  const syncMe = useMutation(api.users.syncMe);
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

  // Keep email and avatar in step with Clerk. The server takes the email from
  // the verified token, so only the image is sent. Only calls the server when
  // something actually changed, so it can't loop.
  useEffect(() => {
    if (!isLoaded || !isSignedIn || !user || !me) return; // me === null: not registered yet

    const email = user.primaryEmailAddress?.emailAddress;
    const image = user.imageUrl;

    const emailChanged = !!email && email !== me.email;
    const imageChanged = !!image && image !== me.image;
    if (!emailChanged && !imageChanged) return;

    syncMe({ image: imageChanged ? image : undefined }).catch(() => {
      // Non-critical; it will retry on the next load
    });
  }, [isLoaded, isSignedIn, user, me, syncMe]);

  return null;
}