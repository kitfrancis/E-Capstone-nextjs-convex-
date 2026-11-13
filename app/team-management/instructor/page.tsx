"use client";
import { useState, useMemo, useEffect, useRef } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import type { Doc } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  Clock,
  Copy,
  Key,
  MoreVertical,
  Plus,
  Users,
  FileText,
  ListChecks,
  AlertTriangle,
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

const StaffDraftEditor = dynamic(
  () => import("@/app/components/editor/staff-draft-editor"),
  { ssr: false }
);

const isPdf = (fileName: string) => fileName.toLowerCase().endsWith(".pdf");

// Phase name the student's final IMRaD upload is saved under
const IMRAD_PHASE = "IMRaD Final";

type SubmissionFilter = "all" | "under_review" | "needs_revision" | "approved";
type TaskFilter = "all" | "overdue" | "under_review";
type TeamTab = "active" | "archived";
type SideTab = "submissions" | "tasks";

// Submissions and Tasks show this many rows before "View all"
const SIDE_PREVIEW = 3;

// The Teams list scrolls inside its card once it has this many teams
const SCROLL_AT = 3;

// Returns the scroll classes for the Teams list. The small negative margin and padding
// keep card borders and hover shadows from being clipped by the scroll area.
const scrollClass = (count: number, maxHeight: string) =>
  count >= SCROLL_AT
    ? `${maxHeight} overflow-y-auto -mx-1 px-1 py-1 [scrollbar-width:thin]`
    : "";

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

// TODO: adjust to however your schema marks an archived team
const isArchivedTeam = (team: Doc<"capstoneProjects">) => {
  const t = team as unknown as { archived?: boolean; status?: string };
  return Boolean(t.archived) || t.status === "archived";
};

// Small count pill used inside tab triggers
function CountPill({ count }: { count: number }) {
  return (
    <span className="ml-1.5 inline-flex min-w-5 items-center justify-center rounded-full bg-muted-foreground/15 px-1.5 text-[11px] font-medium leading-5 tabular-nums">
      {count}
    </span>
  );
}

// Standard shadcn tabs, laid out as a grid so every option stays visible.
// shadcn's TabsList has a fixed h-9 and its triggers use h-[calc(100%-1px)],
// so both are forced with the important modifier (trailing "!" in Tailwind v4)
// to let the list grow with its rows.
// With three options, phones get "All" on its own row and the other two below it;
// from sm up all three sit in one row.
function FilterChips<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { label: string; value: T; count?: number }[];
  value: T;
  onChange: (v: T) => void;
}) {
  const three = options.length === 3;
  return (
    <Tabs value={value} onValueChange={(v) => onChange(v as T)}>
      <TabsList
        className={`grid h-auto! w-full gap-1 p-1 ${
          three ? "grid-cols-2 sm:grid-cols-3" : "grid-cols-2"
        }`}
      >
        {options.map((o, i) => (
          <TabsTrigger
            key={o.value}
            value={o.value}
            className={`h-8! w-full px-2 text-xs ${
              three && i === 0 ? "col-span-2 sm:col-span-1" : ""
            }`}
          >
            {o.label}
            {o.count !== undefined && <CountPill count={o.count} />}
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
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
  const allLabel =
    teams.length <= 2
      ? `All Teams (${teams.map((t) => t.teamName).join(" & ")})`
      : `All Teams (${teams.length})`;
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="w-full" aria-label="Filter by team">
        <div className="flex min-w-0 items-center gap-2">
          <Users className="h-4 w-4 shrink-0 text-muted-foreground" />
          <SelectValue placeholder={allLabel} />
        </div>
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">{allLabel}</SelectItem>
        {teams.map((t) => (
          <SelectItem key={t._id} value={t._id}>
            {t.teamName}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

// Section card: heading + description + optional action.
// On phones the action (e.g. the Active / Archived tabs) drops below the heading.
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
    <section className="min-w-0 rounded-2xl border bg-card p-4 sm:p-6">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h2 className="text-xl font-semibold text-foreground">{title}</h2>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
        {action && <div className="w-full shrink-0 sm:w-auto">{action}</div>}
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
      className="text-sm font-medium text-blue-600 hover:underline"
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
  const [sideTab, setSideTab] = useState<SideTab>("submissions");
  const [expandedTask, setExpandedTask] = useState<string | null>(null);

  // Team filter shared by the Submissions and Tasks tabs ("all" or a team id)
  const [teamFilter, setTeamFilter] = useState<string>("all");

  // "View all" toggles (Submissions and Tasks)
  const [showAllSubmissions, setShowAllSubmissions] = useState(false);
  const [showAllTasks, setShowAllTasks] = useState(false);

  // PDF viewer
  const [selectedDeliverable, setSelectedDeliverable] = useState<{
    fileName: string;
    storageId: string;
    deliverableId: string;
    capstoneProjectId: Id<"capstoneProjects">;
    phase: string;
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
    capstoneProjectId: Id<"capstoneProjects">;
    phase: string;
  } | null>(null);
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

  // Approve final revisions: moves the project to "ready_to_archive"
  const approveFinalRevisions = useMutation(api.dashboard.approveFinalRevisions);
  const handleApproveFinal = async (team: Doc<"capstoneProjects">) => {
    const ok = window.confirm(
      `Approve the final revisions of ${team.teamName}? The team will be asked to upload their IMRaD manuscript for archiving or binding.`
    );
    if (!ok) return;
    try {
      await approveFinalRevisions({ projectId: team._id });
      toast.success(`${team.teamName} is now ready for archiving.`);
    } catch (err) {
      console.error(err);
      toast.error(err instanceof Error ? err.message : "Couldn't approve the final revisions.");
    }
  };

  // Endorse for archiving: only works once the IMRaD file is verified (approved)
  const endorseForArchiving = useMutation(api.defense.endorseForArchiving);
  const handleEndorse = async (team: Doc<"capstoneProjects">) => {
    const ok = window.confirm(
      `Endorse ${team.teamName} for archiving? The admin will do the final verification.`
    );
    if (!ok) return;
    try {
      await endorseForArchiving({ projectId: team._id });
      toast.success(`${team.teamName} was endorsed for archiving.`);
    } catch (err) {
      console.error(err);
      toast.error(err instanceof Error ? err.message : "Couldn't endorse the project.");
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

  // ---------- Auto-sync defense readiness ----------
  // The adviser approves chapters, but the stage only updates when
  // syncDefenseReadiness runs. Run it here so the instructor sees the
  // "Schedule proposal" button as soon as Chapters 1-3 are approved.
  const syncReadiness = useMutation(api.defense.syncDefenseReadiness);
  const syncedRef = useRef(new Set<string>());

  useEffect(() => {
    if (!allTeams || !allDeliverables) return;
    for (const team of allTeams) {
      if (team.stage) continue; // already in the defense pipeline

      const p = computeProgress(
        allDeliverables.filter((d) => d.capstoneProjectId === team._id)
      );
      const ch13Done = p.chapters.slice(0, 3).every((c) => c.status === "approved");
      const proposalDone =
        team.proposalResult === "passed" || team.proposalResult === "passed_with_revisions";
      // Same rule the server uses
      const needsSync = proposalDone ? p.total >= 100 : ch13Done;

      // The key includes the phase so the final-defense sync can run later
      const key = `${team._id}:${proposalDone ? "final" : "proposal"}`;
      if (needsSync && !syncedRef.current.has(key)) {
        syncedRef.current.add(key);
        syncReadiness({ projectId: team._id }).catch(() => {
          syncedRef.current.delete(key);
        });
      }
    }
  }, [allTeams, allDeliverables, syncReadiness]);

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

  // Tab badges: what still needs attention
  const pendingSubmissionCount = countStatus("under_review");
  const openTaskCount = scopedTasks?.filter((t) => t.status !== "completed").length ?? 0;

  // Teams: Active / Archived tabs
  const teamIsArchived = (t: Doc<"capstoneProjects">) =>
    isArchivedTeam(t) || defenseStatus(t, progressByTeam.get(t._id) ?? 0)?.label === "Archived";
  const activeTeams = allTeams?.filter((t) => !teamIsArchived(t)) ?? [];
  const archivedTeams = allTeams?.filter(teamIsArchived) ?? [];
  const tabTeams = teamTab === "active" ? activeTeams : archivedTeams;

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

  const getTaskLabel = (status: string) => {
    if (status === "completed") return "Completed";
    if (status === "in_progress") return "In Progress";
    if (status === "under_review") return "Under Review";
    if (status === "needs_revision") return "Needs Revision";
    return "Pending";
  };

  // Due badge shown at the top right of each task card
  const dueBadge = (t: { dueDate: string; status: string }) => {
    if (t.status === "completed")
      return { label: "Completed", cls: "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300" };
    if (isOverdue(t))
      return { label: "Overdue", cls: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300" };
    const n = daysUntil(t.dueDate);
    if (n === 0)
      return { label: "Due Today", cls: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300" };
    if (n === 1)
      return { label: "Due Tomorrow", cls: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300" };
    return { label: `Due in ${n} days`, cls: "bg-muted text-muted-foreground" };
  };

  const rowClass =
    "min-w-0 rounded-2xl border bg-card p-3 sm:p-4 transition-all hover:shadow-md hover:border-blue-200 dark:hover:border-blue-900";

  const sideTabs = [
    { key: "submissions" as const, label: "Submissions", Icon: FileText, count: pendingSubmissionCount },
    { key: "tasks" as const, label: "Tasks", Icon: ListChecks, count: openTaskCount },
  ];

  return (
    <div className="w-full min-w-0 p-4 sm:p-6 lg:p-8">
      {/* Page header: on phones the two buttons share one full-width row */}
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold text-foreground sm:text-3xl">Team Management</h1>
          {allDeliverables !== undefined && tasks !== undefined && (
            <p className="mt-1 text-sm text-muted-foreground">
              {waitingTotal === 0
                ? "You're all caught up. Nothing is waiting for your review."
                : `${waitingTotal} ${waitingTotal === 1 ? "item needs" : "items need"} your review: ${waitingSubmissions} ${
                    waitingSubmissions === 1 ? "submission" : "submissions"
                  } and ${waitingTasks} ${waitingTasks === 1 ? "task" : "tasks"} pending approval.`}
            </p>
          )}
        </div>
        <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto sm:items-center">
          <CreateTaskDialog
            trigger={
              <Button variant="outline" className="w-full rounded-xl px-4 sm:w-auto">
                <Plus className="h-4 w-4" /> Create Task
              </Button>
            }
          />
          <CreateTeamDialog
            trigger={
              <Button className="w-full rounded-xl bg-blue-600 px-4 text-white hover:bg-blue-700 sm:w-auto">
                <Plus className="h-4 w-4" /> Create Team
              </Button>
            }
          />
        </div>
      </div>

      {/* Explicit shrinkable column below xl so wide content can't push the page past the screen */}
      <div className="grid grid-cols-[minmax(0,1fr)] gap-5 xl:grid-cols-[minmax(0,1fr)_420px] xl:items-start">
        {/* ============ TEAMS (left) ============ */}
        <Section
          title="Teams"
          description="Manage your teams, track their progress, and provide guidance."
          action={
            allTeams !== undefined ? (
              <Tabs value={teamTab} onValueChange={(v) => setTeamTab(v as TeamTab)}>
                <TabsList className="grid w-full grid-cols-2 sm:inline-flex sm:w-auto">
                  <TabsTrigger value="active" className="px-3 text-xs">
                    Active <CountPill count={activeTeams.length} />
                  </TabsTrigger>
                  <TabsTrigger value="archived" className="px-3 text-xs">
                    Archived <CountPill count={archivedTeams.length} />
                  </TabsTrigger>
                </TabsList>
              </Tabs>
            ) : undefined
          }
        >
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
            // Scrolls inside the card once there are 3 or more teams
            <div
              key={teamTab}
              className={`space-y-4 ${scrollClass(tabTeams.length, "max-h-144")}`}
            >
              {tabTeams.map((team, index) => {
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
                const badgeCls =
                  defense?.cls ??
                  "border border-blue-300 bg-blue-50 text-blue-700 dark:border-blue-800 dark:bg-blue-950/40 dark:text-blue-300";
                const defenseAction = defenseActionKind(team, teamProgress);

                // Final revisions / archive flow
                const stageStr = String(team.stage ?? "");
                const awaitingFinalApproval = stageStr === "final_revisions";
                const readyToArchive = stageStr === "ready_to_archive";
                // Latest IMRaD version the team uploaded (if any)
                const imradDoc = teamDeliverables
                  .filter((d) => d.phase === IMRAD_PHASE)
                  .sort((a, b) => Number(b.version) - Number(a.version))[0];
                const imradStatus = imradDoc?.status;
                const imradSubmitted = !!imradDoc;
                // No IMRaD yet, or it was sent back and the team must upload a new one
                const awaitingImrad =
                  readyToArchive && (!imradSubmitted || imradStatus === "needs_revision");
                // Uploaded and waiting for the instructor to verify it
                const verifyImrad = readyToArchive && imradStatus === "under_review";
                // Verified (approved) but not yet endorsed for archiving
                const canEndorse =
                  readyToArchive && imradStatus === "approved" && !team.archiveEndorsedAt;
                const endorsed = readyToArchive && !!team.archiveEndorsedAt;

                return (
                  <div key={team._id} className={rowClass}>
                    {/* Header: identity + primary action */}
                    <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-3">
                      <div className="flex min-w-0 flex-1 items-center gap-3 sm:min-w-60">
                        <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${style.wrap}`}>
                          <TeamIcon className="h-5 w-5" />
                        </div>
                        <div className="min-w-0 flex-1">
                          {/* Name and badge wrap onto two lines on narrow screens instead of squeezing the name */}
                          <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
                            <h3
                              className="max-w-full min-w-0 truncate text-base font-semibold text-foreground"
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

                      {/* Actions: every row has a primary action */}
                      <div className="flex w-full items-center gap-1 sm:w-auto">
                        {awaitingFinalApproval ? (
                          <Button
                            size="sm"
                            onClick={() => handleApproveFinal(team)}
                            className="flex-1 rounded-full bg-emerald-600 px-4 text-white hover:bg-emerald-700 sm:flex-none"
                          >
                            <Check className="h-3.5 w-3.5" /> Approve Final Revisions
                          </Button>
                        ) : awaitingImrad ? (
                          <Button
                            size="sm"
                            variant="outline"
                            disabled
                            title="The team hasn't uploaded a valid IMRaD manuscript yet"
                            className="flex-1 rounded-full border-amber-300 bg-amber-50 px-4 text-amber-700 disabled:opacity-100 sm:flex-none dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-300"
                          >
                            <Clock className="h-3.5 w-3.5" /> Waiting for IMRaD
                          </Button>
                        ) : verifyImrad ? (
                          <>
                            <Button
                              size="sm"
                              variant="outline"
                              className="flex-1 rounded-full px-3 text-xs sm:flex-none"
                              onClick={() =>
                                imradDoc && handleStatus(imradDoc._id, "needs_revision")
                              }
                            >
                              Request revision
                            </Button>
                            <Button
                              size="sm"
                              onClick={() => imradDoc && handleStatus(imradDoc._id, "approved")}
                              className="flex-1 rounded-full bg-emerald-600 px-4 text-white hover:bg-emerald-700 sm:flex-none"
                            >
                              <Check className="h-3.5 w-3.5" /> Verify IMRaD
                            </Button>
                          </>
                        ) : canEndorse ? (
                          <Button
                            size="sm"
                            onClick={() => handleEndorse(team)}
                            className="flex-1 rounded-full bg-emerald-600 px-4 text-white hover:bg-emerald-700 sm:flex-none"
                          >
                            <Check className="h-3.5 w-3.5" /> Endorse for Archiving
                          </Button>
                        ) : endorsed ? (
                          <Button
                            size="sm"
                            variant="outline"
                            disabled
                            className="flex-1 rounded-full border-emerald-300 bg-emerald-50 px-4 text-emerald-700 disabled:opacity-100 sm:flex-none dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-300"
                          >
                            <Check className="h-3.5 w-3.5" /> Endorsed
                          </Button>
                        ) : defenseAction !== null ? (
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
                              {/* Filter the Submissions and Tasks tabs to this team */}
                              <DropdownMenuItem
                                className="text-xs"
                                onSelect={() => {
                                  setTeamFilter(team._id);
                                  setSideTab("submissions");
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

                    {/* Archive status line */}
                    {readyToArchive && (
                      <p
                        className={`mt-3 text-xs font-medium ${
                          imradStatus === "approved"
                            ? "text-emerald-600 dark:text-emerald-400"
                            : "text-amber-700 dark:text-amber-400"
                        }`}
                      >
                        {!imradSubmitted
                          ? "Waiting for the team's IMRaD upload."
                          : imradStatus === "needs_revision"
                            ? "IMRaD sent back. Waiting for a new upload."
                            : imradStatus === "under_review"
                              ? "IMRaD submitted. Waiting for your verification."
                              : endorsed
                                ? "Endorsed. Waiting for admin verification."
                                : "IMRaD verified. Ready to endorse for archiving."}
                      </p>
                    )}

                    {/* Stats */}
                    <div className="mt-4 grid grid-cols-3 gap-4 border-t pt-4">
                      <div>
                        <p className="text-xs text-muted-foreground">Members</p>
                        {memberCount === 0 ? (
                          <p className="whitespace-nowrap text-sm font-semibold text-amber-600 dark:text-amber-400">
                            None yet
                          </p>
                        ) : (
                          <p className="text-sm font-semibold text-foreground">{memberCount}</p>
                        )}
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Deliverables</p>
                        <p className="text-sm font-semibold text-foreground">{teamDeliverables.length}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Tasks done</p>
                        <p className="text-sm font-semibold text-foreground">
                          {completedTasks}/{teamTasks.length}
                        </p>
                      </div>
                    </div>

                    {/* Progress */}
                    <div className="mt-4">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">Progress</span>
                        <span className="font-semibold text-foreground">{teamProgress}%</span>
                      </div>
                      <div className="mt-1.5">
                        <InstructorProgress progress={teamProgress} />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Section>

        {/* ============ RIGHT COLUMN: Submissions / Tasks ============ */}
        <div className="min-w-0 rounded-2xl border bg-card p-4 sm:p-5">
          {/* Tab switcher (standard shadcn tabs). Smaller text and no icons on very narrow phones. */}
          <Tabs value={sideTab} onValueChange={(v) => setSideTab(v as SideTab)}>
            <TabsList className="grid w-full grid-cols-2">
              {sideTabs.map(({ key, label, Icon, count }) => (
                <TabsTrigger key={key} value={key} className="gap-1 px-2 text-xs sm:gap-1.5 sm:text-sm">
                  <Icon className="hidden h-4 w-4 min-[380px]:block" />
                  {label}
                  <CountPill count={count} />
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>

          {/* Team filter */}
          <div className="mt-4 border-t pt-4">
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Filter by team
            </p>
            {allTeams && <TeamSelect teams={allTeams} value={activeTeam} onChange={setTeamFilter} />}
            <p className="mt-1.5 text-xs text-muted-foreground">
              {sideTab === "submissions"
                ? "Review deliverables your teams have submitted."
                : "Tasks you've assigned across your teams."}
            </p>
          </div>

          {/* ---------- SUBMISSIONS ---------- */}
          {sideTab === "submissions" && (
            <div className="mt-4 border-t pt-4">
              {allDeliverables === undefined ? (
                <p className="text-center py-4 text-muted-foreground">Loading...</p>
              ) : allDeliverables.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <FileText className="h-12 w-12 text-muted-foreground/40 mb-3" />
                  <p className="text-muted-foreground">No submissions yet</p>
                </div>
              ) : (
                <>
                  <div className="mb-4">
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
                  </div>

                  {shownDeliverables && shownDeliverables.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-8 text-center rounded-2xl border border-dashed bg-card">
                      <p className="text-muted-foreground">No submissions match this filter</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {shownDeliverables?.map((d) => (
                        <div key={d._id} className={rowClass}>
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-green-100 text-green-600 sm:h-11 sm:w-11 dark:bg-green-900/50 dark:text-green-300">
                              <FileText className="h-5 w-5" />
                            </div>
                            <div className="min-w-0">
                              <h3 className="truncate text-sm font-semibold text-foreground" title={d.fileName}>
                                {d.fileName}
                              </h3>
                              <p className="wrap-break-word text-xs text-muted-foreground">
                                Team: {d.teamName} • Phase: {d.phase} • Version {d.version}
                              </p>
                              <p className="mt-0.5 text-[11px] text-muted-foreground">
                                {formatDate(d.uploadedAt)} • {d.fileSize}
                              </p>
                            </div>
                          </div>

                          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t pt-3">
                            <span className={`${BADGE_BASE} ${getStatusBadge(d.status)}`}>
                              {getStatusLabel(d.status)}
                            </span>

                            <div className="flex flex-wrap items-center gap-1">
                              {/* Quick actions for submissions waiting on you */}
                              {d.status === "under_review" && (
                                <>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="rounded-lg px-3 text-xs"
                                    onClick={() => handleStatus(d._id, "needs_revision")}
                                  >
                                    Request revision
                                  </Button>
                                  <Button
                                    size="sm"
                                    className="rounded-lg bg-green-600 px-3 text-xs text-white hover:bg-green-700"
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
                                        capstoneProjectId: d.capstoneProjectId,
                                        phase: d.phase,
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
                      ))}

                      {filteredDeliverables && filteredDeliverables.length > SIDE_PREVIEW && (
                        <div className="pt-1 text-center">
                          <ViewAllLink
                            expanded={showAllSubmissions}
                            onClick={() => setShowAllSubmissions((v) => !v)}
                          />
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* ---------- TASKS ---------- */}
          {sideTab === "tasks" && (
            <div className="mt-4 border-t pt-4">
              {tasks === undefined ? (
                <p className="text-center py-4 text-muted-foreground">Loading...</p>
              ) : tasks.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <p className="text-muted-foreground">You haven&apos;t created any tasks yet</p>
                </div>
              ) : (
                <>
                  <div className="mb-4">
                    <FilterChips<TaskFilter>
                      value={taskFilter}
                      onChange={setTaskFilter}
                      options={[
                        { label: "All", value: "all", count: scopedTasks?.length ?? 0 },
                        { label: "Under Review", value: "under_review", count: reviewCount },
                        { label: "Overdue", value: "overdue", count: overdueCount },
                      ]}
                    />
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
                        const late = isOverdue(task);
                        const badge = dueBadge(task);
                        const expanded = expandedTask === task._id;
                        return (
                          <div key={task._id ?? i} className={rowClass}>
                            <div className="flex items-start justify-between gap-2 sm:gap-3">
                              <div className="flex min-w-0 items-center gap-2 sm:gap-3">
                                <div
                                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl sm:h-11 sm:w-11 ${
                                    late
                                      ? "bg-red-100 text-red-600 dark:bg-red-900/50 dark:text-red-300"
                                      : "bg-violet-100 text-violet-600 dark:bg-violet-900/50 dark:text-violet-300"
                                  }`}
                                >
                                  {late ? <AlertTriangle className="h-4 w-4 sm:h-5 sm:w-5" /> : <ListChecks className="h-4 w-4 sm:h-5 sm:w-5" />}
                                </div>
                                <div className="min-w-0">
                                  <h3 className="wrap-break-word text-sm font-semibold text-foreground">{task.title}</h3>
                                  <p className="wrap-break-word text-xs text-muted-foreground">
                                    Team: {task.assignedTo} • Assigned to {task.targetRole ?? "all members"}
                                  </p>
                                </div>
                              </div>

                              <div className="flex shrink-0 items-center gap-0.5">
                                <span className={`${BADGE_BASE} ${badge.cls}`}>{badge.label}</span>
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

                            {/* Status row */}
                            <div className="mt-3 flex items-center justify-between gap-2 border-t pt-3 text-xs">
                              <span className="text-muted-foreground">
                                Status:{" "}
                                <span
                                  className={`font-semibold ${
                                    late ? "text-red-600 dark:text-red-400" : "text-foreground"
                                  }`}
                                >
                                  {getTaskLabel(task.status)}
                                </span>
                              </span>
                              <button
                                type="button"
                                onClick={() => setExpandedTask(expanded ? null : task._id)}
                                className="font-medium text-blue-600 hover:underline"
                              >
                                {expanded ? "Hide details" : "View details"}
                              </button>
                            </div>

                            {expanded && (
                              <div className="mt-3 space-y-1.5 rounded-xl bg-muted/50 p-3 text-xs">
                                <p className="wrap-break-word text-foreground">
                                  {task.description || "No description."}
                                </p>
                                <p
                                  className={`inline-flex items-center gap-1 ${
                                    late ? "text-red-600 dark:text-red-400" : "text-muted-foreground"
                                  }`}
                                >
                                  <CalendarDays className="h-3.5 w-3.5" /> Due {formatDate(task.dueDate)}
                                </p>
                              </div>
                            )}

                            {/* The team marked this as done: confirm it or send it back */}
                            {task.status === "under_review" && (
                              <div className="mt-3 flex flex-wrap items-center justify-end gap-2">
                                <span className="mr-auto text-xs text-muted-foreground">
                                  The team marked this as done.
                                </span>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="rounded-lg px-4 gap-1.5"
                                  onClick={() => handleReview(task._id, "revise")}
                                >
                                  <RotateCcw className="h-3.5 w-3.5" /> Revise
                                </Button>
                                <Button
                                  size="sm"
                                  className="rounded-lg bg-green-600 px-4 gap-1.5 text-white hover:bg-green-700"
                                  onClick={() => handleReview(task._id, "confirm")}
                                >
                                  <Check className="h-3.5 w-3.5" /> Confirm
                                </Button>
                              </div>
                            )}
                          </div>
                        );
                      })}

                      {filteredTasks && filteredTasks.length > SIDE_PREVIEW && (
                        <div className="pt-1 text-center">
                          <ViewAllLink expanded={showAllTasks} onClick={() => setShowAllTasks((v) => !v)} />
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
          )}
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
      {officeDoc && (
        <StaffDraftEditor
          key={officeDoc.deliverableId}
          deliverableId={officeDoc.deliverableId as Id<"deliverables">}
          capstoneProjectId={officeDoc.capstoneProjectId}
          deliverables={
            (allDeliverables ?? []).filter(
              (item) => item.capstoneProjectId === officeDoc.capstoneProjectId,
            )
          }
          userId={user?.id}
          userName={user?.fullName ?? undefined}
          onClose={() => setOfficeDoc(null)}
        />
      )}
    </div>
  );
}