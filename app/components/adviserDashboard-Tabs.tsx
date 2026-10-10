"use client";
import { useQuery, useMutation } from "convex/react";
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
  Eye,
  FileText,
  FileSpreadsheet,
  Presentation,
  FileArchive,
  File as FileIcon,
  MessageSquare,
  BarChart3,
  CalendarDays,
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";

const PDFViewer = dynamic(
  () => import("@/app/components/PDFViewer").then((mod) => ({ default: mod.PDFViewer })),
  { ssr: false, loading: () => <div className="flex items-center justify-center h-64">Loading PDF viewer...</div> }
);

const OnlyOfficeEditor = dynamic(
  () => import("@/app/components/editor/document-editor"),
  { ssr: false }
);

type StatusFilter = "all" | "under_review" | "approved" | "needs_revision" | "pending";

const isPdf = (fileName: string) => fileName.toLowerCase().endsWith(".pdf");

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
  groupManagement: { title: "Group management", description: "Manage your assigned capstone group." },
  reviewDeliverables: { title: "Review deliverables", description: "Review, comment on, and approve your group's submissions." },
  trackProgress: { title: "Track progress", description: "Generate and download your detailed reports." },
};

const rowClass =
  "rounded-2xl border bg-card p-4 mb-3 transition-all hover:shadow-md hover:border-blue-200 dark:hover:border-blue-900";

function NoTeamState() {
  return (
    <div className="flex flex-col items-center justify-center py-10 text-center rounded-2xl border border-dashed bg-card">
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

export function AdviserTabsDemo({ capstoneProjectId }: { capstoneProjectId?: Id<"capstoneProjects"> }) {
  const [tab, setTab] = useState("groupManagement");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");

  // PDF viewer
  const [selectedDeliverable, setSelectedDeliverable] = useState<{
    fileName: string;
    storageId: string;
    deliverableId: string;
  } | null>(null);

  // OnlyOffice editor: advisers can only comment (no editing); approved files are read-only
  const [officeDoc, setOfficeDoc] = useState<{
    fileName: string;
    storageId: string;
    deliverableId: string;
    mode: "comment" | "view";
  } | null>(null);

  const me = useQuery(api.users.getMe);
  const hasTeam = !!capstoneProjectId;

  const deliverables = useQuery(
    api.dashboard.getDeliverables,
    capstoneProjectId ? { capstoneProjectId } : "skip"
  );

  const fileUrl = useQuery(
    api.dashboard.getFileUrl,
    selectedDeliverable ? { storageId: selectedDeliverable.storageId as Id<"_storage"> } : "skip"
  );

  const officeUrl = useQuery(
    api.dashboard.getFileUrl,
    officeDoc ? { storageId: officeDoc.storageId as Id<"_storage"> } : "skip"
  );

  const updateStatus = useMutation(api.dashboard.adviserDeliverableStatus);

  const openInOffice = (
    d: { fileName: string; storageId?: string; _id: string; status: string }
  ) => {
    if (!d.storageId) return;
    setOfficeDoc({
      fileName: d.fileName,
      storageId: d.storageId,
      deliverableId: d._id,
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

  return (
    <>
      <Tabs value={tab} onValueChange={setTab} className="w-full">
        {/* Section heading + pill tabs */}
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between mb-4">
          <div>
            <h2 className="text-xl font-semibold text-foreground">{TAB_COPY[tab].title}</h2>
            <p className="text-sm text-muted-foreground">{TAB_COPY[tab].description}</p>
          </div>
          <TabsList className="h-auto gap-1 rounded-full bg-muted p-1 self-start lg:self-auto">
            {[
              { v: "groupManagement", short: "Groups", long: "Group Management" },
              { v: "reviewDeliverables", short: "Reviews", long: "Review Deliverables" },
              { v: "trackProgress", short: "Progress", long: "Track Progress" },
            ].map((t) => (
              <TabsTrigger
                key={t.v}
                value={t.v}
                className="rounded-full px-4 py-1.5 text-sm data-[state=active]:bg-blue-600 data-[state=active]:text-white data-[state=active]:shadow"
              >
                <span className="block md:hidden">{t.short}</span>
                <span className="hidden md:block">{t.long}</span>
              </TabsTrigger>
            ))}
          </TabsList>
        </div>

        {/* Group Management */}
        <TabsContent value="groupManagement">
          {!hasTeam ? (
            <NoTeamState />
          ) : (
            <div className="rounded-2xl border bg-card p-6 flex items-center gap-3">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-blue-100 text-blue-600 dark:bg-blue-900/50 dark:text-blue-300">
                <Users className="h-6 w-6" />
              </div>
              <p className="text-sm text-muted-foreground">Your group details will appear here.</p>
            </div>
          )}
        </TabsContent>

        {/* Review Deliverables */}
        <TabsContent value="reviewDeliverables">
          {!hasTeam ? (
            <NoTeamState />
          ) : (
            <>
              <div className="flex flex-row items-center gap-2 mb-4 overflow-x-auto whitespace-nowrap pb-1">
                {filterButtons.map((btn) => {
                  const active = statusFilter === btn.value;
                  return (
                    <Button
                      key={btn.value}
                      variant={active ? "default" : "outline"}
                      size="sm"
                      className={`rounded-full px-4 text-xs gap-1.5 ${
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
                <div className="flex flex-col items-center justify-center py-10 text-center rounded-2xl border border-dashed bg-card">
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
                          <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full ${fs.wrap}`}>
                            <FileTypeIcon className="h-6 w-6" />
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
                                  <>
                                    <DropdownMenuItem onClick={() => openInOffice(d)}>Add Comment</DropdownMenuItem>
                                    <DropdownMenuItem
                                      onClick={() => updateStatus({ deliverableId: d._id, status: "needs_revision" })}
                                      className="text-amber-600 focus:text-amber-600"
                                    >
                                      Request Revision
                                    </DropdownMenuItem>
                                    <DropdownMenuItem
                                      onClick={() => updateStatus({ deliverableId: d._id, status: "approved" })}
                                      className="text-green-600 focus:text-green-600"
                                    >
                                      Approve
                                    </DropdownMenuItem>
                                  </>
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
                  );
                })
              )}
            </>
          )}
        </TabsContent>

        {/* Track Progress */}
        <TabsContent value="trackProgress">
          {!hasTeam ? (
            <NoTeamState />
          ) : (
            <div className="rounded-2xl border bg-card p-6 flex items-center gap-3">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-violet-100 text-violet-600 dark:bg-violet-900/50 dark:text-violet-300">
                <BarChart3 className="h-6 w-6" />
              </div>
              <p className="text-sm text-muted-foreground">You have 5 reports ready and available to export.</p>
            </div>
          )}
        </TabsContent>
      </Tabs>

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
      {officeDoc && typeof officeUrl === "string" && officeUrl.startsWith("http") && (
        <OnlyOfficeEditor
          fileId={`${officeDoc.deliverableId}-${officeDoc.storageId}`}
          deliverableId={officeDoc.deliverableId}
          fileName={officeDoc.fileName}
          fileUrl={officeUrl}
          mode="comment"
          userId={me?.clerkId}
          userName={me?.name ?? undefined}
          onClose={() => setOfficeDoc(null)}
        />
      )}
    </>
  );
}