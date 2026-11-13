"use client";
import { Suspense } from "react";
import { useQuery } from "convex/react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowRight, Users } from "lucide-react";
import { api } from "@/convex/_generated/api";
import type { Doc, Id } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { AdviserTabsDemo } from "@/app/components/adviserDashboard-Tabs";
import { useTeamProgress } from "@/hooks/useTeamProgress";

const LIST_URL = "/team-management/adviser";

const initials = (name?: string) =>
  (name ?? "?")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((n) => n[0]?.toUpperCase())
    .join("");

function TeamCard({
  project,
  onOpen,
}: {
  project: Doc<"capstoneProjects">;
  onOpen: () => void;
}) {
  const members = useQuery(api.dashboard.getProjectMembers, {
    capstoneProjectId: project._id,
  });
  const deliverables = useQuery(api.dashboard.getDeliverables, {
    capstoneProjectId: project._id,
  });
  const progress = useTeamProgress(deliverables, project.progress ?? 0);

  const roleOf = (memberId: string) =>
    project.teamRoles?.find((r) => r.memberId === memberId)?.role ?? "Student";

  return (
    <div className="min-w-0 rounded-2xl border border-blue-200 bg-card p-4 shadow-sm sm:p-6 dark:border-blue-900">
      {/* Title row: team name on top, project title underneath */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col items-start gap-1.5">
          <h3 className="max-w-full wrapbreak-words text-lg font-bold text-foreground">{project.teamName}</h3>
          {project.projectTitle && (
            <span
              title={project.projectTitle}
              className="block max-w-full truncate rounded-full bg-blue-50 px-2.5 py-0.5 text-[11px] font-medium text-blue-600 dark:bg-blue-900/40 dark:text-blue-300"
            >
              {project.projectTitle}
            </span>
          )}
        </div>
        <Button
          size="sm"
          variant="ghost"
          onClick={onOpen}
          className="shrink-0 rounded-full bg-blue-50 px-4 text-xs font-medium text-blue-600 hover:bg-blue-100 dark:bg-blue-900/40 dark:text-blue-300"
        >
          Manage
        </Button>
      </div>

      {/* Phase + progress */}
      <div className="mt-4 border-t pt-4">
        <div className="flex items-center justify-between gap-2 text-sm">
          <span className="min-w-0 truncate text-muted-foreground">
            Phase: <span className="font-semibold text-foreground">{project.phase}</span>
          </span>
          <span className="shrink-0 font-semibold text-blue-600">{progress}%</span>
        </div>
        <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-muted">
          <div className="h-full rounded-full bg-blue-600 transition-all" style={{ width: `${progress}%` }} />
        </div>
      </div>

      {/* Members */}
      <div className="mt-4">
        <p className="text-sm font-medium text-foreground">Members ({members?.length ?? 0})</p>
        <div className="mt-2 rounded-xl border bg-muted/40 px-3">
          {members === undefined ? (
            <p className="py-3 text-xs text-muted-foreground">Loading...</p>
          ) : members.length === 0 ? (
            <p className="py-3 text-xs text-muted-foreground">No members yet.</p>
          ) : (
            members.map((m, i) => (
              <div
                key={m._id}
                className={`flex items-center justify-between gap-2 py-3 sm:gap-3 ${i > 0 ? "border-t" : ""}`}
              >
                <div className="flex min-w-0 items-center gap-2.5 sm:gap-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-900 text-[11px] font-semibold text-white">
                    {initials(m.name)}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-foreground">{m.name}</p>
                    <p className="truncate text-xs text-muted-foreground">{m.email}</p>
                  </div>
                </div>
                <span className="shrink-0 whitespace-nowrap rounded-md bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
                  {roleOf(m._id)}
                </span>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="mt-4 flex justify-end border-t pt-4 text-xs font-medium">
        <button onClick={onOpen} className="inline-flex items-center gap-1 text-blue-600 hover:underline">
          View Full Details <ArrowRight className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

function Content() {
  const router = useRouter();
  const params = useSearchParams();
  const projectId = params.get("projectId");

  const me = useQuery(api.users.getMe);
  const projects = useQuery(
    api.dashboard.getAdviserProjects,
    me?.clerkId ? { clerkId: me.clerkId } : "skip"
  );

  // Detail view (after "View Full Details")
  if (projectId) {
    return (
      <div className="p-4 sm:p-6">
        <AdviserTabsDemo
          capstoneProjectId={projectId as Id<"capstoneProjects">}
          onBack={() => router.push(LIST_URL)}
        />
      </div>
    );
  }

  // Teams list
  return (
    <div className="space-y-4 p-4 sm:space-y-5 sm:p-6">
      <div className="rounded-2xl border bg-card p-4 shadow-sm sm:p-6">
        <div className="mb-1.5 flex items-center gap-2 text-xs text-muted-foreground">
          <span className="rounded bg-blue-50 px-2 py-0.5 font-medium text-blue-600 dark:bg-blue-900/40 dark:text-blue-300">
            Module
          </span>
          <span>/</span>
          <span className="text-foreground">Team Management</span>
        </div>
        <h1 className="text-xl font-bold text-foreground sm:text-2xl">Assigned Teams &amp; Member Roster</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Oversee your capstone groups and review their progress in real time.
        </p>
      </div>

      {projects === undefined ? (
        <p className="py-6 text-center text-muted-foreground">Loading...</p>
      ) : projects.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed bg-card px-4 py-10 text-center">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-blue-100 text-blue-600 dark:bg-blue-900/50 dark:text-blue-300">
            <Users className="h-8 w-8" />
          </div>
          <h3 className="mb-1 text-base font-semibold text-foreground">No team assigned yet</h3>
          <p className="max-w-xs text-sm text-muted-foreground">
            You haven&apos;t been assigned to any capstone group yet. Check back later or contact your coordinator.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:gap-5 lg:grid-cols-2">
          {projects.map((p) => (
            <TeamCard
              key={p._id}
              project={p}
              onOpen={() => router.push(`${LIST_URL}?projectId=${p._id}`)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default function AdviserTeamManagementPage() {
  return (
    <Suspense fallback={null}>
      <Content />
    </Suspense>
  );
}