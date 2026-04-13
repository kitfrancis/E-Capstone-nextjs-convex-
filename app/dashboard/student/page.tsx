"use client";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { TabsDemo } from "@/app/components/dashboard-tabs";
 
export default function Dashboard() {
  const me = useQuery(api.users.getMe);
  const project = useQuery(
    api.dashboard.getMyProject,
    me ? { clerkId: me.clerkId } : "skip"
  );
 
  return (
    <div className="scroll-smooth font-Poppins bg-background min-h-screen">
      <div className="mx-3 px-3 lg:ml-1 lg:px-5 pb-10">
 
        {/* Header */}
        <div className="mt-10 mb-6">
          <h1 className="text-2xl font-semibold text-foreground">
            Welcome back,{" "}
            {me === undefined ? (
              <span className="text-muted-foreground">Loading...</span>
            ) : (
              me?.name ?? "—"
            )}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Track your project progress and manage deliverables.
          </p>
        </div>
 
        {/* Not in a team */}
        {project === null ? (
          <div className="border border-border rounded-2xl p-10 mt-4 flex flex-col items-center justify-center text-center gap-3 bg-muted/30">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-14 w-14 text-muted-foreground mb-1"
            >
              <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M22 21v-2a4 4 0 0 0-5-3.87" />
              <path d="M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
            <h2 className="text-lg font-semibold text-foreground">
              You're not in a team yet
            </h2>
            <p className="text-sm text-muted-foreground max-w-sm">
              You haven't been assigned to a capstone team. Please wait for
              your instructor to assign you, or contact your adviser.
            </p>
          </div>
 
        ) : project === undefined ? (
          <div className="border border-border rounded-2xl p-10 mt-4 flex items-center justify-center bg-muted/30">
            <p className="text-sm text-muted-foreground animate-pulse">Loading...</p>
          </div>
 
        ) : (
          <>
            <div className="border border-border rounded-2xl bg-card p-5 mb-6">
 
            
              <div className="flex items-start justify-between gap-3 mb-5">
                <div>
                  <h2 className="text-base font-semibold text-foreground leading-tight">
                    {project.teamName}
                  </h2>
                  <p className="text-sm text-muted-foreground mt-0.5">
                    {project.projectTitle}
                  </p>
                </div>
                <span className="shrink-0 text-xs px-2.5 py-1 rounded-full bg-green-50 dark:bg-green-950 text-green-700 dark:text-green-400 border border-green-200 dark:border-green-800">
                  Enrolled
                </span>
              </div>

              <div className="mb-5">
                <div className="flex justify-between items-center mb-2">
                  <p className="text-sm text-muted-foreground">
                    Current phase:{" "}
                    <span className="font-medium text-foreground">
                      {project.phase}
                    </span>
                  </p>
                  <span className="text-sm font-semibold text-foreground">
                    {project.progress}%
                  </span>
                </div>
                <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-1.5 rounded-full bg-violet-600 dark:bg-violet-500 transition-all duration-500"
                    style={{ width: `${project.progress}%` }}
                  />
                </div>
              </div>
 
              <div className="grid grid-cols-3 gap-3">
                <div className="rounded-xl bg-muted/60 p-3 text-center">
                <p className="text-xs text-muted-foreground mt-0.5">Approved</p>
                  <p className="text-xl font-semibold text-green-700 dark:text-green-400">
                    {project.approved}
                  </p>
                  
                </div>
                <div className="rounded-xl bg-muted/60 p-3 text-center">
                  <p className="text-xs text-muted-foreground mt-0.5">Under review</p>
                  <p className="text-xl font-semibold text-blue-700 dark:text-blue-400">
                    {project.underReview}
                  </p>
                </div>
                <div className="rounded-xl bg-muted/60 p-3 text-center">
                  <p className="text-xs text-muted-foreground mt-0.5">Needs revision</p>
                  <p className="text-xl font-semibold text-amber-700 dark:text-amber-400">
                    {project.needsRevision}
                  </p>
                </div>
              </div>
            </div>
 
            <TabsDemo capstoneProjectId={project._id} />
          </>
        )}
      </div>
    </div>
  );
}