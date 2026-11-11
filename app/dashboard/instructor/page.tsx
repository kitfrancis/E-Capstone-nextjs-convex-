"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useRouter } from "next/navigation";
import { useEffect, useMemo } from "react";
import { toast } from "sonner";
import {
  Users,
  AlertCircle,
  CalendarDays,
  ChevronRight,
  TrendingUp,
  Layers,
  Send,
  Download,
  Calendar,
  Award,
  Clock,
} from "lucide-react";

type PipelineTeam = {
  id: string;
  name: string;
  chapters: boolean[]; // [ch1, ch2, ch3, ch4, ch5] approved?
  preOralCleared: boolean;
  stage?: string;
};

const FINAL_DEFENSE_STAGES = ["final_revisions", "chapter_revisions", "ready_to_archive", "archived"];
const FINAL_REVISION_STAGES = ["ready_to_archive", "archived"];

// The 9 core stages shown in the pipeline
const STAGES: {
  title: string;
  done: (t: PipelineTeam) => boolean;
  bar: string;
}[] = [
  { title: "Chapter 1", done: (t) => t.chapters[0], bar: "bg-blue-500" },
  { title: "Chapter 2", done: (t) => t.chapters[1], bar: "bg-blue-500" },
  { title: "Chapter 3", done: (t) => t.chapters[2], bar: "bg-blue-500" },
  { title: "Pre-Oral Defense Cleared", done: (t) => t.preOralCleared, bar: "bg-indigo-500" },
  { title: "Chapter 4", done: (t) => t.chapters[3], bar: "bg-purple-500" },
  { title: "Chapter 5", done: (t) => t.chapters[4], bar: "bg-purple-500" },
  {
    title: "Final Defense Cleared",
    done: (t) => FINAL_DEFENSE_STAGES.includes(t.stage ?? ""),
    bar: "bg-violet-500",
  },
  {
    title: "Final Revisions Approved",
    done: (t) => FINAL_REVISION_STAGES.includes(t.stage ?? ""),
    bar: "bg-sky-500",
  },
  { title: "Archived", done: (t) => t.stage === "archived", bar: "bg-teal-500" },
];

// Edit these, or replace later with a query
const DEADLINES = [
  { tag: "Defense", title: "Pre-Oral Defense Schedule Upload", due: "Nov 08, 2026" },
  { tag: "Compliance", title: "Ethics & Institutional Review Sign-offs", due: "Nov 14, 2026" },
  { tag: "Archival", title: "Final Defense Hardcopy Manuscript Submission", due: "Dec 02, 2026" },
];

const pct = (done: number, total: number) => (total === 0 ? 0 : Math.floor((done / total) * 100));
const pct1 = (done: number, total: number) =>
  total === 0 ? "0.0" : (Math.floor((done / total) * 1000) / 10).toFixed(1);

export default function InstructorDashboard() {
  const me = useQuery(api.users.getMe);
  const myId = me?._id as string | undefined;
  const router = useRouter();

  const dashboardData = useQuery(
    api.dashboard.getInstructorDashboardData,
    myId ? { instructorId: myId } : "skip"
  );
  const pipeline = useQuery(
    api.dashboard.getInstructorPipeline,
    myId ? { instructorId: myId } : "skip"
  );

  useEffect(() => {
    if (me === undefined || me === null) return;
    if (me.role !== "instructor") router.push("/unauthorized");
  }, [me, router]);

  const teams = (pipeline ?? []) as PipelineTeam[];

  const stageRows = useMemo(
    () =>
      STAGES.map((s, i) => {
        const doneTeams = teams.filter(s.done);
        return {
          index: i + 1,
          title: s.title,
          bar: s.bar,
          done: doneTeams.length,
          total: teams.length,
          names: doneTeams.map((t) => t.name),
        };
      }),
    [teams]
  );

  if (me === undefined || dashboardData === undefined || pipeline === undefined) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
      </div>
    );
  }

  const firstName = me?.name?.split(" ")[0] ?? "";
  const total = teams.length;
  const preOral = teams.filter((t) => t.preOralCleared).length;
  const finalDefense = teams.filter((t) => FINAL_DEFENSE_STAGES.includes(t.stage ?? "")).length;
  const archived = teams.filter((t) => t.stage === "archived").length;

  const exportAnalytics = () => {
    const rows = [
      ["Stage", "Teams Done", "Total Teams", "Percent", "Teams"],
      ...stageRows.map((r) => [
        r.title,
        String(r.done),
        String(r.total),
        `${pct(r.done, r.total)}%`,
        r.names.join("; "),
      ]),
    ];
    const csv = rows.map((r) => r.map((c) => `"${c.replace(/"/g, '""')}"`).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8;" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "cohort-analytics.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const needsRevision = dashboardData.needsRevisionCount;
  const overdue = dashboardData.overdueTasks;

  const stats = [
    {
      label: "Total Capstone Teams",
      value: dashboardData.totalTeams,
      icon: Users,
      iconWrap: "bg-blue-50 text-blue-600 dark:bg-blue-950 dark:text-blue-300",
      badge: "Active",
      badgeCls: "bg-green-50 text-green-700 dark:bg-green-950/50 dark:text-green-300",
      badgeIcon: TrendingUp,
      linkText: "View team list",
      linkCls: "text-blue-600 dark:text-blue-400",
    },
    {
      label: "Needs Revision Items",
      value: needsRevision,
      icon: AlertCircle,
      iconWrap: "bg-purple-50 text-purple-600 dark:bg-purple-950 dark:text-purple-300",
      badge: needsRevision > 0 ? "Action Pending" : "All Clear",
      badgeCls:
        needsRevision > 0
          ? "bg-purple-50 text-purple-700 dark:bg-purple-950/50 dark:text-purple-300"
          : "bg-green-50 text-green-700 dark:bg-green-950/50 dark:text-green-300",
      badgeIcon: null,
      linkText: "View revisions",
      linkCls: "text-purple-600 dark:text-purple-400",
    },
    {
      label: "Overdue Tasks",
      value: overdue,
      icon: CalendarDays,
      iconWrap: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300",
      badge: overdue > 0 ? "Overdue" : "On Schedule",
      badgeCls:
        overdue > 0
          ? "bg-red-50 text-red-700 dark:bg-red-950/50 dark:text-red-300"
          : "bg-green-50 text-green-700 dark:bg-green-950/50 dark:text-green-300",
      badgeIcon: null,
      linkText: "View schedule",
      linkCls: "text-muted-foreground",
    },
  ];

  return (
    <div className="scroll-smooth bg-background">
      <div className="px-0 lg:px-5 pb-8 space-y-6">
        {/* Welcome banner */}
        <div className="rounded-2xl bg-linear-to-r from-blue-600 via-blue-600 to-indigo-600 p-6 lg:p-7 text-white flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="max-w-2xl">
            <h1 className="text-2xl lg:text-3xl font-bold">Good day, Prof. {firstName}! 👋</h1>
            <p className="text-sm lg:text-base text-white/85 mt-2">
              Here is your academic milestone progression and cohort analytics. Monitor adviser
              progress from Chapter 1 through Final Archival.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => toast.info("Announcements are coming soon.")}
              className="inline-flex items-center gap-2 rounded-lg border border-white/40 bg-white/10 px-4 py-2 text-sm font-medium hover:bg-white/20 transition-colors"
            >
              <Send className="h-4 w-4" /> Send Announcement
            </button>
            <button
              type="button"
              onClick={exportAnalytics}
              className="inline-flex items-center gap-2 rounded-lg bg-white px-4 py-2 text-sm font-medium text-blue-700 hover:bg-blue-50 transition-colors"
            >
              <Download className="h-4 w-4" /> Export Analytics
            </button>
          </div>
        </div>

        {/* Stat cards */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {stats.map((s) => {
            const Icon = s.icon;
            const BadgeIcon = s.badgeIcon;
            return (
              <button
                key={s.label}
                type="button"
                onClick={() => router.push("/team-management/instructor")}
                className="rounded-2xl border bg-card p-5 text-left shadow-xs transition hover:shadow-md hover:-translate-y-0.5"
              >
                <div className="flex items-start justify-between">
                  <div className={`flex h-11 w-11 items-center justify-center rounded-xl ${s.iconWrap}`}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <span
                    className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${s.badgeCls}`}
                  >
                    {BadgeIcon && <BadgeIcon className="h-3 w-3" />}
                    {s.badge}
                  </span>
                </div>
                <p className="mt-4 text-3xl font-bold text-foreground leading-none">{s.value}</p>
                <p className="mt-1 text-sm text-muted-foreground">{s.label}</p>
                <div className="mt-4 flex items-center justify-between border-t pt-3">
                  <span className={`text-xs font-medium ${s.linkCls}`}>{s.linkText}</span>
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </div>
              </button>
            );
          })}
        </div>

        <div className="grid gap-5 xl:grid-cols-[2fr_1fr]">
          {/* Cohort Milestone Progression Pipeline */}
          <div className="rounded-2xl border bg-card p-5 lg:p-6 shadow-xs">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <Layers className="mt-0.5 h-6 w-6 text-indigo-600 dark:text-indigo-400" />
                <div>
                  <h2 className="text-lg font-semibold text-foreground leading-tight">
                    Progress Overview
                  </h2>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Real-time status across {STAGES.length} core capstone defense stages
                  </p>
                </div>
              </div>
              <span className="shrink-0 rounded-full bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700 dark:bg-blue-950 dark:text-blue-300">
                {total} Advisory {total === 1 ? "Team" : "Teams"}
              </span>
            </div>

            {total === 0 ? (
              <div className="mt-6 rounded-xl border border-dashed py-12 text-center text-sm text-muted-foreground">
                No teams yet. Create a team in Team Management to see progress here.
              </div>
            ) : (
              <div className="mt-5 space-y-3">
                {stageRows.map((r) => {
                  const percent = pct(r.done, r.total);
                  const complete = r.done === r.total;
                  return (
                    <div key={r.title} className="rounded-xl bg-muted/40 px-4 py-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex min-w-0 items-start gap-3">
                          <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border bg-background text-xs font-medium text-muted-foreground">
                            {r.index}
                          </span>
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-foreground">{r.title}</p>
                            <p className="truncate text-[11px] text-muted-foreground">
                              {r.names.length > 0 ? `Teams: ${r.names.join(", ")}` : "No teams yet"}
                            </p>
                          </div>
                        </div>
                        <p className="shrink-0 text-xs font-semibold text-foreground">
                          {r.done} / {r.total} Teams{" "}
                          <span className="font-normal text-muted-foreground">({percent}%)</span>
                        </p>
                      </div>
                      <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${
                            complete ? "bg-emerald-500" : r.bar
                          }`}
                          style={{ width: `${percent}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="space-y-5">
            {/* Academic Deadlines */}
            <div className="rounded-2xl border bg-card p-5 shadow-xs">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Calendar className="h-5 w-5 text-blue-600" />
                  <h2 className="text-base font-semibold text-foreground">Academic Deadlines</h2>
                </div>
                <button
                  type="button"
                  onClick={() => router.push("/team-management/instructor")}
                  className="text-xs font-medium text-blue-600 hover:underline dark:text-blue-400"
                >
                  Calendar
                </button>
              </div>
              <div className="mt-4 space-y-3">
                {DEADLINES.map((d) => (
                  <div key={d.title} className="rounded-xl bg-muted/40 p-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="rounded-md bg-blue-100 px-2 py-0.5 text-[11px] font-medium text-blue-700 dark:bg-blue-950 dark:text-blue-300">
                        {d.tag}
                      </span>
                      <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                        <Clock className="h-3 w-3" /> Due {d.due}
                      </span>
                    </div>
                    <p className="mt-2 text-sm text-foreground">{d.title}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Cohort Clearance Overview */}
            <div className="rounded-2xl bg-indigo-950 p-5 text-white shadow-xs">
              <div className="flex items-center gap-2">
                <Award className="h-5 w-5 text-amber-400" />
                <h2 className="text-base font-semibold">Cohort Clearance Overview</h2>
              </div>
              <div className="mt-5 space-y-4 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-white/85">Pre-Oral Readiness</span>
                  <span className="font-semibold text-emerald-400">{pct1(preOral, total)}%</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-white/85">Final Defense Readiness</span>
                  <span className="font-semibold text-amber-400">{pct1(finalDefense, total)}%</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-white/85">Completed Archival</span>
                  <span className="font-semibold text-slate-300">{pct1(archived, total)}%</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}