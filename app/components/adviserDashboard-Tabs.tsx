"use client";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { useState } from "react";
import dynamic from "next/dynamic";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  MoreVertical,
  Users,
  UserCog,
  Eye,
  FileText,
  FileSpreadsheet,
  Presentation,
  FileArchive,
  File as FileIcon,
  MessageSquare,
  BarChart3,
  CalendarDays,
  ArrowLeft,
  CheckCircle2,
  Clock,
  RotateCw,
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { useTeamProgress } from "@/hooks/useTeamProgress";

const PDFViewer = dynamic(
  () => import("@/app/components/PDFViewer").then((mod) => ({ default: mod.PDFViewer })),
  { ssr: false, loading: () => <div className="flex items-center justify-center h-64">Loading PDF viewer...</div> }
);

const StaffDraftEditor = dynamic(
  () => import("@/app/components/editor/staff-draft-editor"),
  { ssr: false }
);

type StatusFilter = "all" | "under_review" | "approved" | "needs_revision" | "pending";

type Props = {
  capstoneProjectId?: Id<"capstoneProjects">;
  onBack?: () => void;
};

const isPdf = (fileName: string) => fileName.toLowerCase().endsWith(".pdf");

const initials = (name?: string) =>
  (name ?? "?")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((n) => n[0]?.toUpperCase())
    .join("");

// Icon + color per file type
const fileStyle = (fileName: string) => {
  const ext = fileName.split(".").pop()?.toLowerCase() ?? "";
  if (ext === "pdf")
    return { icon: FileText, wrap: "bg-red-100 text-red-600 dark:bg-red-900/50 dark:text-red-300" };
  if (["doc", "docx", "odt"].includes(ext))
    return { icon: FileText, wrap: "bg-blue-100 text-blue-600 dark:bg-blue-900/50 dark:text-blue-300" };
  if (["xls", "xlsx", "ods"].includes(ext))
    return { icon: FileSpreadsheet, wrap: "bg-green-100 text-green-600 dark:bg-green-900/50 dark:text-green-300" };
  if (["ppt", "pptx", "odp"].includes(ext))
    return { icon: Presentation, wrap: "bg-amber-100 text-amber-600 dark:bg-amber-900/50 dark:text-amber-300" };
  if (ext === "zip")
    return { icon: FileArchive, wrap: "bg-violet-100 text-violet-600 dark:bg-violet-900/50 dark:text-violet-300" };
  return { icon: FileIcon, wrap: "bg-muted text-muted-foreground" };
};

const BADGE_BASE =
  "inline-flex items-center justify-center rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap";

const TAB_COPY: Record<string, { title: string; description: string }> = {
  groupManagement: { title: "Group management", description: "Overview of your assigned capstone group." },
  reviewDeliverables: { title: "Review deliverables", description: "Review, comment on, and approve your group's submissions." },
  trackProgress: { title: "Track progress", description: "Generate and download your detailed reports." },
};

const cardClass = "rounded-2xl border bg-card shadow-sm";

const rowClass =
  "rounded-2xl border bg-card p-3 sm:p-4 mb-3 transition-all hover:shadow-md hover:border-blue-200 dark:hover:border-blue-900";

function NoTeamState() {
  return (
    <div className="flex flex-col items-center justify-center py-10 px-4 text-center rounded-2xl border border-dashed bg-card">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-blue-100 text-blue-600 dark:bg-blue-900/50 dark:text-blue-300 mb-4">
        <Users className="h-8 w-8" />
      </div>
      <h3 className="font-semibold text-sm md:text-base text-foreground mb-1">No team assigned yet</h3>
      <p className="text-xs md:text-sm text-muted-foreground max-w-xs">
        You haven&apos;t been assigned to any capstone group yet. Check back later or contact your coordinator.
      </p>
    </div>
  );
}

function StatCard({
  icon,
  wrap,
  value,
  label,
}: {
  icon: React.ReactNode;
  wrap: string;
  value: number;
  label: string;
}) {
  return (
    <div className={`${cardClass} flex items-center gap-3 p-3 sm:gap-4 sm:p-4`}>
      <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl sm:h-12 sm:w-12 ${wrap}`}>{icon}</div>
      <div className="min-w-0">
        <p className="text-2xl font-bold leading-none text-foreground">{value}</p>
        <p className="mt-1 truncate text-sm text-muted-foreground">{label}</p>
      </div>
    </div>
  );
}

export function AdviserTabsDemo({ capstoneProjectId, onBack }: Props) {
  const [tab, setTab] = useState("reviewDeliverables");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");

  // PDF viewer
  const [selectedDeliverable, setSelectedDeliverable] = useState<{
    fileName: string;
    storageId: string;
    deliverableId: string;
    phase: string;
  } | null>(null);

  // OnlyOffice editor: advisers can only comment (no editing); approved files are read-only
  const [officeDoc, setOfficeDoc] = useState<{
    fileName: string;
    storageId: string;
    deliverableId: string;
    phase: string;
    mode: "comment" | "view";
  } | null>(null);

  const me = useQuery(api.users.getMe);
  const hasTeam = !!capstoneProjectId;

  const projects = useQuery(
    api.dashboard.getAdviserProjects,
    me?.clerkId ? { clerkId: me.clerkId } : "skip"
  );
  const project = projects?.find((p) => p._id === capstoneProjectId);

  const members = useQuery(
    api.dashboard.getProjectMembers,
    capstoneProjectId ? { capstoneProjectId } : "skip"
  );
  const adviser = useQuery(
    api.dashboard.getProjectAdviser,
    capstoneProjectId ? { capstoneProjectId } : "skip"
  );
  const stats = useQuery(
    api.dashboard.getDashboardData,
    capstoneProjectId ? { capstoneProjectId } : "skip"
  );

  const deliverables = useQuery(
    api.dashboard.getDeliverables,
    capstoneProjectId ? { capstoneProjectId } : "skip"
  );

  // Same calculation as the dashboard and the teams list
  const progress = useTeamProgress(deliverables, project?.progress ?? 0);

  const fileUrl = useQuery(
    api.dashboard.getFileUrl,
    selectedDeliverable ? { storageId: selectedDeliverable.storageId as Id<"_storage"> } : "skip"
  );

  const openInOffice = (
    d: { fileName: string; storageId?: string; _id: string; status: string; phase: string }
  ) => {
    if (!d.storageId) return;
    setOfficeDoc({
      fileName: d.fileName,
      storageId: d.storageId,
      deliverableId: d._id,
      phase: d.phase,
      mode: d.status === "approved" ? "view" : "comment",
    });
  };

  const getStatusBadge = (status: string) => {
    if (status === "approved") return "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300";
    if (status === "under_review") return "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300";
    if (status === "needs_revision") return "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300";
    return "bg-muted text-muted-foreground";
  };

  const getStatusLabel = (status: string) => {
    if (status === "approved") return "Approved";
    if (status === "under_review") return "Under Review";
    if (status === "needs_revision") return "Needs Revision";
    return status;
  };

  const formatDate = (dateStr: string) =>
    new Date(dateStr).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });

  const filtered =
    deliverables?.filter((d) =>
      statusFilter === "all" ? true : d.status === statusFilter
    ) ?? [];

  const countFor = (v: StatusFilter) =>
    v === "all" ? deliverables?.length ?? 0 : deliverables?.filter((d) => d.status === v).length ?? 0;

  const filterButtons: { label: string; value: StatusFilter }[] = [
    { label: "All", value: "all" },
    { label: "Under Review", value: "under_review" },
    { label: "Approved", value: "approved" },
    { label: "Needs Revision", value: "needs_revision" },
  ];

  if (!hasTeam) return <NoTeamState />;

  return (
    <>
      <div className="space-y-4 sm:space-y-5">
        {/* Back + phase badge */}
        <div className="flex items-center justify-between gap-2">
          {onBack ? (
            <Button variant="outline" size="sm" onClick={onBack} className="rounded-xl gap-1.5 text-xs">
              <ArrowLeft className="h-3.5 w-3.5" /> Back to Teams
            </Button>
          ) : (
            <span />
          )}
          {project && (
            <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-medium text-blue-600 dark:bg-blue-900/40 dark:text-blue-300">
              {project.phase}
            </span>
          )}
        </div>

        {/* Team header card */}
        <div className={`${cardClass} p-4 sm:p-6`}>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="break-words text-2xl font-bold text-foreground sm:text-3xl">{project?.teamName ?? "..."}</h1>
            {project?.projectTitle && (
              <span className="max-w-full truncate rounded-full bg-blue-50 px-2.5 py-0.5 text-[11px] font-medium text-blue-600 dark:bg-blue-900/40 dark:text-blue-300">
                {project.projectTitle}
              </span>
            )}
          </div>

          <div className="mt-4 border-t pt-4 sm:mt-5">
            <div className="flex items-center justify-between gap-2 text-sm">
              <span className="min-w-0 truncate font-medium text-foreground">
                Current Phase: <span className="text-blue-600">{project?.phase ?? "-"}</span>
              </span>
              <span className="shrink-0 font-semibold text-foreground">{progress}%</span>
            </div>
            <div className="mt-2 h-2.5 w-full overflow-hidden rounded-full bg-muted">
              <div className="h-full rounded-full bg-blue-600 transition-all" style={{ width: `${progress}%` }} />
            </div>
          </div>
        </div>

        {/* Stat cards */}
        <div className="grid gap-3 sm:grid-cols-3 sm:gap-4">
          <StatCard
            icon={<CheckCircle2 className="h-5 w-5" />}
            wrap="bg-green-100 text-green-600 dark:bg-green-900/40 dark:text-green-300"
            value={stats?.approvedCount ?? 0}
            label="Approved Deliverables"
          />
          <StatCard
            icon={<Clock className="h-5 w-5" />}
            wrap="bg-blue-100 text-blue-600 dark:bg-blue-900/40 dark:text-blue-300"
            value={stats?.underReviewCount ?? 0}
            label="Under Review"
          />
          <StatCard
            icon={<RotateCw className="h-5 w-5" />}
            wrap="bg-amber-100 text-amber-600 dark:bg-amber-900/40 dark:text-amber-300"
            value={stats?.needsRevisionCount ?? 0}
            label="Needs Revision"
          />
        </div>

        {/* Adviser + roster */}
        <div className="grid gap-4 lg:grid-cols-[2fr_3fr]">
          <div className={`${cardClass} min-w-0 p-4 sm:p-5`}>
            <div className="mb-4 flex items-center justify-between">
              <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
                <UserCog className="h-4 w-4 text-blue-600" /> Adviser
              </h3>
              <span className="rounded bg-blue-50 px-2 py-0.5 text-[11px] font-medium text-blue-600 dark:bg-blue-900/40 dark:text-blue-300">
                Supervisor
              </span>
            </div>
            {adviser ? (
              <div className="flex items-center gap-3 rounded-xl border bg-muted/40 p-3 sm:p-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-purple-600 text-xs font-semibold text-white">
                  {initials(adviser.name)}
                </div>
                <div className="min-w-0">
                  <p className="flex items-center gap-2 text-sm font-semibold text-foreground">
                    <span className="truncate">{adviser.name}</span>
                    {me?._id === adviser._id && (
                      <span className="shrink-0 rounded bg-blue-600 px-1.5 py-0.5 text-[10px] font-semibold text-white">You</span>
                    )}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">{adviser.email}</p>
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No adviser assigned.</p>
            )}
          </div>

          <div className={`${cardClass} min-w-0 p-4 sm:p-5`}>
            <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold text-foreground">
              <Users className="h-4 w-4 text-blue-600" /> Team Members Roster ( {members?.length ?? 0} )
            </h3>
            <div className="space-y-3">
              {members === undefined ? (
                <p className="text-sm text-muted-foreground">Loading...</p>
              ) : members.length === 0 ? (
                <p className="text-sm text-muted-foreground">No members yet.</p>
              ) : (
                members.map((m) => (
                  <div key={m._id} className="flex items-center justify-between gap-2 rounded-xl border bg-muted/40 p-3 sm:gap-3 sm:p-4">
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-900 text-xs font-semibold text-white">
                        {initials(m.name)}
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-foreground">{m.name}</p>
                        <p className="truncate text-xs text-muted-foreground">{m.email}</p>
                      </div>
                    </div>
                    <span className="shrink-0 rounded-md bg-blue-50 px-2.5 py-0.5 text-[11px] font-medium text-blue-600 dark:bg-blue-900/40 dark:text-blue-300">
                      Student
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Tabs card */}
        <Tabs value={tab} onValueChange={setTab} className={`${cardClass} w-full min-w-0 p-4 sm:p-6`}>
          <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0">
              <h2 className="text-lg font-semibold text-foreground">{TAB_COPY[tab].title}</h2>
              <p className="text-sm text-muted-foreground">{TAB_COPY[tab].description}</p>
            </div>
            <TabsList className="grid h-auto w-full grid-cols-3 gap-1.5 bg-transparent p-0 lg:flex lg:w-auto">
              {[
                { v: "groupManagement", short: "Groups", long: "Group Management" },
                { v: "reviewDeliverables", short: "Reviews", long: "Review Deliverables" },
                { v: "trackProgress", short: "Progress", long: "Track Progress" },
              ].map((t) => (
                <TabsTrigger
                  key={t.v}
                  value={t.v}
                  className="rounded-lg bg-muted px-3 py-2 text-xs font-medium whitespace-nowrap data-[state=active]:bg-blue-600 data-[state=active]:text-white data-[state=active]:shadow lg:px-3.5 lg:py-1.5"
                >
                  <span className="block md:hidden">{t.short}</span>
                  <span className="hidden md:block">{t.long}</span>
                </TabsTrigger>
              ))}
            </TabsList>
          </div>

          {/* Group Management */}
          <TabsContent value="groupManagement">
            <div className="rounded-2xl border bg-muted/30 p-4 text-sm sm:p-5">
              <p className="text-muted-foreground">Project</p>
              <p className="break-words font-semibold text-foreground">{project?.projectTitle ?? "-"}</p>
              <p className="mt-3 text-muted-foreground">Phase</p>
              <p className="font-semibold text-foreground">{project?.phase ?? "-"}</p>
            </div>
          </TabsContent>

          {/* Review Deliverables */}
          <TabsContent value="reviewDeliverables">
            <div className="mb-4 flex flex-row items-center gap-2 overflow-x-auto whitespace-nowrap pb-1">
              {filterButtons.map((btn) => {
                const active = statusFilter === btn.value;
                return (
                  <Button
                    key={btn.value}
                    variant={active ? "default" : "outline"}
                    size="sm"
                    className={`shrink-0 rounded-full px-4 text-xs gap-1.5 ${
                      active ? "bg-blue-600 text-white hover:bg-blue-700" : ""
                    }`}
                    onClick={() => setStatusFilter(btn.value)}
                  >
                    {btn.label}
                    <span
                      className={`rounded-full px-1.5 text-[10px] ${
                        active ? "bg-white/25" : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {countFor(btn.value)}
                    </span>
                  </Button>
                );
              })}
            </div>

            {deliverables === undefined ? (
              <p className="text-center py-4 text-muted-foreground">Loading...</p>
            ) : filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 px-4 text-center rounded-2xl border border-dashed bg-card">
                <FileText className="h-12 w-12 text-muted-foreground/40 mb-3" />
                <p className="font-medium text-foreground">No deliverables found</p>
                <p className="text-sm text-muted-foreground mt-1">
                  {statusFilter === "all"
                    ? "No submissions yet from your group."
                    : `No deliverables with status "${getStatusLabel(statusFilter)}".`}
                </p>
              </div>
            ) : (
              filtered.map((d) => {
                const fs = fileStyle(d.fileName);
                const FileTypeIcon = fs.icon;
                return (
                  <div key={d._id} className={rowClass}>
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full sm:h-12 sm:w-12 ${fs.wrap}`}>
                          <FileTypeIcon className="h-5 w-5 sm:h-6 sm:w-6" />
                        </div>
                        <div className="min-w-0">
                          <h3 className="font-semibold text-foreground text-sm lg:text-base truncate">{d.fileName}</h3>
                          <p className="text-muted-foreground text-xs">
                            Phase: {d.phase} • Version {d.version}
                          </p>
                          <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-muted-foreground text-xs mt-0.5">
                            <span className="inline-flex items-center gap-1">
                              <CalendarDays className="h-3.5 w-3.5" /> {formatDate(d.uploadedAt)}
                            </span>
                            <span className="inline-flex items-center gap-1">
                              <MessageSquare className="h-3.5 w-3.5" /> {d.comments ?? 0}
                            </span>
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 justify-between sm:justify-end">
                        <span className={`${BADGE_BASE} ${getStatusBadge(d.status)}`}>{getStatusLabel(d.status)}</span>

                        <div className="flex items-center gap-1">
                          {/* PDFs open in your viewer (its Comment button goes to OnlyOffice).
                              Word / Excel / PowerPoint go straight to OnlyOffice. */}
                          <Button
                            size="sm"
                            className="rounded-full bg-blue-600 px-4 gap-1.5 text-white hover:bg-blue-700"
                            onClick={() =>
                              isPdf(d.fileName)
                                ? setSelectedDeliverable({
                                    fileName: d.fileName,
                                    storageId: d.storageId!,
                                    deliverableId: d._id,
                                    phase: d.phase,
                                  })
                                : openInOffice(d)
                            }
                          >
                            <Eye className="h-3.5 w-3.5" /> View
                          </Button>

                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <button className="p-1.5 rounded-md hover:bg-muted transition-colors" aria-label="Review options">
                                <MoreVertical className="h-4 w-4 text-muted-foreground" />
                              </button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-44">
                              <DropdownMenuGroup>
                                {d.status === "under_review" && (
                                  <DropdownMenuItem onClick={() => openInOffice(d)}>Add Comment</DropdownMenuItem>
                                )}
                                {d.status === "needs_revision" && (
                                  <>
                                    <DropdownMenuItem onClick={() => openInOffice(d)}>View Feedback</DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => openInOffice(d)}>Add Comment</DropdownMenuItem>
                                  </>
                                )}
                                {d.status === "approved" && (
                                  <DropdownMenuItem onClick={() => openInOffice(d)}>View Comments</DropdownMenuItem>
                                )}
                              </DropdownMenuGroup>
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

          {/* Track Progress */}
          <TabsContent value="trackProgress">
            <div className="rounded-2xl border bg-muted/30 p-4 sm:p-6 flex items-center gap-3">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-violet-100 text-violet-600 dark:bg-violet-900/50 dark:text-violet-300">
                <BarChart3 className="h-6 w-6" />
              </div>
              <p className="text-sm text-muted-foreground">You have 5 reports ready and available to export.</p>
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* PDF viewer: its Comment button hands the file over to OnlyOffice */}
      <PDFViewer
        open={!!selectedDeliverable && typeof fileUrl === "string" && fileUrl.startsWith("http")}
        fileUrl={fileUrl ?? ""}
        fileName={selectedDeliverable?.fileName ?? ""}
        deliverableId={selectedDeliverable?.deliverableId as Id<"deliverables"> | undefined}
        userId={me?.clerkId}
        userName={me?.name ?? ""}
        onClose={() => setSelectedDeliverable(null)}
        onComment={() => {
          if (!selectedDeliverable) return;
          const current = deliverables?.find((x) => x._id === selectedDeliverable.deliverableId);
          setOfficeDoc({
            ...selectedDeliverable,
            mode: current?.status === "approved" ? "view" : "comment",
          });
          setSelectedDeliverable(null);
        }}
      />

      {/* OnlyOffice editor */}
      {officeDoc && capstoneProjectId && (
        <StaffDraftEditor
          key={officeDoc.deliverableId}
          deliverableId={officeDoc.deliverableId as Id<"deliverables">}
          capstoneProjectId={capstoneProjectId}
          deliverables={deliverables ?? []}
          userId={me?.clerkId}
          userName={me?.name ?? undefined}
          onClose={() => setOfficeDoc(null)}
        />
      )}
    </>
  );
}