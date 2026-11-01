"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Users } from "lucide-react";
import { TabsDemo } from "@/app/components/dashboard-tabs"; // adjust if you saved it elsewhere

function ManuscriptContent() {
  const searchParams = useSearchParams();
  const deliverableId = searchParams.get("deliverableId") as Id<"deliverables"> | null;
  const pageParam = searchParams.get("page");
  const section = searchParams.get("section");

  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  const meQuery = useQuery(api.users.getMe);
  const me = mounted ? meQuery : undefined;
  const projectQuery = useQuery(
    api.dashboard.getMyProject,
    me ? { clerkId: me.clerkId } : "skip"
  );
  const project = mounted ? projectQuery : undefined;

  // ?section=tasks jumps to the My Tasks card
  useEffect(() => {
    if (section === "tasks" && project) {
      document.getElementById("my-tasks")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [section, project]);

  if (project === undefined) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <p className="text-sm text-muted-foreground animate-pulse">Loading...</p>
      </div>
    );
  }

  if (project === null) {
    return (
      <div className="lg:px-5 pb-8">
        <div className="rounded-2xl border bg-card shadow-xs p-8 lg:p-10 flex flex-col items-center text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-blue-100 text-blue-600 dark:bg-blue-900/50 dark:text-blue-300 mb-4">
            <Users className="h-8 w-8" />
          </div>
          <h2 className="text-lg font-semibold text-foreground">Join your team first</h2>
          <p className="text-sm text-muted-foreground max-w-sm mt-1">
            You need to be in a capstone team before you can upload manuscripts or see tasks.
          </p>
          <Button asChild className="mt-5 rounded-lg bg-blue-600 text-white hover:bg-blue-700">
            <Link href="/dashboard/student">Go to Dashboard</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="lg:px-5 pb-8">
      <TabsDemo
        capstoneProjectId={project._id as Id<"capstoneProjects">}
        highlightDeliverableId={deliverableId}
        highlightPage={pageParam ? parseInt(pageParam) : null}
      />
    </div>
  );
}

export default function ManuscriptPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center min-h-[50vh]">
          <p className="text-sm text-muted-foreground animate-pulse">Loading...</p>
        </div>
      }
    >
      <ManuscriptContent />
    </Suspense>
  );
}