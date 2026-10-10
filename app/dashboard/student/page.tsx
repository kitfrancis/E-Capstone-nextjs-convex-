"use client";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { TabsDemo } from "@/app/components/dashboard-tabs";
import { Id } from "@/convex/_generated/dataModel";
import { useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  CheckCircle2,
  Clock,
  RotateCcw,
  Users,
  UserCheck,
  Mail,
  KeyRound,
  Loader2,
} from "lucide-react";

const initials = (name?: string) =>
  (name ?? "")
    .split(" ")
    .filter(Boolean)
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

function DashboardContent() {
  const searchParams = useSearchParams();
  const deliverableIdFromUrl = searchParams.get("deliverableId") as Id<"deliverables"> | null;
  const pageFromUrl = searchParams.get("page") || "1";
  const highlightPageFromUrl = pageFromUrl ? parseInt(pageFromUrl) : null;

  // join team by code
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const me = useQuery(api.users.getMe);
  const joinTeam = useMutation(api.dashboard.joinTeamByInviteCode);

  const project = useQuery(
    api.dashboard.getMyProject,
    me ? { clerkId: me.clerkId } : "skip"
  );
  const dashboardData = useQuery(
    api.dashboard.getDashboardData,
    project ? { capstoneProjectId: project._id as Id<"capstoneProjects"> } : "skip"
  );
  const teamMembers = useQuery(
    api.dashboard.getProjectMembers,
    project ? { capstoneProjectId: project._id as Id<"capstoneProjects"> } : "skip"
  );
  const projectAdviser = useQuery(
    api.dashboard.getProjectAdviser,
    project ? { capstoneProjectId: project._id as Id<"capstoneProjects"> } : "skip"
  );

  const handleJoin = async () => {
    const trimmed = code.trim().toUpperCase();
    if (!trimmed) {
      setError("Please enter an invite code.");
      return;
    }
    if (!me?.clerkId) {
      setError("Could not identify your account. Please try again.");
      return;
    }
    setIsLoading(true);
    setError("");
    try {
      await joinTeam({ clerkId: me.clerkId, inviteCode: trimmed });
    } catch {
      setError("Invalid invite code. Please check and try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const firstName = me?.name?.split(" ")[0];

  const stats = [
    {
      label: "Approved",
      value: dashboardData?.approvedCount ?? 0,
      icon: CheckCircle2,
      card: "bg-green-50 dark:bg-green-950/30",
      iconWrap: "bg-green-100 text-green-600 dark:bg-green-900/50 dark:text-green-400",
    },
    {
      label: "Under review",
      value: dashboardData?.underReviewCount ?? 0,
      icon: Clock,
      card: "bg-blue-50 dark:bg-blue-950/30",
      iconWrap: "bg-blue-100 text-blue-600 dark:bg-blue-900/50 dark:text-blue-400",
    },
    {
      label: "Needs revision",
      value: dashboardData?.needsRevisionCount ?? 0,
      icon: RotateCcw,
      card: "bg-amber-50 dark:bg-amber-950/30",
      iconWrap: "bg-amber-100 text-amber-600 dark:bg-amber-900/50 dark:text-amber-400",
    },
  ];

  return (
    <div className="scroll-smooth bg-background min-h-screen">
      <div className="lg:px-5 pb-8 space-y-6">
        {/* Greeting */}
        <div className="rounded-2xl bg-linear-to-r from-blue-100 via-blue-50 to-sky-100 dark:from-blue-950/60 dark:via-blue-950/30 dark:to-slate-900 p-6 lg:p-8">
          <h1 className="text-2xl lg:text-3xl font-semibold text-foreground">
            Welcome back,{" "}
            {me === undefined ? (
              <span className="text-muted-foreground">...</span>
            ) : (
              firstName ?? "—"
            )}
            !
          </h1>
          <p className="text-sm lg:text-base text-muted-foreground mt-2">
            Track your project progress and manage deliverables.
          </p>
        </div>

        {project === null ? (
          /* Not in a team yet */
          <div className="rounded-2xl border bg-card p-8 lg:p-10 flex flex-col items-center justify-center text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-blue-100 text-blue-600 dark:bg-blue-900/50 dark:text-blue-300 mb-4">
              <Users className="h-8 w-8" />
            </div>
            <h2 className="text-lg font-semibold text-foreground">You&apos;re not in a team yet</h2>
            <p className="text-sm text-muted-foreground max-w-sm mt-1">
              Enter the invite code your instructor gave you to join your capstone team.
            </p>

            <div className="flex flex-col items-center gap-2 w-full max-w-xs mt-5">
              <div className="relative w-full">
                <KeyRound className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  type="text"
                  placeholder="e.g. ECAP-XXXX-XXXX"
                  value={code}
                  onChange={(e) => {
                    setCode(e.target.value.toUpperCase());
                    setError("");
                  }}
                  onKeyDown={(e) => e.key === "Enter" && handleJoin()}
                  className="h-11 w-full rounded-xl pl-9 text-center font-mono tracking-widest text-sm"
                />
              </div>
              {error && <p className="text-xs text-red-500">{error}</p>}
              <Button
                onClick={handleJoin}
                disabled={isLoading || !me?.clerkId}
                className="h-11 w-full rounded-xl gap-2 bg-blue-600 text-white hover:bg-blue-700"
              >
                {isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
                {isLoading ? "Joining..." : "Join team"}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground mt-4">Don&apos;t have a code? Contact your instructor.</p>
          </div>
        ) : project === undefined ? (
          <div className="rounded-2xl border bg-card p-10 flex items-center justify-center">
            <p className="text-sm text-muted-foreground animate-pulse">Loading...</p>
          </div>
        ) : (
          <>
            {/* Project overview */}
            <div className="rounded-2xl border bg-card p-5 lg:p-6">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="text-lg font-semibold text-foreground leading-tight">{project.teamName}</h2>
                  <p className="text-sm text-muted-foreground mt-1">{project.projectTitle}</p>
                </div>
                <span className="shrink-0 inline-flex items-center gap-1 rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-700 dark:bg-green-900/40 dark:text-green-300">
                  <CheckCircle2 className="h-3.5 w-3.5" /> Enrolled
                </span>
              </div>

              <div className="mt-5">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm text-muted-foreground">
                    Current phase:{" "}
                    <span className="font-medium text-foreground">{project.phase}</span>
                  </p>
                  <span className="text-sm font-semibold text-foreground">{project.progress}%</span>
                </div>
                <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-2 rounded-full bg-blue-600 transition-all duration-500"
                    style={{ width: `${project.progress}%` }}
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3 mt-5">
                {stats.map((s) => {
                  const Icon = s.icon;
                  return (
                    <div key={s.label} className={`${s.card} rounded-2xl p-3 lg:p-4 flex flex-col items-center text-center gap-2`}>
                      <div className={`${s.iconWrap} flex h-9 w-9 lg:h-10 lg:w-10 items-center justify-center rounded-full`}>
                        <Icon className="h-4 w-4 lg:h-5 lg:w-5" />
                      </div>
                      <p className="text-2xl font-semibold text-foreground leading-none">{s.value}</p>
                      <p className="text-xs text-muted-foreground">{s.label}</p>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Adviser + members */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 items-start">
              <div>
                <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground mb-3">
                  <UserCheck className="h-4 w-4 text-blue-600" /> Adviser
                </h2>
                <div className="rounded-2xl border bg-card p-4 lg:p-5">
                  {projectAdviser === undefined ? (
                    <p className="text-sm text-muted-foreground animate-pulse">Loading...</p>
                  ) : projectAdviser === null ? (
                    <div className="flex items-center gap-3">
                      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
                        -
                      </div>
                      <p className="text-sm text-muted-foreground">No adviser assigned</p>
                    </div>
                  ) : (
                    <div className="flex items-center gap-3">
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-violet-100 text-sm font-semibold text-violet-700 dark:bg-violet-900/50 dark:text-violet-300">
                        {initials(projectAdviser.name)}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm lg:text-base font-medium text-foreground">{projectAdviser.name}</p>
                        <p className="text-xs lg:text-sm text-muted-foreground capitalize">{projectAdviser.role}</p>
                        <p className="flex items-center gap-1 text-xs lg:text-sm text-muted-foreground truncate">
                          <Mail className="h-3.5 w-3.5 shrink-0" />
                          <span className="truncate">{projectAdviser.email}</span>
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
                  {teamMembers === undefined ? (
                    <p className="text-sm text-muted-foreground animate-pulse">Loading members...</p>
                  ) : teamMembers.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No team members found</p>
                  ) : (
                    <div className="flex flex-col divide-y">
                      {teamMembers.map((member) => (
                        <div key={member._id} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-100 text-sm font-semibold text-blue-700 dark:bg-blue-900/50 dark:text-blue-300">
                            {initials(member.name)}
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="text-sm lg:text-base font-medium text-foreground truncate">{member.name}</p>
                              {me?._id === member._id && (
                                <span className="rounded-full bg-blue-600 px-2 py-0.5 text-[10px] font-medium text-white">
                                  You
                                </span>
                              )}
                            </div>
                            <p className="text-xs lg:text-sm text-muted-foreground capitalize">{member.role}</p>
                            <p className="text-xs lg:text-sm text-muted-foreground truncate">{member.email}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            <TabsDemo
              capstoneProjectId={project._id}
              highlightDeliverableId={deliverableIdFromUrl}
              highlightPage={highlightPageFromUrl}
            />
          </>
        )}
      </div>
    </div>
  );
}

export default function Dashboard() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center min-h-screen">
          <p className="text-sm text-muted-foreground animate-pulse">Loading...</p>
        </div>
      }
    >
      <DashboardContent />
    </Suspense>
  );
}