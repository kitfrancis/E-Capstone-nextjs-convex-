"use client";

import { useRouter } from "next/navigation";
import { useClerk } from "@clerk/nextjs";
import { Button } from "@/components/ui/button";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";

export default function Unauthorized() {
  const router = useRouter();
  const { signOut } = useClerk();

  const handleBack = async () => {
    await signOut();
    router.push("/");
  };

  return (
    <div className="flex items-center justify-center h-screen">
      <Empty>
        <EmptyHeader>
          <EmptyTitle className="text-3xl">401 - Unauthorized</EmptyTitle>
          <EmptyDescription className="text-lg">
            You are not authorized to access this page.
          </EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <Button onClick={handleBack}>Back to Landing Page</Button>
          <EmptyDescription>
            Need help? <a href="#">Contact support</a>
          </EmptyDescription>
        </EmptyContent>
      </Empty>
    </div>
  );
}