"use client";

import { Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

function NoAccountContent() {
  const email = useSearchParams().get("email");

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-8">
      <Card className="w-full max-w-md">
        <CardHeader className="px-6 text-center sm:px-8">
          <CardTitle className="w-full text-lg font-semibold">
            This account isn&apos;t registered in E-Capstone
          </CardTitle>
          <CardDescription className="mx-auto max-w-sm text-sm">
            {email ? (
              <>
                There is no E-Capstone account for{" "}
                <span className="break-all font-semibold">{email}</span>.
              </>
            ) : (
              "There is no E-Capstone account for the email you signed in with."
            )}
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-3 px-6 text-sm text-muted-foreground sm:px-8">
          <p>
            <span className="font-medium text-foreground">Students:</span> your
            instructor creates your account by importing the class roster. Ask
            them to add this exact email, then sign in with the temporary
            password they send you, or with Google using the same email.
          </p>
          <p>
            <span className="font-medium text-foreground">
              Advisers and instructors:
            </span>{" "}
            sign up first. Advisers wait for instructor approval; instructors
            wait for admin approval.
          </p>
        </CardContent>

        <CardFooter className="flex flex-col gap-3 px-6 pb-6 sm:px-8">
          <Button asChild className="w-full">
            <Link href="/sign-in?role=student">Back to sign in</Link>
          </Button>
          <Button asChild variant="outline" className="w-full">
            <Link href="/sign-up/clerk-signup?role=adviser">
              Adviser or instructor? Sign up
            </Link>
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}

export default function NoAccountPage() {
  return (
    <Suspense fallback={null}>
      <NoAccountContent />
    </Suspense>
  );
}