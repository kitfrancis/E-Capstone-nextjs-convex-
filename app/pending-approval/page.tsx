"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useClerk } from "@clerk/nextjs";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty";

export default function PendingApproval() {
  const router = useRouter();
  const { signOut } = useClerk();
  const me = useQuery(api.users.getMe);

  // Approved while waiting: go straight to the dashboard
  useEffect(() => {
    if (me && me.status !== "pending" && me.status !== "rejected") {
      router.replace(`/dashboard/${me.role}`);
    }
  }, [me, router]);

  const rejected = me?.status === "rejected";

  return (
    <div className="flex h-screen items-center justify-center">
      <Empty>
        <EmptyHeader>
          <EmptyTitle className="text-3xl">
            {rejected ? "Account not approved" : "Waiting for approval"}
          </EmptyTitle>
          <EmptyDescription className="text-lg">
            {rejected
              ? "An administrator did not approve this account. Contact your administrator if you think this is a mistake."
              : "Your account was created. An administrator needs to verify it before you can access the system. This page updates automatically once you're approved."}
          </EmptyDescription>
          {me?.email && (
            <EmptyDescription>Signed in as {me.email}</EmptyDescription>
          )}
        </EmptyHeader>
        <EmptyContent>
          <Button onClick={() => signOut({ redirectUrl: "/" })}>
            Sign out
          </Button>
        </EmptyContent>
      </Empty>
    </div>
  );
}