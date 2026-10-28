"use client";
import { useState, useMemo } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import type { Doc } from "@/convex/_generated/dataModel";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import { DeleteTask } from "./deleteTask";
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

export type InstructorTab = "teams" | "submissions" | "tasks";
export type SubmissionFilter = "all" | "under_review" | "needs_revision" | "approved";
export type TaskFilter = "all" | "overdue" | "under_review";

// Icon + color combos, cycled per team row
const TEAM_STYLES = [
  { icon: Users, wrap: "bg-blue-100 text-blue-600 dark:bg-blue-900/50 dark:text-blue-300" },
  { icon: BookOpen, wrap: "bg-violet-100 text-violet-600 dark:bg-violet-900/50 dark:text-violet-300" },
  { icon: Code2, wrap: "bg-green-100 text-green-600 dark:bg-green-900/50 dark:text-green-300" },
  { icon: Lightbulb, wrap: "bg-amber-100 text-amber-600 dark:bg-amber-900/50 dark:text-amber-300" },
  { icon: GraduationCap, wrap: "bg-rose-100 text-rose-600 dark:bg-rose-900/50 dark:text-rose-300" },
];

const BADGE_BASE = "inline-flex items-center justify-center rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap";

const TAB_COPY: Record<string, { title: string; description: string }> = {
  teams: { title: "Teams", description: "Manage your teams, track their progress, and provide guidance." },
  submissions: { title: "Submissions", description: "Review deliverables your teams have submitted." },
  tasks: { title: "Tasks", description: "Tasks you've assigned across your teams." },
};

const isOverdue = (t: { dueDate: string; status: string }) =>
  t.status !== "completed" && new Date(t.dueDate).getTime() < Date.now();

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

// One team filter shared by the Submissions and Tasks tabs
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
      <SelectTrigger className="h-9 w-full rounded-full text-xs sm:w-52" aria-label="Filter by team">
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

type Props = {
  capstoneProjectId?: Id<"capstoneProjects">;
  // Optional: lets the dashboard cards control the tab and filters
  tab?: InstructorTab;
  onTabChange?: (t: InstructorTab) => void;
  submissionFilter?: SubmissionFilter;
  onSubmissionFilterChange?: (f: SubmissionFilter) => void;
  taskFilter?: TaskFilter;
  onTaskFilterChange?: (f: TaskFilter) => void;
};

export function InstructorTabsDemo({
  capstoneProjectId,
  tab: tabProp,
  onTabChange,
  submissionFilter: submissionFilterProp,
  onSubmissionFilterChange,
  taskFilter: taskFilterProp,
  onTaskFilterChange,
}: Props) {
  const { user } = useUser();
  const me = useQuery(api.users.getMe);
  const myId = me?._id as string | undefined;

  // Works controlled (from the dashboard) or on its own
  const [localTab, setLocalTab] = useState<InstructorTab>("teams");
  const [localSubmissionFilter, setLocalSubmissionFilter] = useState<SubmissionFilter>("all");
  const [localTaskFilter, setLocalTaskFilter] = useState<TaskFilter>("all");
  const tab = tabProp ?? localTab;
  const setTab = onTabChange ?? setLocalTab;
  const submissionFilter = submissionFilterProp ?? localSubmissionFilter;
  const setSubmissionFilter = onSubmissionFilterChange ?? setLocalSubmissionFilter;
  const taskFilter = taskFilterProp ?? localTaskFilter;
  const setTaskFilter = onTaskFilterChange ?? setLocalTaskFilter;

  // Team filter shared by Submissions + Tasks ("all" or a team id)
  const [teamFilter, setTeamFilter] = useState<string>("all");

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
  const [viewingTeam, setViewingTeam] =
    useState<Doc<"capstoneProjects"> | null>(null);

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

  const allDeliverables = useQuery(api.dashboard.getInstructorDeliverables, myId ? { instructorId: myId } : "skip");
  const allTeams = useQuery(api.dashboard.getInstructorTeams, myId ? { instructorId: myId } : "skip");
  const allTasks = useQuery(api.dashboard.getInstructorTasks, myId ? { instructorId: myId } : "skip");
  const projectTasks = useQuery(
    api.dashboard.getTasks,
    capstoneProjectId ? { capstoneProjectId } : "skip"
  );
  const tasks = capstoneProjectId ? projectTasks : allTasks;

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

  // Filtered lists
  // Newest upload first; if two share a timestamp, the higher version goes first
  const shownDeliverables = scopedDeliverables
    ?.filter((d) => submissionFilter === "all" || d.status === submissionFilter)
    .sort(
      (a, b) =>
        new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime() ||
        Number(b.version) - Number(a.version)
    );
  const countStatus = (s: string) => scopedDeliverables?.filter((d) => d.status === s).length ?? 0;

  // Tasks waiting for the instructor go first
  const shownTasks = scopedTasks
    ?.filter(
      (t) =>
        taskFilter === "all" ||
        (taskFilter === "overdue" && isOverdue(t)) ||
        (taskFilter === "under_review" && t.status === "under_review")
    )
    .sort((a, b) => Number(b.status === "under_review") - Number(a.status === "under_review"));
  const overdueCount = scopedTasks?.filter(isOverdue).length ?? 0;
  const reviewCount = scopedTasks?.filter((t) => t.status === "under_review").length ?? 0;

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

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const rowClass =
    "rounded-2xl border bg-card p-4 mb-3 transition-all hover:shadow-md hover:border-blue-200 dark:hover:border-blue-900";

  // Chip row + team dropdown, shared layout for Submissions and Tasks
  const filterBarClass = "mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between";

  return (
    <Tabs value={tab} onValueChange={(v) => setTab(v as InstructorTab)} className="w-full">
      {/* Section heading + pill tabs */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between mb-4">
        <div>
          <h2 className="text-xl font-semibold text-foreground">{TAB_COPY[tab].title}</h2>
          <p className="text-sm text-muted-foreground">{TAB_COPY[tab].description}</p>
        </div>
        <TabsList className="h-auto gap-1 rounded-full bg-muted p-1 self-start sm:self-auto">
          {["teams", "submissions", "tasks"].map((v) => (
            <TabsTrigger
              key={v}
              value={v}
              className="rounded-full px-4 py-1.5 text-sm capitalize data-[state=active]:bg-blue-600 data-[state=active]:text-white data-[state=active]:shadow"
            >
              {v}
            </TabsTrigger>
          ))}
        </TabsList>
      </div>

      {/* TEAMS TAB */}
      <TabsContent value="teams">
        {allTeams === undefined ? (
          <p className="text-center py-4 text-muted-foreground">Loading...</p>
        ) : allTeams.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <p className="text-muted-foreground">No teams created yet</p>
          </div>
        ) : (
          allTeams.map((team, index) => {
            const teamDeliverables = allDeliverables?.filter((d) => d.capstoneProjectId === team._id) ?? [];
            const teamTasks = allTasks?.filter((t) => t.capstoneProjectId === team._id) ?? [];
            const completedTasks = teamTasks.filter((t) => t.status === "completed").length;
            const style = TEAM_STYLES[index % TEAM_STYLES.length];
            const TeamIcon = style.icon;
            const teamProgress = progressByTeam.get(team._id) ?? 0;

            // Defense pipeline: the badge shows the stage once the team reaches 100%,
            // and the action button replaces "View Team" while there's a step to do
            const defense = defenseStatus(team, teamProgress);
            const badgeLabel = defense?.label ?? team.phase;
            const badgeCls = defense?.cls ?? "bg-blue-600 text-white";
            const defenseAction = defenseActionKind(team, teamProgress);
            const hasDefenseAction =
              defenseAction !== null && defenseAction !== "archive";

            return (
              <div key={team._id} className={rowClass}>
                <div className="flex flex-col gap-4 lg:grid lg:grid-cols-[minmax(0,2fr)_auto_repeat(3,minmax(0,1fr))_minmax(0,1.6fr)_auto] lg:items-center lg:gap-5">
                  {/* Identity */}
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full ${style.wrap}`}>
                      <TeamIcon className="h-6 w-6" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3 className="font-semibold text-foreground text-sm lg:text-base truncate">{team.teamName}</h3>
                      <p className="text-muted-foreground text-xs truncate">{team.projectTitle}</p>
                    </div>
                    <span className={`${BADGE_BASE} ${badgeCls} lg:hidden`}>{badgeLabel}</span>
                  </div>

                  {/* Phase / defense badge (desktop) */}
                  <span className={`${BADGE_BASE} ${badgeCls} hidden lg:inline-flex`}>{badgeLabel}</span>

                  {/* Stats */}
                  <div className="grid grid-cols-3 gap-3 lg:contents">
                    <div>
                      <p className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Users className="h-3.5 w-3.5" /> Members
                      </p>
                      <p className="text-sm font-semibold text-foreground">{team.members?.length ?? 0}</p>
                    </div>
                    <div>
                      <p className="flex items-center gap-1 text-xs text-muted-foreground">
                        <FileText className="h-3.5 w-3.5" /> Deliverables
                      </p>
                      <p className="text-sm font-semibold text-foreground">{teamDeliverables.length}</p>
                    </div>
                    <div>
                      <p className="flex items-center gap-1 text-xs text-muted-foreground">
                        <CheckSquare className="h-3.5 w-3.5" /> Tasks
                      </p>
                      <p className="text-sm font-semibold text-foreground">
                        {completedTasks}/{teamTasks.length}
                      </p>
                    </div>
                  </div>

                  {/* Progress */}
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Progress</p>
                    <div className="flex items-center gap-2">
                      <div className="flex-1">
                        <InstructorProgress progress={teamProgress} />
                      </div>
                      <span className="text-xs font-semibold text-foreground w-9 text-right">
                        {teamProgress}%
                      </span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1 justify-between lg:justify-end">
                    {defenseAction === "archive" ? null : hasDefenseAction ? (
                      <DefenseActionButton project={team} progress={teamProgress} />
                    ) : (
                      <Button
                        size="sm"
                        onClick={() => setViewingTeam(team)}
                        className="rounded-full bg-blue-600 px-4 text-white hover:bg-blue-700"
                      >
                        View Team <ArrowRight className="h-3.5 w-3.5" />
                      </Button>
                    )}

                    <div className="flex items-center">
                      {team.inviteCode && (
                        <Popover>
                          <PopoverTrigger asChild>
                            <button className="p-1.5 rounded-md hover:bg-muted transition-colors" aria-label="View invite code">
                              <Key className="h-4 w-4 text-muted-foreground" />
                            </button>
                          </PopoverTrigger>
                          <PopoverContent align="end" className="w-72 p-3">
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
                                {copiedTeamId === team._id
                                  ? <Check className="w-4 h-4 text-green-500" />
                                  : <Copy className="w-4 h-4" />}
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
                          <button className="p-1.5 rounded-md hover:bg-muted transition-colors" aria-label="Team options">
                            <MoreVertical className="h-4 w-4 text-muted-foreground" />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="space-y-1 p-1">
                          <button
                            className="w-full text-left text-xs rounded-md px-2 py-2 hover:bg-muted transition-colors"
                            onClick={() => setViewingTeam(team)}
                          >
                            View team
                          </button>
                          {/* Jump to this team's files with the team filter already set */}
                          <button
                            className="w-full text-left text-xs rounded-md px-2 py-2 hover:bg-muted transition-colors"
                            onClick={() => {
                              setTeamFilter(team._id);
                              setTab("submissions");
                            }}
                          >
                            View submissions
                          </button>
                          <EditTeam
                            teamId={team._id}
                            initialTeamName={team.teamName}
                            initialProjectTitle={team.projectTitle}
                            initialPhase={team.phase}
                            initialAdviserId={team.adviserId}
                            initialMembers={team.members ?? []}
                            trigger={
                              <button className="w-full text-left text-xs rounded-md px-2 py-2 hover:bg-muted transition-colors">
                                Edit Team
                              </button>
                            }
                          />
                          <DeleteTeam
                            teamId={team._id}
                            teamName={team.teamName}
                            trigger={
                              <button className="w-full text-left text-xs text-destructive rounded-md px-2 py-2 hover:bg-destructive/10 transition-colors">
                                Delete Team
                              </button>
                            }
                          />
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
        {viewingTeam && (
          <InstructorTeamDetailsDialog
            team={viewingTeam}
            progress={progressByTeam.get(viewingTeam._id) ?? 0}
            deliverableCount={
              allDeliverables?.filter(
                (deliverable) => deliverable.capstoneProjectId === viewingTeam._id,
              ).length ?? 0
            }
            taskCount={
              allTasks?.filter((task) => task.capstoneProjectId === viewingTeam._id)
                .length ?? 0
            }
            completedTaskCount={
              allTasks?.filter(
                (task) =>
                  task.capstoneProjectId === viewingTeam._id &&
                  task.status === "completed",
              ).length ?? 0
            }
            onClose={() => setViewingTeam(null)}
          />
        )}
      </TabsContent>

      {/* SUBMISSIONS TAB */}
      <TabsContent value="submissions">
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
                  { label: "Under Review", value: "under_review", count: countStatus("under_review") },
                  { label: "Needs Revision", value: "needs_revision", count: countStatus("needs_revision") },
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
              shownDeliverables?.map((d) => (
                <div key={d._id} className={rowClass}>
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-green-100 text-green-600 dark:bg-green-900/50 dark:text-green-300">
                        <FileText className="h-6 w-6" />
                      </div>
                      <div className="min-w-0">
                        <h3 className="font-semibold text-foreground text-sm lg:text-base truncate">{d.fileName}</h3>
                        <p className="text-muted-foreground text-xs">
                          Team: {d.teamName} • Phase: {d.phase} • Version {d.version}
                        </p>
                        <p className="text-muted-foreground text-xs mt-0.5">
                          {formatDate(d.uploadedAt)} • {d.fileSize}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 justify-between sm:justify-end">
  <span className={`${BADGE_BASE} ${getStatusBadge(d.status)}`}>{getStatusLabel(d.status)}</span>

  <DropdownMenu>
    <DropdownMenuTrigger asChild>
      <button className="p-1.5 rounded-md hover:bg-muted transition-colors" aria-label="Submission options">
        <MoreVertical className="h-4 w-4 text-muted-foreground" />
      </button>
    </DropdownMenuTrigger>
    <DropdownMenuContent align="end" className="w-44">
      {isPdf(d.fileName) ? (
        <DropdownMenuItem
          onClick={() =>
            setSelectedDeliverable({
              fileName: d.fileName,
              storageId: d.storageId!,
              deliverableId: d._id,
            })
          }
        >
          View File
        </DropdownMenuItem>
      ) : (
        <DropdownMenuItem
          onClick={() =>
            setOfficeDoc({
              fileName: d.fileName,
              storageId: d.storageId!,
              deliverableId: d._id,
            })
          }
        >
          View File
        </DropdownMenuItem>
      )}

      {/* Only the instructor approves or requests revision, on submissions waiting for review */}
      {d.status === "under_review" && (
        <>
          <DropdownMenuItem
            onClick={() => handleStatus(d._id, "needs_revision")}
            className="text-amber-600 focus:text-amber-600"
          >
            Request Revision
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => handleStatus(d._id, "approved")}
            className="text-green-600 focus:text-green-600"
          >
            Approve
          </DropdownMenuItem>
        </>
      )}
    </DropdownMenuContent>
  </DropdownMenu>
</div>
                  </div>
                </div>
              ))
            )}
          </>
        )}
      </TabsContent>

      {/* TASKS TAB */}
      <TabsContent value="tasks">
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
              {/* Already scoped to one team when a project id is passed in */}
              {allTeams && !capstoneProjectId && (
                <TeamSelect teams={allTeams} value={activeTeam} onChange={setTeamFilter} />
              )}
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
              shownTasks?.map((task, i) => (
                <div key={task._id ?? i} className={rowClass}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3 min-w-0">
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-blue-100 text-blue-600 dark:bg-blue-900/50 dark:text-blue-300">
                        <CheckSquare className="h-6 w-6" />
                      </div>
                      <div className="min-w-0">
                        <h3 className="font-semibold text-foreground text-sm lg:text-base">{task.title}</h3>
                        <p className="text-muted-foreground text-xs mt-0.5 wrap-break-word">{task.description}</p>
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 text-xs text-muted-foreground">
                          <span>Team: {task.assignedTo}</span>
                          <span>Role: {task.targetRole ?? "All Roles"}</span>
                          <span className="inline-flex items-center gap-1">
                            <CalendarDays className="h-3.5 w-3.5" /> Due {formatDate(task.dueDate)}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <span className={`${BADGE_BASE} ${getTaskBadge(task.status)}`}>{getTaskLabel(task.status)}</span>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button className="p-1.5 rounded-md hover:bg-muted transition-colors" aria-label="Task options">
                            <MoreVertical className="h-4 w-4 text-muted-foreground" />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="space-y-1 p-1">
                          <div>
                            <EditTask
                              taskId={task._id}
                              initialTitle={task.title}
                              initialDescription={task.description}
                              initialDueDate={task.dueDate}
                              initialTeamId={task.capstoneProjectId}
                              initialTargetRole={task.targetRole}
                              trigger={
                                <button className="w-full text-left text-xs rounded-md px-2 py-2 hover:bg-muted transition-colors">
                                  Edit Task
                                </button>
                              }
                            />
                          </div>
                          <div>
                            <DeleteTask
                              taskId={task._id}
                              taskTitle={task.title}
                              trigger={
                                <button className="w-full text-left text-xs text-destructive rounded-md px-2 py-2 hover:bg-destructive/10 transition-colors">
                                  Delete Task
                                </button>
                              }
                            />
                          </div>
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
              ))
            )}
          </>
        )}
      </TabsContent>

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
    </Tabs>
  );
}