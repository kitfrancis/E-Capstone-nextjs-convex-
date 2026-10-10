"use client";
import { useState, useMemo } from "react";
import Link from "next/link";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { useUser } from "@clerk/nextjs";
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
} from "lucide-react";
import { EditTask } from "@/app/components/editTask";
import { DeleteTask } from "./deleteTask";
import { InstructorProgress } from "@/app/components/TeamsProgress";
import { EditTeam } from "@/app/components/editTeam";
import { DeleteTeam } from "@/app/components/deleteTeam";
import { computeProgress } from "@/lib/progress";
import dynamic from "next/dynamic";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
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
export type TaskFilter = "all" | "overdue";

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
    <div className="mb-4 flex flex-wrap gap-2">
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

  const copyInviteCode = (code: string, teamId: string) => {
    navigator.clipboard.writeText(code);
    setCopiedTeamId(teamId);
    setTimeout(() => setCopiedTeamId(null), 2000);
  };

  const allDeliverables = useQuery(api.dashboard.getInstructorDeliverables, myId ? { instructorId: myId } : "skip");
  const allTeams = useQuery(api.dashboard.getInstructorTeams, myId ? { instructorId: myId } : "skip");
  const allTasks = useQuery(api.dashboard.getInstructorTasks, myId ? { instructorId: myId } : "skip");
  const projectTasks = useQuery(
    api.dashboard.getTasks,
    capstoneProjectId ? { capstoneProjectId } : "skip"
  );
  const tasks = capstoneProjectId ? projectTasks : allTasks;

  // Chapter-based progress per team, computed from the latest version of each chapter
  const progressByTeam = useMemo(() => {
    const map = new Map<string, number>();
    if (!allTeams) return map;
    for (const team of allTeams) {
      const items = (allDeliverables ?? []).filter((d) => d.capstoneProjectId === team._id);
      map.set(team._id, computeProgress(items).total);
    }
    return map;
  }, [allTeams, allDeliverables]);

  // Filtered lists
  const shownDeliverables = allDeliverables?.filter(
    (d) => submissionFilter === "all" || d.status === submissionFilter
  );
  const countStatus = (s: string) => allDeliverables?.filter((d) => d.status === s).length ?? 0;
  const shownTasks = tasks?.filter((t) => taskFilter === "all" || isOverdue(t));
  const overdueCount = tasks?.filter(isOverdue).length ?? 0;

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
    return "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300";
  };

  const getTaskLabel = (status: string) => {
    if (status === "completed") return "Completed";
    if (status === "in_progress") return "In Progress";
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
                    <span className={`${BADGE_BASE} bg-blue-600 text-white lg:hidden`}>{team.phase}</span>
                  </div>

                  {/* Phase badge (desktop) */}
                  <span className={`${BADGE_BASE} bg-blue-600 text-white hidden lg:inline-flex`}>{team.phase}</span>

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
                    {/* TODO: change to your real team page route */}
                    <Button asChild size="sm" className="rounded-full bg-blue-600 px-4 text-white hover:bg-blue-700">
                      <Link href={`/dashboard/instructor/teams/${team._id}`}>
                        View Team <ArrowRight className="h-3.5 w-3.5" />
                      </Link>
                    </Button>

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
                          <EditTeam
                            teamId={team._id}
                            initialTeamName={team.teamName}
                            initialProjectTitle={team.projectTitle}
                            initialPhase={team.phase}
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
            <FilterChips<SubmissionFilter>
              value={submissionFilter}
              onChange={setSubmissionFilter}
              options={[
                { label: "All", value: "all", count: allDeliverables.length },
                { label: "Under Review", value: "under_review", count: countStatus("under_review") },
                { label: "Needs Revision", value: "needs_revision", count: countStatus("needs_revision") },
                { label: "Approved", value: "approved", count: countStatus("approved") },
              ]}
            />
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
                      {isPdf(d.fileName) ? (
                        <Button
                          size="sm"
                          className="rounded-full bg-blue-600 px-4 text-white hover:bg-blue-700"
                          onClick={() =>
                            setSelectedDeliverable({
                              fileName: d.fileName,
                              storageId: d.storageId!,
                              deliverableId: d._id,
                            })
                          }
                        >
                          View File
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          className="rounded-full bg-blue-600 px-4 text-white hover:bg-blue-700"
                          onClick={() =>
                            setOfficeDoc({
                              fileName: d.fileName,
                              storageId: d.storageId!,
                              deliverableId: d._id,
                            })
                          }
                        >
                          Open &amp; Comment
                        </Button>
                      )}
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
            <FilterChips<TaskFilter>
              value={taskFilter}
              onChange={setTaskFilter}
              options={[
                { label: "All", value: "all", count: tasks.length },
                { label: "Overdue", value: "overdue", count: overdueCount },
              ]}
            />
            {shownTasks && shownTasks.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center rounded-2xl border border-dashed bg-card">
                <p className="text-muted-foreground">No overdue tasks</p>
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