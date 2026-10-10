"use client";

import { useParams } from "next/navigation";
import Link from "next/link";
import { useMemo } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { computeProgress, CHAPTER_MAX } from "@/lib/progress";
import { chapterOf } from "@/lib/progress";
import { ArrowLeft, CalendarDays, CheckSquare, FileText, Mail, UserCheck, Users } from "lucide-react";

const BADGE_BASE =
  "inline-flex items-center justify-center rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap";

const initialsOf = (name?: string) =>
  (name ?? "")
    .split(" ")
    .filter(Boolean)
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

const formatDate = (dateStr: string) =>
  new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

const statusBadge = (status: string) => {
  if (status === "approved") return "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300";
  if (status === "under_review") return "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300";
  return "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300";
};
const statusLabel = (status: string) =>
  status === "approved" ? "Approved" : status === "under_review" ? "Under Review" : "Needs Revision";

const taskBadge = (status: string) => {
  if (status === "completed") return "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300";
  if (status === "in_progress") return "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300";
  return "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300";
};
const taskLabel = (status: string) =>
  status === "completed" ? "Completed" : status === "in_progress" ? "In Progress" : "Pending";

const barColor = (status: string | null) => {
  if (status === "approved") return "bg-green-600";
  if (status === "needs_revision") return "bg-amber-500";
  return "bg-blue-600";
};

export default function InstructorTeamPage() {
  const params = useParams<{ teamId: string }>();
  const teamId = params.teamId as Id<"capstoneProjects">;

  const me = useQuery(api.users.getMe);
  const myId = me?._id as string | undefined;

  const teams = useQuery(api.dashboard.getInstructorTeams, myId ? { instructorId: myId } : "skip");
  const team = teams?.find((t) => t._id === teamId);

  const members = useQuery(api.dashboard.getProjectMembers, team ? { capstoneProjectId: teamId } : "skip");
  const adviser = useQuery(api.dashboard.getProjectAdviser, team ? { capstoneProjectId: teamId } : "skip");
  const deliverables = useQuery(api.dashboard.getDeliverables, team ? { capstoneProjectId: teamId } : "skip");
  const tasks = useQuery(api.dashboard.getTasks, team ? { capstoneProjectId: teamId } : "skip");

  const progress = useMemo(() => computeProgress(deliverables ?? []), [deliverables]);

  const backLink = (
    <Link
      href="/dashboard/instructor"
      className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
    >
      <ArrowLeft className="h-4 w-4" /> Back to dashboard
    </Link>
  );

  if (teams === undefined) {
    return (
      <div className="min-h-[50vh] flex items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600" />
      </div>
    );
  }

  if (!team) {
    return (
      <div className="lg:px-5 space-y-4">
        {backLink}
        <div className="rounded-2xl border border-dashed bg-card py-12 text-center">
          <p className="font-medium text-foreground">Team not found</p>
          <p className="mt-1 text-sm text-muted-foreground">It may have been deleted, or it isn&apos;t one of your teams.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="lg:px-5 pb-8 space-y-6">
      {backLink}

      {/* Team + progress */}
      <div className="rounded-2xl border bg-card p-5 lg:p-6">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-xl lg:text-2xl font-semibold text-foreground leading-tight">{team.teamName}</h1>
            <p className="text-sm text-muted-foreground mt-1">{team.projectTitle}</p>
          </div>
          <div className="text-right shrink-0">
            <p className="text-3xl font-semibold text-foreground tabular-nums leading-none">{progress.total}%</p>
            <p className="text-xs text-muted-foreground mt-1">{progress.approved} of 5 chapters approved</p>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-5 gap-1.5">
          {progress.chapters.map((c) => (
            <div key={c.chapter}>
              <div className="h-2.5 overflow-hidden rounded-full bg-muted">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${barColor(c.status)}`}
                  style={{ width: `${(c.points / CHAPTER_MAX) * 100}%` }}
                />
              </div>
              <p className="mt-1 text-center text-[11px] text-muted-foreground">
                Ch {c.chapter} · {c.points}%
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Adviser + members */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5 items-start">
        <div>
          <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground mb-3">
            <UserCheck className="h-4 w-4 text-blue-600" /> Adviser
          </h2>
          <div className="rounded-2xl border bg-card p-4 lg:p-5">
            {adviser === undefined ? (
              <p className="text-sm text-muted-foreground animate-pulse">Loading...</p>
            ) : adviser === null ? (
              <p className="text-sm text-muted-foreground">No adviser assigned</p>
            ) : (
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-violet-100 text-sm font-semibold text-violet-700 dark:bg-violet-900/50 dark:text-violet-300">
                  {initialsOf(adviser.name)}
                </div>
                <div className="min-w-0">
                  <p className="text-sm lg:text-base font-medium text-foreground">{adviser.name}</p>
                  <p className="text-xs lg:text-sm text-muted-foreground capitalize">{adviser.role}</p>
                  <p className="flex items-center gap-1 text-xs lg:text-sm text-muted-foreground">
                    <Mail className="h-3.5 w-3.5 shrink-0" />
                    <span className="truncate">{adviser.email}</span>
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        <div>
          <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground mb-3">
            <Users className="h-4 w-4 text-blue-600" /> Team members
          </h2>
          <div className="rounded-2xl border bg-card p-4 lg:p-5">
            {members === undefined ? (
              <p className="text-sm text-muted-foreground animate-pulse">Loading members...</p>
            ) : members.length === 0 ? (
              <p className="text-sm text-muted-foreground">No team members found</p>
            ) : (
              <div className="flex flex-col divide-y">
                {members.map((m) => (
                  <div key={m._id} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-100 text-sm font-semibold text-blue-700 dark:bg-blue-900/50 dark:text-blue-300">
                      {initialsOf(m.name)}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm lg:text-base font-medium text-foreground truncate">{m.name}</p>
                      <p className="text-xs lg:text-sm text-muted-foreground truncate">{m.email}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Deliverables */}
      <div>
        <h2 className="text-lg font-semibold text-foreground mb-3">Deliverables</h2>
        {deliverables === undefined ? (
          <p className="text-sm text-muted-foreground animate-pulse">Loading...</p>
        ) : deliverables.length === 0 ? (
          <div className="rounded-2xl border border-dashed bg-card py-8 text-center text-sm text-muted-foreground">
            No deliverables yet
          </div>
        ) : (
          deliverables.map((d) => {
            const n = chapterOf(d.phase);
            const isOld = !!n && progress.chapters[n - 1].latestId !== d._id;
            return (
              <div
                key={d._id}
                className={`rounded-2xl border bg-card p-4 mb-3 ${isOld ? "opacity-60" : ""}`}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-green-100 text-green-600 dark:bg-green-900/50 dark:text-green-300">
                      <FileText className="h-6 w-6" />
                    </div>
                    <div className="min-w-0">
                      <h3 className="font-semibold text-foreground text-sm lg:text-base truncate">{d.fileName}</h3>
                      <p className="text-muted-foreground text-xs">
                        {d.phase} • Version {d.version}
                      </p>
                      <p className="text-muted-foreground text-xs mt-0.5">
                        {formatDate(d.uploadedAt)} • {d.fileSize}
                      </p>
                    </div>
                  </div>
                  <span className={`${BADGE_BASE} ${statusBadge(d.status)}`}>{statusLabel(d.status)}</span>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Tasks */}
      <div>
        <h2 className="text-lg font-semibold text-foreground mb-3">Tasks</h2>
        {tasks === undefined ? (
          <p className="text-sm text-muted-foreground animate-pulse">Loading...</p>
        ) : tasks.length === 0 ? (
          <div className="rounded-2xl border border-dashed bg-card py-8 text-center text-sm text-muted-foreground">
            No tasks assigned to this team
          </div>
        ) : (
          tasks.map((t) => (
            <div key={t._id} className="rounded-2xl border bg-card p-4 mb-3">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3 min-w-0">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-blue-100 text-blue-600 dark:bg-blue-900/50 dark:text-blue-300">
                    <CheckSquare className="h-6 w-6" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-semibold text-foreground text-sm lg:text-base">{t.title}</h3>
                    <p className="text-muted-foreground text-xs mt-0.5">{t.description}</p>
                    <p className="mt-2 inline-flex items-center gap-1 text-xs text-muted-foreground">
                      <CalendarDays className="h-3.5 w-3.5" /> Due {formatDate(t.dueDate)}
                    </p>
                  </div>
                </div>
                <span className={`${BADGE_BASE} ${taskBadge(t.status)}`}>{taskLabel(t.status)}</span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}