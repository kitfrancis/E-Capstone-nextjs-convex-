"use client";
import { useState, useMemo } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import type { Doc } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useUser } from "@clerk/nextjs";
import { toast } from "sonner";
import {
  Check,
  Copy,
  Key,
  MoreVertical,
  Plus,
  Users,
  FileText,
  CheckSquare,
  BookOpen,
  Code2,
  GraduationCap,
  Lightbulb,
  ArrowRight,
  CalendarDays,
  RotateCcw,
} from "lucide-react";
import { EditTask } from "@/app/components/editTask";
// NOTE: adjust these two paths to wherever your dialogs live
import { DialogDemo as CreateTeamDialog } from "@/app/components/createTeam";
import { TaskDialogDemo as CreateTaskDialog } from "@/app/components/createTask";
// NOTE: adjust this path to wherever deleteTask.tsx lives in your project
import { DeleteTask } from "@/app/components/deleteTask";
import { InstructorProgress } from "@/app/components/TeamsProgress";
import { EditTeam } from "@/app/components/editTeam";
import { DeleteTeam } from "@/app/components/deleteTeam";
import { InstructorTeamDetailsDialog } from "@/app/components/instructor-team-details-dialog";
import {
  DefenseActionButton,
  defenseActionKind,
  defenseStatus,
} from "@/app/components/defense-actions";
import { computeProgress } from "@/lib/progress";
import dynamic from "next/dynamic";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";

const PDFViewer = dynamic(
  () => import("@/app/components/PDFViewer").then((mod) => ({ default: mod.PDFViewer })),
  { ssr: false, loading: () => <div>Loading PDF viewer...</div> }
);

const OnlyOfficeEditor = dynamic(
  () => import("@/app/components/editor/document-editor"),
  { ssr: false }
);

const isPdf = (fileName: string) => fileName.toLowerCase().endsWith(".pdf");

type SubmissionFilter = "all" | "under_review" | "needs_revision" | "approved";
type TaskFilter = "all" | "overdue" | "under_review";
type TeamTab = "active" | "archived";

// How many rows each card shows before "View all"
const TEAM_PREVIEW = 5;
const SIDE_PREVIEW = 3;

// Icon + color combos, cycled per team row
const TEAM_STYLES = [
  { icon: Users, wrap: "bg-blue-100 text-blue-600 dark:bg-blue-900/50 dark:text-blue-300" },
  { icon: BookOpen, wrap: "bg-violet-100 text-violet-600 dark:bg-violet-900/50 dark:text-violet-300" },
  { icon: Code2, wrap: "bg-green-100 text-green-600 dark:bg-green-900/50 dark:text-green-300" },
  { icon: Lightbulb, wrap: "bg-amber-100 text-amber-600 dark:bg-amber-900/50 dark:text-amber-300" },
  { icon: GraduationCap, wrap: "bg-rose-100 text-rose-600 dark:bg-rose-900/50 dark:text-rose-300" },
];

const BADGE_BASE =
  "inline-flex items-center justify-center rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap";

// Icon buttons: bigger tap target on phones, compact from sm up
const ICON_BTN = "rounded-md p-2.5 transition-colors hover:bg-muted sm:p-1.5";

/* ---------- Date helpers ----------
   "2026-11-25" is parsed as UTC by `new Date()`, which shows the wrong day in
   some time zones. Date-only strings are parsed as local dates instead. */
const parseDate = (s: string) =>
  /^\d{4}-\d{2}-\d{2}$/.test(s) ? new Date(`${s}T00:00:00`) : new Date(s);

const formatDate = (dateStr: string) =>
  parseDate(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

// A task is overdue only after the end of its due day
const isOverdue = (t: { dueDate: string; status: string }) => {
  const due = parseDate(t.dueDate);
  due.setHours(23, 59, 59, 999);
  return t.status !== "completed" && due.getTime() < Date.now();
};

const daysUntil = (dateStr: string) => {
  const due = parseDate(dateStr);
  due.setHours(0, 0, 0, 0);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((due.getTime() - today.getTime()) / 86_400_000);
};

const dueLabel = (dateStr: string) => {
  const n = daysUntil(dateStr);
  if (n < 0) return `${-n} ${-n === 1 ? "day" : "days"} overdue`;
  if (n === 0) return "due today";
  if (n === 1) return "due tomorrow";
  return `in ${n} days`;
};

// TODO: adjust to however your schema marks an archived team
const isArchivedTeam = (team: Doc<"capstoneProjects">) => {
  const t = team as unknown as { archived?: boolean; status?: string };
  return Boolean(t.archived) || t.status === "archived";
};

function FilterChips<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { label: string; value: T; count?: number }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          aria-pressed={value === o.value}
          onClick={() => onChange(o.value)}
          className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
            value === o.value
              ? "border-blue-600 bg-blue-600 text-white"
              : "bg-card text-muted-foreground hover:text-foreground"
          }`}
        >
          {o.label}
          {o.count !== undefined && <span className="ml-1.5 opacity-70">{o.count}</span>}
        </button>
      ))}
    </div>
  );
}

function TeamSelect({
  teams,
  value,
  onChange,
}: {
  teams: { _id: string; teamName: string }[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="h-9 w-full rounded-full text-xs" aria-label="Filter by team">
        <SelectValue placeholder="All teams" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all" className="text-xs">
          All teams
        </SelectItem>
        {teams.map((t) => (
          <SelectItem key={t._id} value={t._id} className="text-xs">
            {t.teamName}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

// Section card: heading + description + optional action
function Section({
  title,
  description,
  action,
  children,
}: {
  title: string;
  description: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="min-w-0 rounded-2xl border bg-card p-4 sm:p-5">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-xl font-semibold text-foreground">{title}</h2>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

function ViewAllLink({
  expanded,
  onClick,
  label = "View all",
}: {
  expanded: boolean;
  onClick: () => void;
  label?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="shrink-0 text-sm font-medium text-blue-600 hover:underline"
    >
      {expanded ? "Show less" : label}
    </button>
  );
}

export default function InstructorTeamManagementPage() {
  const { user } = useUser();
  const me = useQuery(api.users.getMe);
  const myId = me?._id as string | undefined;

  const [submissionFilter, setSubmissionFilter] = useState<SubmissionFilter>("all");
  const [taskFilter, setTaskFilter] = useState<TaskFilter>("all");
  const [teamTab, setTeamTab] = useState<TeamTab>("active");

  // Team filter shared by the Submissions and Tasks cards ("all" or a team id)
  const [teamFilter, setTeamFilter] = useState<string>("all");

  // "View all" toggles
  const [showAllTeams, setShowAllTeams] = useState(false);
  const [showAllSubmissions, setShowAllSubmissions] = useState(false);
  const [showAllTasks, setShowAllTasks] = useState(false);

  // PDF viewer
  const [selectedDeliverable, setSelectedDeliverable] = useState<{
    fileName: string;
    storageId: string;
    deliverableId: string;
  } | null>(null);
  const fileUrl = useQuery(
    api.dashboard.getFileUrl,
    selectedDeliverable ? { storageId: selectedDeliverable.storageId as Id<"_storage"> } : "skip"
  );

  // OnlyOffice editor (comment-only mode)
  const [officeDoc, setOfficeDoc] = useState<{
    fileName: string;
    storageId: string;
    deliverableId: string;
  } | null>(null);
  const officeUrl = useQuery(
    api.dashboard.getFileUrl,
    officeDoc ? { storageId: officeDoc.storageId as Id<"_storage"> } : "skip"
  );

  // Invite code
  const [copiedTeamId, setCopiedTeamId] = useState<string | null>(null);
  const [viewingTeam, setViewingTeam] = useState<Doc<"capstoneProjects"> | null>(null);

  const copyInviteCode = (code: string, teamId: string) => {
    navigator.clipboard.writeText(code);
    setCopiedTeamId(teamId);
    setTimeout(() => setCopiedTeamId(null), 2000);
  };

  const reviewTask = useMutation(api.dashboard.reviewTask);
  const handleReview = async (taskId: Id<"tasks">, decision: "confirm" | "revise") => {
    try {
      await reviewTask({ taskId, decision });
      toast.success(decision === "confirm" ? "Task confirmed." : "Task sent back to the team.");
    } catch (err) {
      console.error(err);
      toast.error("Couldn't update the task. Try again.");
    }
  };

  const updateStatus = useMutation(api.dashboard.adviserDeliverableStatus);
  const handleStatus = async (
    deliverableId: Id<"deliverables">,
    status: "approved" | "needs_revision"
  ) => {
    try {
      await updateStatus({ deliverableId, status });
      toast.success(
        status === "approved" ? "Deliverable approved." : "Sent back to the team for revision."
      );
    } catch (err) {
      console.error(err);
      toast.error(err instanceof Error ? err.message : "Couldn't update the deliverable.");
    }
  };

  const allDeliverables = useQuery(
    api.dashboard.getInstructorDeliverables,
    myId ? { instructorId: myId } : "skip"
  );
  const allTeams = useQuery(
    api.dashboard.getInstructorTeams,
    myId ? { instructorId: myId } : "skip"
  );
  const tasks = useQuery(api.dashboard.getInstructorTasks, myId ? { instructorId: myId } : "skip");

  const progressByTeam = useMemo(() => {
    const map = new Map<string, number>();
    if (!allTeams) return map;
    for (const team of allTeams) {
      const items = (allDeliverables ?? []).filter((d) => d.capstoneProjectId === team._id);
      map.set(team._id, computeProgress(items).total);
    }
    return map;
  }, [allTeams, allDeliverables]);

  // If the selected team no longer exists (e.g. it was deleted), fall back to all teams
  const activeTeam =
    teamFilter === "all" || allTeams?.some((t) => t._id === teamFilter) ? teamFilter : "all";
  const inTeam = (id?: string) => activeTeam === "all" || id === activeTeam;

  // Team-scoped lists feed every count and list below
  const scopedDeliverables = allDeliverables?.filter((d) => inTeam(d.capstoneProjectId));
  const scopedTasks = tasks?.filter((t) => inTeam(t.capstoneProjectId));

  // Newest upload first; if two share a timestamp, the higher version goes first
  const filteredDeliverables = scopedDeliverables
    ?.filter((d) => submissionFilter === "all" || d.status === submissionFilter)
    .sort(
      (a, b) =>
        new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime() ||
        Number(b.version) - Number(a.version)
    );
  const shownDeliverables = showAllSubmissions
    ? filteredDeliverables
    : filteredDeliverables?.slice(0, SIDE_PREVIEW);
  const countStatus = (s: string) => scopedDeliverables?.filter((d) => d.status === s).length ?? 0;

  // Tasks waiting for the instructor go first
  const filteredTasks = scopedTasks
    ?.filter(
      (t) =>
        taskFilter === "all" ||
        (taskFilter === "overdue" && isOverdue(t)) ||
        (taskFilter === "under_review" && t.status === "under_review")
    )
    .sort((a, b) => Number(b.status === "under_review") - Number(a.status === "under_review"));
  const shownTasks = showAllTasks ? filteredTasks : filteredTasks?.slice(0, SIDE_PREVIEW);
  const overdueCount = scopedTasks?.filter(isOverdue).length ?? 0;
  const reviewCount = scopedTasks?.filter((t) => t.status === "under_review").length ?? 0;

  // Teams: Active / Archived tabs
  const teamIsArchived = (t: Doc<"capstoneProjects">) =>
    isArchivedTeam(t) || defenseStatus(t, progressByTeam.get(t._id) ?? 0)?.label === "Archived";
  const activeTeams = allTeams?.filter((t) => !teamIsArchived(t)) ?? [];
  const archivedTeams = allTeams?.filter(teamIsArchived) ?? [];
  const tabTeams = teamTab === "active" ? activeTeams : archivedTeams;
  const shownTeams = showAllTeams ? tabTeams : tabTeams.slice(0, TEAM_PREVIEW);

  // Header summary: everything waiting on the instructor
  const waitingSubmissions = allDeliverables?.filter((d) => d.status === "under_review").length ?? 0;
  const waitingTasks = tasks?.filter((t) => t.status === "under_review").length ?? 0;
  const waitingTotal = waitingSubmissions + waitingTasks;

  const getStatusBadge = (status: string) => {
    if (status === "approved") return "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300";
    if (status === "under_review") return "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300";
    return "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300";
  };

  const getStatusLabel = (status: string) => {
    if (status === "approved") return "Approved";
    if (status === "under_review") return "Under Review";
    return "Needs Revision";
  };

  const getTaskBadge = (status: string) => {
    if (status === "completed") return "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300";
    if (status === "in_progress") return "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300";
    if (status === "under_review") return "bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300";
    if (status === "needs_revision") return "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300";
    return "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300";
  };

  const getTaskLabel = (status: string) => {
    if (status === "completed") return "Completed";
    if (status === "in_progress") return "In Progress";
    if (status === "under_review") return "Under Review";
    if (status === "needs_revision") return "Needs Revision";
    return "Pending";
  };

  const rowClass =
    "min-w-0 rounded-2xl border bg-card p-3 sm:p-4 transition-all hover:shadow-md hover:border-blue-200 dark:hover:border-blue-900";
  const filterBarClass = "mb-4 flex flex-col gap-3";

  return (
    <div className="w-full min-w-0 p-4 sm:p-6 lg:p-8">
      {/* Page header */}
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-foreground sm:text-3xl">Team Management</h1>
          {allDeliverables !== undefined && tasks !== undefined && (
            <p className="mt-1 text-sm text-muted-foreground">
              {waitingTotal === 0
                ? "You're all caught up. Nothing is waiting for your review."
                : `${waitingTotal} ${waitingTotal === 1 ? "item needs" : "items need"} your review: ${waitingSubmissions} ${
                    waitingSubmissions === 1 ? "submission" : "submissions"
                  } and ${waitingTasks} ${waitingTasks === 1 ? "task" : "tasks"}.`}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <CreateTaskDialog
            trigger={
              <Button variant="outline" className="rounded-full px-4">
                <Plus className="h-4 w-4" /> Create Task
              </Button>
            }
          />
          <CreateTeamDialog
            trigger={
              <Button className="rounded-full bg-blue-600 px-4 text-white hover:bg-blue-700">
                <Plus className="h-4 w-4" /> Create Team
              </Button>
            }
          />
        </div>
      </div>

      {/* Explicit shrinkable column below xl so wide content can't push the page past the screen */}
      <div className="grid grid-cols-[minmax(0,1fr)] gap-5 xl:grid-cols-[minmax(0,1fr)_400px] xl:items-start">
        {/* ============ TEAMS (left) ============ */}
        <Section
          title="Teams"
          description="Manage your teams, track their progress, and provide guidance."
          action={
            tabTeams.length > TEAM_PREVIEW ? (
              <ViewAllLink
                expanded={showAllTeams}
                onClick={() => setShowAllTeams((v) => !v)}
                label="View all teams"
              />
            ) : undefined
          }
        >
          {allTeams !== undefined && (
            <div className="mb-4 inline-flex rounded-full bg-muted p-1 text-xs font-medium" role="tablist">
              {(
                [
                  ["active", "Active", activeTeams.length],
                  ["archived", "Archived", archivedTeams.length],
                ] as const
              ).map(([key, label, n]) => (
                <button
                  key={key}
                  type="button"
                  role="tab"
                  aria-selected={teamTab === key}
                  onClick={() => {
                    setTeamTab(key);
                    setShowAllTeams(false);
                  }}
                  className={`rounded-full px-3 py-1 transition-colors ${
                    teamTab === key
                      ? "bg-card text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {label} <span className="opacity-70">{n}</span>
                </button>
              ))}
            </div>
          )}

          {allTeams === undefined ? (
            <p className="text-center py-4 text-muted-foreground">Loading...</p>
          ) : allTeams.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <p className="text-muted-foreground">No teams created yet</p>
            </div>
          ) : tabTeams.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center rounded-2xl border border-dashed">
              <p className="text-muted-foreground">
                {teamTab === "active" ? "No active teams" : "No archived teams"}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {shownTeams.map((team, index) => {
                const teamDeliverables =
                  allDeliverables?.filter((d) => d.capstoneProjectId === team._id) ?? [];
                const teamTasks = tasks?.filter((t) => t.capstoneProjectId === team._id) ?? [];
                const completedTasks = teamTasks.filter((t) => t.status === "completed").length;
                const style = TEAM_STYLES[index % TEAM_STYLES.length];
                const TeamIcon = style.icon;
                const teamProgress = progressByTeam.get(team._id) ?? 0;
                const memberCount = team.members?.length ?? 0;

                // Defense pipeline: the badge shows the stage once the team reaches 100%,
                // and the action button replaces "View Team" while there's a step to do
                const defense = defenseStatus(team, teamProgress);
                const badgeLabel = defense?.label ?? team.phase;
                const badgeCls = defense?.cls ?? "bg-blue-600 text-white";
                const defenseAction = defenseActionKind(team, teamProgress);

                return (
                  <div key={team._id} className={rowClass}>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-4">
                      {/* Line 1: identity + phase badge */}
                      <div className="order-1 flex min-w-0 flex-1 items-center gap-3 sm:min-w-60">
                        <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full ${style.wrap}`}>
                          <TeamIcon className="h-6 w-6" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex min-w-0 items-center gap-2">
                            <h3
                              className="min-w-0 truncate text-base font-semibold text-foreground"
                              title={team.teamName}
                            >
                              {team.teamName}
                            </h3>
                            <span className={`${BADGE_BASE} ${badgeCls} shrink-0`}>{badgeLabel}</span>
                          </div>
                          <p className="truncate text-xs text-muted-foreground" title={team.projectTitle}>
                            {team.projectTitle}
                          </p>
                        </div>
                      </div>

                      {/* Line 2: stats + progress */}
                      <div className="order-2 flex basis-full flex-wrap sm:order-3 items-center gap-x-8 gap-y-3 border-t pt-3">
                        <div className="grid grid-cols-3 gap-4 sm:gap-6">
                          <div>
                            <p className="flex items-center gap-1 whitespace-nowrap text-xs text-muted-foreground">
                              <Users className="h-3.5 w-3.5 shrink-0" /> Members
                            </p>
                            {memberCount === 0 ? (
                              <p className="whitespace-nowrap text-sm font-semibold text-amber-600 dark:text-amber-400">None yet</p>
                            ) : (
                              <p className="text-sm font-semibold text-foreground">{memberCount}</p>
                            )}
                          </div>
                          <div>
                            <p className="flex items-center gap-1 whitespace-nowrap text-xs text-muted-foreground">
                              <FileText className="h-3.5 w-3.5 shrink-0" /> Deliverables
                            </p>
                            <p className="text-sm font-semibold text-foreground">{teamDeliverables.length}</p>
                          </div>
                          <div>
                            <p className="flex items-center gap-1 whitespace-nowrap text-xs text-muted-foreground">
                              <CheckSquare className="h-3.5 w-3.5 shrink-0" /> Tasks done
                            </p>
                            <p className="text-sm font-semibold text-foreground">
                              {completedTasks}/{teamTasks.length}
                            </p>
                          </div>
                        </div>

                        <div className="min-w-0 flex-1 basis-full sm:min-w-45 sm:basis-0">
                          <p className="mb-1 text-xs text-muted-foreground">Progress</p>
                          <div className="flex items-center gap-2">
                            <div className="min-w-0 flex-1">
                              <InstructorProgress progress={teamProgress} />
                            </div>
                            <span className="w-9 shrink-0 text-right text-xs font-semibold text-foreground">
                              {teamProgress}%
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Actions: every row has a primary action */}
                      <div className="order-3 flex w-full items-center gap-1 sm:order-2 sm:ml-auto sm:w-auto">
                        {defenseAction !== null ? (
                          // NOTE: this now also renders for the "archive" step. If
                          // DefenseActionButton doesn't handle "archive", handle it here.
                          <div className="min-w-0 flex-1 sm:flex-none [&>button]:w-full sm:[&>button]:w-auto">
                            <DefenseActionButton project={team} progress={teamProgress} />
                          </div>
                        ) : (
                          <Button
                            size="sm"
                            onClick={() => setViewingTeam(team)}
                            className="flex-1 rounded-full bg-blue-600 px-4 text-white hover:bg-blue-700 sm:flex-none"
                          >
                            View Team <ArrowRight className="h-3.5 w-3.5" />
                          </Button>
                        )}

                        <div className="flex shrink-0 items-center">
                          {team.inviteCode && (
                            <Popover>
                              <PopoverTrigger asChild>
                                <button className={ICON_BTN} aria-label="View invite code">
                                  <Key className="h-4 w-4 text-muted-foreground" />
                                </button>
                              </PopoverTrigger>
                              <PopoverContent align="end" className="w-72 max-w-[calc(100vw-2rem)] p-3">
                                <p className="text-xs text-muted-foreground mb-2">
                                  Share this code with students. They enter it at sign-up to join this team.
                                </p>
                                <div className="flex items-center justify-between bg-muted rounded-md px-3 py-2">
                                  <span className="font-mono text-sm tracking-widest font-semibold">
                                    {team.inviteCode}
                                  </span>
                                  <button
                                    onClick={() => copyInviteCode(team.inviteCode!, team._id)}
                                    className="text-muted-foreground hover:text-foreground transition-colors ml-2"
                                    aria-label="Copy invite code"
                                  >
                                    {copiedTeamId === team._id ? (
                                      <Check className="w-4 h-4 text-green-500" />
                                    ) : (
                                      <Copy className="w-4 h-4" />
                                    )}
                                  </button>
                                </div>
                                {copiedTeamId === team._id && (
                                  <p className="text-xs text-green-500 text-right mt-1">Copied!</p>
                                )}
                              </PopoverContent>
                            </Popover>
                          )}

                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <button className={ICON_BTN} aria-label="Team options">
                                <MoreVertical className="h-4 w-4 text-muted-foreground" />
                              </button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="space-y-1 p-1">
                              <DropdownMenuItem className="text-xs" onSelect={() => setViewingTeam(team)}>
                                View team
                              </DropdownMenuItem>
                              {/* Filter the Submissions and Tasks cards to this team */}
                              <DropdownMenuItem
                                className="text-xs"
                                onSelect={() => {
                                  setTeamFilter(team._id);
                                  setSubmissionFilter("all");
                                  setTaskFilter("all");
                                  setShowAllSubmissions(true);
                                  setShowAllTasks(true);
                                }}
                              >
                                View submissions
                              </DropdownMenuItem>
                              {/* Dialog triggers sit inside menu items that don't auto-close,
                                  so the dialog isn't unmounted with the menu */}
                              <DropdownMenuItem className="p-0" onSelect={(e) => e.preventDefault()}>
                                <EditTeam
                                  teamId={team._id}
                                  initialTeamName={team.teamName}
                                  initialProjectTitle={team.projectTitle}
                                  initialPhase={team.phase}
                                  initialAdviserId={team.adviserId}
                                  initialMembers={team.members ?? []}
                                  trigger={
                                    <button className="w-full px-2 py-2.5 text-left text-xs">
                                      Edit Team
                                    </button>
                                  }
                                />
                              </DropdownMenuItem>
                              <DropdownMenuItem className="p-0" onSelect={(e) => e.preventDefault()}>
                                <DeleteTeam
                                  teamId={team._id}
                                  teamName={team.teamName}
                                  trigger={
                                    <button className="w-full px-2 py-2.5 text-left text-xs text-destructive">
                                      Delete Team
                                    </button>
                                  }
                                />
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Section>

        {/* ============ RIGHT COLUMN ============ */}
        <div className="min-w-0 space-y-5">
          {/* SUBMISSIONS */}
          <Section
            title="Submissions"
            description="Review deliverables your teams have submitted."
            action={
              filteredDeliverables && filteredDeliverables.length > SIDE_PREVIEW ? (
                <ViewAllLink
                  expanded={showAllSubmissions}
                  onClick={() => setShowAllSubmissions((v) => !v)}
                />
              ) : undefined
            }
          >
            {allDeliverables === undefined ? (
              <p className="text-center py-4 text-muted-foreground">Loading...</p>
            ) : allDeliverables.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <FileText className="h-12 w-12 text-muted-foreground/40 mb-3" />
                <p className="text-muted-foreground">No submissions yet</p>
              </div>
            ) : (
              <>
                <div className={filterBarClass}>
                  <FilterChips<SubmissionFilter>
                    value={submissionFilter}
                    onChange={setSubmissionFilter}
                    options={[
                      { label: "All", value: "all", count: scopedDeliverables?.length ?? 0 },
                      { label: "Needs Revision", value: "needs_revision", count: countStatus("needs_revision") },
                      { label: "Under Review", value: "under_review", count: countStatus("under_review") },
                      { label: "Approved", value: "approved", count: countStatus("approved") },
                    ]}
                  />
                  {allTeams && <TeamSelect teams={allTeams} value={activeTeam} onChange={setTeamFilter} />}
                </div>
                {shownDeliverables && shownDeliverables.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-8 text-center rounded-2xl border border-dashed bg-card">
                    <p className="text-muted-foreground">No submissions match this filter</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {shownDeliverables?.map((d) => (
                      <div key={d._id} className={rowClass}>
                        <div className="flex flex-col gap-3">
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-green-100 text-green-600 dark:bg-green-900/50 dark:text-green-300">
                              <FileText className="h-6 w-6" />
                            </div>
                            <div className="min-w-0">
                              <h3 className="font-semibold text-foreground text-sm lg:text-base truncate">{d.fileName}</h3>
                              <p className="text-muted-foreground text-xs wrap-break-words">
                                Team: {d.teamName} • Phase: {d.phase} • Version {d.version}
                              </p>
                              <p className="text-muted-foreground text-xs mt-0.5">
                                {formatDate(d.uploadedAt)} • {d.fileSize}
                              </p>
                            </div>
                          </div>

                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <span className={`${BADGE_BASE} ${getStatusBadge(d.status)}`}>{getStatusLabel(d.status)}</span>

                            <div className="flex flex-wrap items-center gap-1">
                              {/* Quick actions for submissions waiting on you */}
                              {d.status === "under_review" && (
                                <>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="rounded-full px-3 text-xs"
                                    onClick={() => handleStatus(d._id, "needs_revision")}
                                  >
                                    Request revision
                                  </Button>
                                  <Button
                                    size="sm"
                                    className="rounded-full bg-green-600 px-3 text-xs text-white hover:bg-green-700"
                                    onClick={() => handleStatus(d._id, "approved")}
                                  >
                                    Approve
                                  </Button>
                                </>
                              )}

                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <button className={ICON_BTN} aria-label="Submission options">
                                    <MoreVertical className="h-4 w-4 text-muted-foreground" />
                                  </button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="w-44">
                                  {/* Disabled when the upload has no stored file */}
                                  <DropdownMenuItem
                                    disabled={!d.storageId}
                                    onClick={() => {
                                      if (!d.storageId) return;
                                      const doc = {
                                        fileName: d.fileName,
                                        storageId: d.storageId,
                                        deliverableId: d._id,
                                      };
                                      if (isPdf(d.fileName)) setSelectedDeliverable(doc);
                                      else setOfficeDoc(doc);
                                    }}
                                  >
                                    View File
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </Section>

          {/* TASKS */}
          <Section
            title="Tasks"
            description="Tasks you've assigned across your teams."
            action={
              filteredTasks && filteredTasks.length > SIDE_PREVIEW ? (
                <ViewAllLink expanded={showAllTasks} onClick={() => setShowAllTasks((v) => !v)} />
              ) : undefined
            }
          >
            {tasks === undefined ? (
              <p className="text-center py-4 text-muted-foreground">Loading...</p>
            ) : tasks.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <p className="text-muted-foreground">You haven&apos;t created any tasks yet</p>
              </div>
            ) : (
              <>
                <div className={filterBarClass}>
                  <FilterChips<TaskFilter>
                    value={taskFilter}
                    onChange={setTaskFilter}
                    options={[
                      { label: "All", value: "all", count: scopedTasks?.length ?? 0 },
                      { label: "Under Review", value: "under_review", count: reviewCount },
                      { label: "Overdue", value: "overdue", count: overdueCount },
                    ]}
                  />
                  {allTeams && <TeamSelect teams={allTeams} value={activeTeam} onChange={setTeamFilter} />}
                </div>
                {shownTasks && shownTasks.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-8 text-center rounded-2xl border border-dashed bg-card">
                    <p className="text-muted-foreground">
                      {taskFilter === "under_review"
                        ? "No tasks waiting for review"
                        : taskFilter === "overdue"
                          ? "No overdue tasks"
                          : "No tasks for this team"}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {shownTasks?.map((task, i) => {
                      const open = task.status !== "completed";
                      const late = isOverdue(task);
                      return (
                        <div key={task._id ?? i} className={rowClass}>
                          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                            <div className="flex items-start gap-3 min-w-0">
                              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-blue-100 text-blue-600 dark:bg-blue-900/50 dark:text-blue-300">
                                <CheckSquare className="h-6 w-6" />
                              </div>
                              <div className="min-w-0">
                                <h3 className="font-semibold text-foreground text-sm lg:text-base wrap-break-words">{task.title}</h3>
                                <p className="text-muted-foreground text-xs mt-0.5 wrap-break-words">{task.description}</p>
                                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 text-xs text-muted-foreground">
                                  <span>Team: {task.assignedTo}</span>
                                  <span>Role: {task.targetRole ?? "All Roles"}</span>
                                  <span
                                    className={`inline-flex items-center gap-1 ${
                                      late ? "text-red-600 dark:text-red-400" : ""
                                    }`}
                                  >
                                    <CalendarDays className="h-3.5 w-3.5" /> Due {formatDate(task.dueDate)}
                                    {open && ` · ${dueLabel(task.dueDate)}`}
                                  </span>
                                </div>
                              </div>
                            </div>

                            <div className="flex items-center gap-1 shrink-0">
                              <span className={`${BADGE_BASE} ${getTaskBadge(task.status)}`}>{getTaskLabel(task.status)}</span>
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <button className={ICON_BTN} aria-label="Task options">
                                    <MoreVertical className="h-4 w-4 text-muted-foreground" />
                                  </button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="space-y-1 p-1">
                                  <DropdownMenuItem className="p-0" onSelect={(e) => e.preventDefault()}>
                                    <EditTask
                                      taskId={task._id}
                                      initialTitle={task.title}
                                      initialDescription={task.description}
                                      initialDueDate={task.dueDate}
                                      initialTeamId={task.capstoneProjectId}
                                      initialTargetRole={task.targetRole}
                                      trigger={
                                        <button className="w-full px-2 py-2.5 text-left text-xs">
                                          Edit Task
                                        </button>
                                      }
                                    />
                                  </DropdownMenuItem>
                                  <DropdownMenuItem className="p-0" onSelect={(e) => e.preventDefault()}>
                                    <DeleteTask
                                      taskId={task._id}
                                      taskTitle={task.title}
                                      trigger={
                                        <button className="w-full px-2 py-2.5 text-left text-xs text-destructive">
                                          Delete Task
                                        </button>
                                      }
                                    />
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </div>
                          </div>

                          {/* The team marked this as done: confirm it or send it back */}
                          {task.status === "under_review" && (
                            <div className="mt-3 flex flex-wrap items-center justify-end gap-2">
                              <span className="mr-auto text-xs text-muted-foreground">
                                The team marked this as done.
                              </span>
                              <Button
                                size="sm"
                                variant="outline"
                                className="rounded-full px-4 gap-1.5"
                                onClick={() => handleReview(task._id, "revise")}
                              >
                                <RotateCcw className="h-3.5 w-3.5" /> Revise
                              </Button>
                              <Button
                                size="sm"
                                className="rounded-full bg-green-600 px-4 gap-1.5 text-white hover:bg-green-700"
                                onClick={() => handleReview(task._id, "confirm")}
                              >
                                <Check className="h-3.5 w-3.5" /> Confirm
                              </Button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </>
            )}
          </Section>
        </div>
      </div>

      {viewingTeam && (
        <InstructorTeamDetailsDialog
          team={viewingTeam}
          progress={progressByTeam.get(viewingTeam._id) ?? 0}
          deliverableCount={
            allDeliverables?.filter((d) => d.capstoneProjectId === viewingTeam._id).length ?? 0
          }
          taskCount={tasks?.filter((t) => t.capstoneProjectId === viewingTeam._id).length ?? 0}
          completedTaskCount={
            tasks?.filter(
              (t) => t.capstoneProjectId === viewingTeam._id && t.status === "completed"
            ).length ?? 0
          }
          onClose={() => setViewingTeam(null)}
        />
      )}

      {/* PDF viewer: its Comment button hands the file over to OnlyOffice */}
      <PDFViewer
        open={!!selectedDeliverable && !!fileUrl}
        fileUrl={fileUrl ?? ""}
        fileName={selectedDeliverable?.fileName ?? ""}
        deliverableId={selectedDeliverable?.deliverableId as Id<"deliverables"> | undefined}
        onClose={() => setSelectedDeliverable(null)}
        onComment={() => {
          if (!selectedDeliverable) return;
          setOfficeDoc(selectedDeliverable);
          setSelectedDeliverable(null);
        }}
      />

      {/* OnlyOffice editor, comment-only */}
      {officeDoc && typeof officeUrl === "string" && officeUrl.startsWith("http") && (
        <OnlyOfficeEditor
          fileId={`${officeDoc.deliverableId}-${officeDoc.storageId}`}
          deliverableId={officeDoc.deliverableId}
          fileName={officeDoc.fileName}
          fileUrl={officeUrl}
          mode="comment"
          userId={user?.id}
          userName={user?.fullName ?? undefined}
          onClose={() => setOfficeDoc(null)}
        />
      )}
    </div>
  );
}