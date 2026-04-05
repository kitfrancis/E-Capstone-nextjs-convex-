// app/unauthorized/page.tsx
"use client";

import { useRouter } from "next/navigation";

import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group"
import { Kbd } from "@/components/ui/kbd"
import { Button } from "@/components/ui/button"

export default function Unauthorized() {
  const router = useRouter();

  return (
    <>
    <div className="flex items-center justify-center h-screen">
      <Empty>
      <EmptyHeader>
        <EmptyTitle className="text-3xl">401 - Unauthorized</EmptyTitle>
        <EmptyDescription className="text-lg">
          You are not authorized to access this page.
        </EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        
            <Button onClick={() => router.push("/")}>Back to Landing Page</Button>
        
        <EmptyDescription>
          Need help? <a href="#">Contact support</a>
        </EmptyDescription>
      </EmptyContent>
    </Empty>
    </div>
    </>
  );
}