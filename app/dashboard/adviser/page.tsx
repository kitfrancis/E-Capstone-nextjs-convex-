"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Users,
  Clock,
  CheckCircle2,
  RotateCcw,
  Mail,
  UserCheck,
  FileText,
  CheckSquare,
  ArrowRight,
  Target,
  BookOpen,
  Code2,
  GraduationCap,
  Lightbulb,
  Activity,
  Zap,
  ClipboardCheck,
} from "lucide-react";
import { Id } from "@/convex/_generated/dataModel";
import { AdviserTabsDemo } from "@/app/components/adviserDashboard-Tabs";

const initialsOf = (name?: string) =>
  (name ?? "")
    .split(" ")
    .filter(Boolean)
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

const goTo = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });

const timeAgo = (dateStr: string) => {
  const minutes = Math.floor((Date.now() - new Date(dateStr).getTime()) / 60000);
  if (isNaN(minutes)) return "";
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours > 1 ? "s" : ""} ago`;
  const days = Math.floor(hours / 24);
  return `${days} day${days > 1 ? "s" : ""} ago`;
};

const TEAM_STYLES = [
  { icon: Users, wrap: "bg-blue-100 text-blue-600 dark:bg-blue-900/50 dark:text-blue-300" },
  { icon: BookOpen, wrap: "bg-violet-100 text-violet-600 dark:bg-violet-900/50 dark:text-violet-300" },
  { icon: Code2, wrap: "bg-green-100 text-green-600 dark:bg-green-900/50 dark:text-green-300" },
  { icon: Lightbulb, wrap: "bg-amber-100 text-amber-600 dark:bg-amber-900/50 dark:text-amber-300" },
  { icon: GraduationCap, wrap: "bg-rose-100 text-rose-600 dark:bg-rose-900/50 dark:text-rose-300" },
];

const BADGE_BASE =
  "inline-flex items-center justify-center rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap";

// A team is "Not Started" at 0%, "Completed" at 100%, and "In Progress" in between
const statusOf = (progress: number) => {
  if (progress >= 100)
    return { key: "completed", label: "Completed", cls: "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300" };
  if (progress > 0)
    return { key: "in_progress", label: "In Progress", cls: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300" };
  return { key: "not_started", label: "Not Started", cls: "bg-muted text-muted-foreground" };
};

const GRID_COLS =
  "lg:grid lg:grid-cols-[minmax(0,2fr)_auto_repeat(3,minmax(0,0.8fr))_minmax(0,1.4fr)_auto] lg:items-center lg:gap-5";

type TeamFilter = "all" | "in_progress" | "completed";

function TeamRow({
  proj,
  index,
  selected,
  onView,
}: {
  proj: any;
  index: number;
  selected: boolean;
  onView: () => void;
}) {
  const id = proj._id as Id<"capstoneProjects">;
  const members = useQuery(api.dashboard.getProjectMembers, { capstoneProjectId: id });
  const deliverables = useQuery(api.dashboard.getDeliverables, { capstoneProjectId: id });
  const tasks = useQuery(api.dashboard.getTasks, { capstoneProjectId: id });

  const style = TEAM_STYLES[index % TEAM_STYLES.length];
  const TeamIcon = style.icon;
  const progress = proj.progress ?? 0;
  const status = statusOf(progress);
  const completedTasks = tasks?.filter((t) => t.status === "completed").length ?? 0;

  return (
    <div
      className={`rounded-2xl border bg-card p-4 transition-all hover:shadow-md ${
        selected ? "border-blue-500 ring-2 ring-blue-500/20" : "hover:border-blue-200 dark:hover:border-blue-900"
      }`}
    >
      <div className={`flex flex-col gap-4 ${GRID_COLS}`}>
        {/* Team and project */}
        <div className="flex items-center gap-3 min-w-0">
          <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full ${style.wrap}`}>
            <TeamIcon className="h-6 w-6" />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="font-semibold text-foreground text-sm lg:text-base truncate">{proj.teamName}</h3>
            <p className="text-muted-foreground text-xs truncate">{proj.projectTitle}</p>
          </div>
          <span className={`${BADGE_BASE} ${status.cls} lg:hidden`}>{status.label}</span>
        </div>

        <span className={`${BADGE_BASE} ${status.cls} hidden lg:inline-flex`}>{status.label}</span>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3 lg:contents">
          <div>
            <p className="flex items-center gap-1 text-xs text-muted-foreground">
              <Users className="h-3.5 w-3.5" /> Members
            </p>
            <p className="text-sm font-semibold text-foreground">{members === undefined ? "—" : members.length}</p>
          </div>
          <div>
            <p className="flex items-center gap-1 text-xs text-muted-foreground">
              <FileText className="h-3.5 w-3.5" /> Deliverables
            </p>
            <p className="text-sm font-semibold text-foreground">
              {deliverables === undefined ? "—" : deliverables.length}
            </p>
          </div>
          <div>
            <p className="flex items-center gap-1 text-xs text-muted-foreground">
              <CheckSquare className="h-3.5 w-3.5" /> Tasks
            </p>
            <p className="text-sm font-semibold text-foreground">
              {tasks === undefined ? "—" : `${completedTasks}/${tasks.length}`}
            </p>
          </div>
        </div>

        {/* Progress */}
        <div>
          <p className="text-xs text-muted-foreground mb-1 lg:hidden">Progress</p>
          <div className="flex items-center gap-2">
            <div className="h-2 flex-1 rounded-full bg-muted overflow-hidden">
              <div
                className={`h-2 rounded-full transition-all duration-500 ${progress >= 100 ? "bg-green-600" : "bg-blue-600"}`}
                style={{ width: `${progress}%` }}
              />
            </div>
            <span className="text-xs font-semibold text-foreground w-9 text-right">{progress}%</span>
          </div>
        </div>

        {/* Action */}
        <div className="flex justify-end">
          <Button
            size="sm"
            variant="outline"
            onClick={onView}
            className="rounded-full px-4 gap-1.5 border-blue-200 text-blue-700 hover:bg-blue-50 hover:text-blue-700 dark:border-blue-900 dark:text-blue-300 dark:hover:bg-blue-950/40"
          >
            View Team <ArrowRight className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    </div>
  );
}

export default function AdviserDashboard() {
  const me = useQuery(api.users.getMe);

  const adviserProjects = useQuery(
    api.dashboard.getAdviserProjects,
    me ? { clerkId: me.clerkId } : "skip"
  );

  // Track the selected team
  const [selectedTeamIndex, setSelectedTeamIndex] = useState<number>(0);
  const [teamFilter, setTeamFilter] = useState<TeamFilter>("all");

  const project =
    adviserProjects && adviserProjects.length > 0 ? adviserProjects[selectedTeamIndex] : null;

  const teamMembers = useQuery(
    api.dashboard.getProjectMembers,
    project ? { capstoneProjectId: project._id as Id<"capstoneProjects"> } : "skip"
  );
  const router = useRouter();

  const allTeams = useQuery(api.dashboard.getTeams, {});
  const allDeliverables = useQuery(api.dashboard.getAllDeliverables, {});

  const dashboardData = useQuery(
    api.dashboard.getDashboardData,
    project ? { capstoneProjectId: project._id as Id<"capstoneProjects"> } : "skip"
  );

  const teamsCount = adviserProjects?.length ?? 0;
  const waitingReview = allDeliverables?.filter((d) => d.status === "under_review").length ?? 0;
  const approved = allDeliverables?.filter((d) => d.status === "approved").length ?? 0;
  const needRevision = allDeliverables?.filter((d) => d.status === "needs_revision").length ?? 0;

  const visibleProjects = useMemo(() => {
    if (!adviserProjects) return [];
    return adviserProjects
      .map((proj, index) => ({ proj, index }))
      .filter(({ proj }) => {
        const key = statusOf(proj.progress ?? 0).key;
        if (teamFilter === "all") return true;
        return key === teamFilter;
      });
  }, [adviserProjects, teamFilter]);

  // Recent activity, built from the newest deliverables
  const recentActivity = useMemo(() => {
    if (!allDeliverables) return [];
    return [...allDeliverables]
      .sort((a: any, b: any) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime())
      .slice(0, 4)
      .map((d: any) => {
        const team = d.teamName ?? "A team";
        if (d.status === "approved")
          return { dot: "bg-green-500", text: `${team}'s ${d.fileName} was approved`, time: timeAgo(d.uploadedAt) };
        if (d.status === "needs_revision")
          return { dot: "bg-red-500", text: `${team} was asked to revise ${d.fileName}`, time: timeAgo(d.uploadedAt) };
        return { dot: "bg-amber-500", text: `${team} submitted a deliverable for review`, time: timeAgo(d.uploadedAt) };
      });
  }, [allDeliverables]);

  useEffect(() => {
    if (me === undefined) return;
    if (!me || me.role !== "adviser") {
      router.push("/unauthorized");
    }
  }, [me, router]);

  if (me === undefined) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
      </div>
    );
  }

  const firstName = me?.name?.split(" ")[0];

  const stats = [
    {
      label: "Teams under your supervision",
      value: allTeams === undefined ? "—" : teamsCount,
      icon: Users,
      linkText: "View Teams",
      target: "teams",
      card: "bg-blue-50 dark:bg-blue-950/30",
      iconWrap: "bg-blue-100 text-blue-600 dark:bg-blue-900/50 dark:text-blue-400",
      link: "text-blue-700 dark:text-blue-300",
    },
    {
      label: "Awaiting review",
      value: allDeliverables === undefined ? "—" : waitingReview,
      icon: FileText,
      linkText: "View Deliverables",
      target: "reviews",
      card: "bg-green-50 dark:bg-green-950/30",
      iconWrap: "bg-green-100 text-green-600 dark:bg-green-900/50 dark:text-green-400",
      link: "text-green-700 dark:text-green-300",
    },
    {
      label: "Approved",
      value: allDeliverables === undefined ? "—" : approved,
      icon: CheckCircle2,
      linkText: "View Approved",
      target: "reviews",
      card: "bg-amber-50 dark:bg-amber-950/30",
      iconWrap: "bg-amber-100 text-amber-600 dark:bg-amber-900/50 dark:text-amber-400",
      link: "text-amber-700 dark:text-amber-300",
    },
    {
      label: "Needs revision",
      value: allDeliverables === undefined ? "—" : needRevision,
      icon: RotateCcw,
      linkText: "View Revision",
      target: "reviews",
      card: "bg-red-50 dark:bg-red-950/30",
      iconWrap: "bg-red-100 text-red-600 dark:bg-red-900/50 dark:text-red-400",
      link: "text-red-700 dark:text-red-300",
    },
  ];

  const projectStats = [
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

  const quickActions = [
    {
      label: "View Teams",
      sub: "Manage your teams",
      icon: Users,
      target: "teams",
      card: "bg-blue-50 hover:bg-blue-100 dark:bg-blue-950/30 dark:hover:bg-blue-950/50",
      iconWrap: "bg-blue-100 text-blue-600 dark:bg-blue-900/50 dark:text-blue-400",
    },
    {
      label: "Review Deliverables",
      sub: "Check pending work",
      icon: FileText,
      target: "reviews",
      card: "bg-green-50 hover:bg-green-100 dark:bg-green-950/30 dark:hover:bg-green-950/50",
      iconWrap: "bg-green-100 text-green-600 dark:bg-green-900/50 dark:text-green-400",
    },
    {
      label: "Approve",
      sub: "Give final approval",
      icon: ClipboardCheck,
      target: "reviews",
      card: "bg-amber-50 hover:bg-amber-100 dark:bg-amber-950/30 dark:hover:bg-amber-950/50",
      iconWrap: "bg-amber-100 text-amber-600 dark:bg-amber-900/50 dark:text-amber-400",
    },
    {
      label: "View Revision",
      sub: "See what needs changes",
      icon: RotateCcw,
      target: "reviews",
      card: "bg-red-50 hover:bg-red-100 dark:bg-red-950/30 dark:hover:bg-red-950/50",
      iconWrap: "bg-red-100 text-red-600 dark:bg-red-900/50 dark:text-red-400",
    },
  ];

  const filterButtons: { label: string; value: TeamFilter }[] = [
    { label: "All", value: "all" },
    { label: "In Progress", value: "in_progress" },
    { label: "Completed", value: "completed" },
  ];

  return (
    <div className="scroll-smooth bg-background">
      <div className="lg:px-5 pb-8 space-y-6">
        {/* Greeting + role */}
        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_320px] gap-4">
          <div className="rounded-2xl bg-linear-to-r from-blue-100 via-blue-50 to-sky-100 dark:from-blue-950/60 dark:via-blue-950/30 dark:to-slate-900 p-6 lg:p-8 flex flex-col justify-center">
            <h1 className="text-2xl lg:text-3xl font-semibold text-foreground">
              Good day, {firstName ?? "Adviser"}! 👋
            </h1>
            <p className="text-sm lg:text-base text-muted-foreground mt-2">
              Monitor your teams, review deliverables, and guide your students to success.
            </p>
          </div>

          <div className="rounded-2xl bg-blue-50/70 dark:bg-blue-950/30 p-5 lg:p-6 flex items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-blue-100 text-blue-600 dark:bg-blue-900/50 dark:text-blue-300">
              <Target className="h-5 w-5" />
            </div>
            <div>
              <p className="font-semibold text-foreground">Your role</p>
              <p className="text-sm text-muted-foreground mt-1">
                Provide guidance, review progress, and help teams achieve their goals.
              </p>
            </div>
          </div>
        </div>

        {/* Overview stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4">
          {stats.map((s) => {
            const Icon = s.icon;
            return (
              <button
                key={s.label}
                type="button"
                onClick={() => goTo(s.target)}
                className={`${s.card} rounded-2xl p-4 lg:p-5 flex flex-col gap-3 text-left transition hover:shadow-md hover:-translate-y-0.5`}
              >
                <div className="flex items-center gap-3">
                  <div className={`${s.iconWrap} h-12 w-12 shrink-0 rounded-full flex items-center justify-center`}>
                    <Icon className="h-6 w-6" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-2xl lg:text-3xl font-semibold text-foreground leading-none">{s.value}</p>
                    <p className="text-xs lg:text-sm text-muted-foreground mt-1">{s.label}</p>
                  </div>
                </div>
                <span className={`${s.link} text-xs font-medium inline-flex items-center gap-1`}>
                  {s.linkText} <ArrowRight className="h-3 w-3" />
                </span>
              </button>
            );
          })}
        </div>

        {/* Your teams */}
        <div id="teams" className="scroll-mt-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between mb-4">
            <div>
              <h2 className="text-xl font-semibold text-foreground">Your teams</h2>
              <p className="text-sm text-muted-foreground">Manage and track the progress of your assigned teams.</p>
            </div>
            <div className="flex items-center gap-1 rounded-full bg-muted p-1 self-start sm:self-auto">
              {filterButtons.map((btn) => (
                <button
                  key={btn.value}
                  type="button"
                  onClick={() => setTeamFilter(btn.value)}
                  className={`rounded-full px-4 py-1.5 text-sm transition-colors ${
                    teamFilter === btn.value ? "bg-blue-600 text-white shadow" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {btn.label}
                </button>
              ))}
            </div>
          </div>

          {adviserProjects === undefined ? (
            <p className="text-sm text-muted-foreground animate-pulse">Loading teams...</p>
          ) : adviserProjects.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-center rounded-2xl border border-dashed bg-card">
              <Users className="h-12 w-12 text-muted-foreground/40 mb-3" />
              <p className="font-medium text-foreground">No teams assigned to you yet</p>
            </div>
          ) : visibleProjects.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-center rounded-2xl border border-dashed bg-card">
              <p className="font-medium text-foreground">No teams match this filter</p>
              <p className="text-sm text-muted-foreground mt-1">Try another filter above.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {/* Column labels (desktop) */}
              <div className={`hidden px-4 text-xs font-medium text-muted-foreground ${GRID_COLS}`}>
                <span>Team &amp; Project</span>
                <span>Status</span>
                <span>Members</span>
                <span>Deliverables</span>
                <span>Tasks</span>
                <span>Progress</span>
                <span className="text-right">Actions</span>
              </div>
              {visibleProjects.map(({ proj, index }) => (
                <TeamRow
                  key={proj._id}
                  proj={proj}
                  index={index}
                  selected={selectedTeamIndex === index}
                  onView={() => {
                    setSelectedTeamIndex(index);
                    goTo("team-detail");
                  }}
                />
              ))}
            </div>
          )}
        </div>

        {/* Recent activity + quick actions */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <div className="rounded-2xl border bg-card p-5">
            <div className="flex items-center gap-2 mb-4">
              <Activity className="h-4 w-4 text-blue-600" />
              <h2 className="text-sm font-semibold text-foreground">Recent activity</h2>
            </div>
            {allDeliverables === undefined ? (
              <p className="text-sm text-muted-foreground animate-pulse">Loading...</p>
            ) : recentActivity.length === 0 ? (
              <p className="text-sm text-muted-foreground">No recent activity yet.</p>
            ) : (
              <ul className="space-y-3">
                {recentActivity.map((item, i) => (
                  <li key={i} className="flex items-center gap-3 text-sm">
                    <span className={`h-2 w-2 shrink-0 rounded-full ${item.dot}`} />
                    <span className="flex-1 min-w-0 truncate text-foreground">{item.text}</span>
                    <span className="shrink-0 text-xs text-muted-foreground">{item.time}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="rounded-2xl border bg-card p-5">
            <div className="flex items-center gap-2 mb-4">
              <Zap className="h-4 w-4 text-blue-600" />
              <h2 className="text-sm font-semibold text-foreground">Quick actions</h2>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {quickActions.map((a) => {
                const Icon = a.icon;
                return (
                  <button
                    key={a.label}
                    type="button"
                    onClick={() => goTo(a.target)}
                    className={`${a.card} rounded-xl p-3 text-left transition-colors flex items-center gap-3`}
                  >
                    <div className={`${a.iconWrap} flex h-9 w-9 shrink-0 items-center justify-center rounded-full`}>
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-foreground truncate">{a.label}</p>
                      <p className="text-[11px] text-muted-foreground truncate">{a.sub}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Selected team detail */}
        {project && (
          <div id="team-detail" className="scroll-mt-4 space-y-5">
            <div className="rounded-2xl border bg-card p-5 lg:p-6">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="text-lg font-semibold text-foreground leading-tight">{project.teamName}</h2>
                  <p className="text-sm text-muted-foreground mt-1">{project.projectTitle}</p>
                </div>
                <span className="shrink-0 inline-flex items-center rounded-full bg-blue-600 px-2.5 py-0.5 text-xs font-medium text-white">
                  {project.phase}
                </span>
              </div>

              <div className="mt-5">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm text-muted-foreground">
                    Current phase: <span className="font-medium text-foreground">{project.phase}</span>
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
                {projectStats.map((s) => {
                  const Icon = s.icon;
                  return (
                    <div
                      key={s.label}
                      className={`${s.card} rounded-2xl p-3 lg:p-4 flex flex-col items-center text-center gap-2`}
                    >
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

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 items-start">
              <div>
                <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground mb-3">
                  <UserCheck className="h-4 w-4 text-blue-600" /> Adviser
                </h2>
                <div className="rounded-2xl border bg-card p-4 lg:p-5">
                  <div className="flex items-center gap-3">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-violet-100 text-sm font-semibold text-violet-700 dark:bg-violet-900/50 dark:text-violet-300">
                      {initialsOf(me?.name) || "?"}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm lg:text-base font-medium text-foreground truncate">{me?.name ?? "—"}</p>
                        <span className="rounded-full bg-blue-600 px-2 py-0.5 text-[10px] font-medium text-white">You</span>
                      </div>
                      <p className="text-xs lg:text-sm text-muted-foreground capitalize">{me?.role ?? "—"}</p>
                      <p className="flex items-center gap-1 text-xs lg:text-sm text-muted-foreground">
                        <Mail className="h-3.5 w-3.5 shrink-0" />
                        <span className="truncate">{me?.email ?? "—"}</span>
                      </p>
                    </div>
                  </div>
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
                            {initialsOf(member.name)}
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm lg:text-base font-medium text-foreground truncate">{member.name}</p>
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
          </div>
        )}

        {/* Tabs */}
        <div id="reviews" className="scroll-mt-4 w-full">
          <AdviserTabsDemo capstoneProjectId={project?._id} />
        </div>
      </div>
    </div>
  );
}