"use client";
import { useRouter } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import { useState, useRef, useEffect, useMemo } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { SelectDemo } from "@/app/components/select";
import { toast } from "sonner";
import dynamic from "next/dynamic";
import { DeleteDeliverable } from "@/app/components/deleteDeliverable";
import { chapterOf, computeProgress, CHAPTER_MAX, TOTAL_CHAPTERS } from "@/lib/progress";
import {
  MoreVertical,
  FileText,
  FileSpreadsheet,
  Presentation,
  FileArchive,
  File as FileIcon,
  UploadCloud,
  CheckSquare,
  CalendarDays,
  Loader2,
  Play,
  Check,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const PDFViewer = dynamic(
  () => import("@/app/components/PDFViewer").then((mod) => ({ default: mod.PDFViewer })),
  {
    ssr: false,
    loading: () => <div className="flex items-center justify-center h-64">Loading PDF viewer...</div>,
  }
);

const OnlyOfficeEditor = dynamic(() => import("@/app/components/editor/document-editor"), {
  ssr: false,
});

const isPdf = (fileName: string) => fileName.toLowerCase().endsWith(".pdf");
// Office files open in OnlyOffice; PDFs stay in your own PDFViewer (it supports highlightPage)
const OFFICE_EXTENSIONS = ["doc", "docx", "odt", "xls", "xlsx", "ods", "ppt", "pptx", "odp"];
const isOffice = (fileName: string) =>
  OFFICE_EXTENSIONS.includes(fileName.split(".").pop()?.toLowerCase() ?? "");

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
  deliverables: { title: "Deliverables", description: "Your submitted files and their review status." },
  uploads: { title: "Upload new", description: "Upload a new version of your project deliverable." },
  tasks: { title: "Tasks", description: "Tasks your instructor assigned to your team." },
};

const rowClass =
  "rounded-2xl border bg-card p-4 mb-3 transition-all hover:shadow-md hover:border-blue-200 dark:hover:border-blue-900";

const progressBarColor = (status: string | null) => {
  if (status === "approved") return "bg-green-600";
  if (status === "needs_revision") return "bg-amber-500";
  return "bg-blue-600";
};

// Each row gets its own URL, so "Download File" always points to the right file.
function DownloadItem({ storageId }: { storageId?: string }) {
  const url = useQuery(
    api.dashboard.getFileUrl,
    storageId ? { storageId: storageId as Id<"_storage"> } : "skip"
  );
  return (
    <DropdownMenuItem asChild disabled={!url}>
      <a href={url ?? "#"} target="_blank" rel="noopener noreferrer">
        Download File
      </a>
    </DropdownMenuItem>
  );
}

export function TabsDemo({
  capstoneProjectId,
  highlightDeliverableId,
  highlightPage,
}: {
  capstoneProjectId?: Id<"capstoneProjects">;
  highlightDeliverableId?: Id<"deliverables"> | null;
  highlightPage?: number | null;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [phase, setPhase] = useState("");
  const [uploading, setUploading] = useState(false);
  const [dragging, setDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const { user } = useUser();

  // PDF viewer
  const [selectedDeliverable, setSelectedDeliverable] = useState<{
    fileName: string;
    storageId: string;
    deliverableId: string;
    initialPage: number;
  } | null>(null);
  const fileUrl = useQuery(
    api.dashboard.getFileUrl,
    selectedDeliverable ? { storageId: selectedDeliverable.storageId as Id<"_storage"> } : "skip"
  );

  // OnlyOffice editor (Word / Excel / PowerPoint)
  const [officeDoc, setOfficeDoc] = useState<{
    fileName: string;
    storageId: string;
    deliverableId: string;
    mode: "edit" | "view";
  } | null>(null);
  const officeUrl = useQuery(
    api.dashboard.getFileUrl,
    officeDoc ? { storageId: officeDoc.storageId as Id<"_storage"> } : "skip"
  );

  const generateUploadUrl = useMutation(api.dashboard.generateUploadUrl);
  const saveDeliverable = useMutation(api.dashboard.saveDeliverable);
  const updateTaskStatus = useMutation(api.dashboard.updateTaskStatus);

  const [activeTab, setActiveTab] = useState("deliverables");
  const deliverables = useQuery(
    api.dashboard.getDeliverables,
    capstoneProjectId ? { capstoneProjectId } : "skip"
  );

  // Progress is computed from the latest version of each chapter
  const progress = useMemo(() => computeProgress(deliverables ?? []), [deliverables]);
  const chosenChapter = chapterOf(phase);
  const chosen = chosenChapter ? progress.chapters[chosenChapter - 1] : null;
  const alreadyApproved = chosen?.status === "approved";

  let uploadHint = "";
  if (chosenChapter && chosen) {
    if (alreadyApproved) uploadHint = `Chapter ${chosenChapter} is already approved.`;
    else if (chosen.status === "needs_revision")
      uploadHint = `Resubmitting keeps Chapter ${chosenChapter} at 15% until your adviser approves it.`;
    else if (chosen.status === "under_review")
      uploadHint = `This replaces the version under review. Chapter ${chosenChapter} stays at ${chosen.points}%.`;
    else uploadHint = `Chapter ${chosenChapter} moves to 10% when you upload.`;
  }

  useEffect(() => {
    if (!highlightDeliverableId || !deliverables) return;
    const match = deliverables.find((d) => d._id === highlightDeliverableId);
    if (match && match.storageId && isPdf(match.fileName)) {
      setSelectedDeliverable({
        fileName: match.fileName,
        storageId: match.storageId,
        deliverableId: match._id,
        initialPage: highlightPage || 1,
      });
      setTimeout(() => {
        router.replace(window.location.pathname, { scroll: false });
      }, 500);
    }
  }, [highlightDeliverableId, deliverables]);

  const tasks = useQuery(
    api.dashboard.getTasks,
    capstoneProjectId ? { capstoneProjectId } : "skip"
  );

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) setFile(e.target.files[0]);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragging(false);
    if (e.dataTransfer.files?.[0]) setFile(e.dataTransfer.files[0]);
  };

  const handleUpload = async () => {
    if (!file || !phase || !capstoneProjectId) {
      toast.error("Please select a file and chapter first.");
      return;
    }
    if (alreadyApproved) {
      toast.error("This chapter is already approved.");
      return;
    }
    setUploading(true);
    try {
      const uploadUrl = await generateUploadUrl();

      const formData = new FormData();
      formData.append("file", file);

      const result = await fetch(uploadUrl, {
        method: "POST",
        body: formData,
      });

      if (!result.ok) {
        throw new Error(`Upload failed with status ${result.status}`);
      }

      const { storageId } = await result.json();

      await saveDeliverable({
        storageId,
        fileName: file.name,
        phase,
        fileSize: `${(file.size / (1024 * 1024)).toFixed(2)}MB`,
        capstoneProjectId,
      });

      toast.success("Uploaded successfully!");
      setFile(null);
      setPhase("");
      setActiveTab("deliverables");
    } catch (err) {
      console.error(err);
      toast.error(`Upload failed: ${err}`);
    } finally {
      setUploading(false);
    }
  };

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

  return (
    <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
      {/* Project progress (visible on every tab) */}
      {deliverables !== undefined && (
        <div className="rounded-2xl border bg-card p-5 lg:p-6 mb-6">
          <div className="flex items-end justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-foreground">Project progress</h2>
              <p className="text-sm text-muted-foreground">
                {progress.approved} of {TOTAL_CHAPTERS} chapters approved
              </p>
            </div>
            <span className="text-3xl font-semibold text-foreground tabular-nums">{progress.total}%</span>
          </div>
          {/* grid-cols-5 matches TOTAL_CHAPTERS = 5 */}
          <div className="mt-4 grid grid-cols-5 gap-1.5">
            {progress.chapters.map((c) => (
              <div key={c.chapter}>
                <div className="h-2.5 overflow-hidden rounded-full bg-muted">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${progressBarColor(c.status)}`}
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
      )}

      {/* Section heading + pill tabs */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end  sm:justify-between mb-4">
        <div >
          <h2 className="text-xl font-semibold text-foreground">{TAB_COPY[activeTab].title}</h2>
          <p className="text-sm text-muted-foreground">{TAB_COPY[activeTab].description}</p>
        </div>
        <TabsList className="h-auto gap-1 rounded-full bg-muted p-1 self-start sm:self-auto">
          {[
            { v: "deliverables", label: "Deliverables" },
            { v: "uploads", label: "Upload New" },
            { v: "tasks", label: "Tasks" },
          ].map((t) => (
            <TabsTrigger
              key={t.v}
              value={t.v}
              className="rounded-full px-4 py-1.5 text-sm data-[state=active]:bg-blue-600 data-[state=active]:text-white data-[state=active]:shadow"
            >
              {t.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </div>

      {/* DELIVERABLES */}
      <TabsContent value="deliverables">
        {deliverables === undefined ? (
          <p className="text-center py-4 text-muted-foreground">Loading...</p>
        ) : deliverables.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-center rounded-2xl border border-dashed bg-card">
            <FileText className="h-12 w-12 text-muted-foreground/40 mb-3" />
            <p className="font-medium text-foreground">No deliverables yet</p>
            <p className="text-sm text-muted-foreground mt-1">Upload your first deliverable in the Upload New tab.</p>
            <Button
              onClick={() => setActiveTab("uploads")}
              className="mt-4 rounded-full bg-blue-600 px-5 text-white hover:bg-blue-700"
              size="sm"
            >
              Upload now
            </Button>
          </div>
        ) : (
          deliverables.map((d) => {
            const fs = fileStyle(d.fileName);
            const FileTypeIcon = fs.icon;
            const chNum = chapterOf(d.phase);
            const cp = chNum ? progress.chapters[chNum - 1] : null;
            const isLatest = !!cp && cp.latestId === d._id;
            return (
              <div key={d._id} className={`${rowClass} ${chNum && !isLatest ? "opacity-60" : ""}`}>
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full ${fs.wrap}`}>
                      <FileTypeIcon className="h-6 w-6" />
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

                  <div className="flex items-center gap-1 shrink-0">
                    <span className={`${BADGE_BASE} ${getStatusBadge(d.status)}`}>{getStatusLabel(d.status)}</span>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button className="p-1.5 rounded-md hover:bg-muted transition-colors" aria-label="File options">
                          <MoreVertical className="h-4 w-4 text-muted-foreground" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="flex flex-col justify-center">
                        {d.status === "needs_revision" && (
                          <DropdownMenuItem onClick={() => setActiveTab("uploads")}>
                            Resubmit
                          </DropdownMenuItem>
                        )}

                        {isPdf(d.fileName) ? (
                          <>
                            <DropdownMenuItem
                              onClick={() =>
                                setSelectedDeliverable({
                                  fileName: d.fileName,
                                  storageId: d.storageId!,
                                  deliverableId: d._id,
                                  initialPage: 1,
                                })
                              }
                            >
                              View File
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() =>
                                setOfficeDoc({
                                  fileName: d.fileName,
                                  storageId: d.storageId!,
                                  deliverableId: d._id,
                                  mode: d.status === "approved" ? "view" : "edit",
                                })
                              }
                            >
                              Open in OnlyOffice
                            </DropdownMenuItem>
                          </>
                        ) : isOffice(d.fileName) ? (
                          <DropdownMenuItem
                            onClick={() =>
                              setOfficeDoc({
                                fileName: d.fileName,
                                storageId: d.storageId!,
                                deliverableId: d._id,
                                mode: d.status === "approved" ? "view" : "edit",
                              })
                            }
                          >
                            {d.status === "approved" ? "View in Editor" : "Open in Editor"}
                          </DropdownMenuItem>
                        ) : null}

                        {/* Download is available for every file type */}
                        {!isPdf(d.fileName) && <DownloadItem storageId={d.storageId} />}

                        <DropdownMenuItem
                          className="text-destructive focus:text-destructive"
                          onSelect={(e) => e.preventDefault()}
                        >
                          <DeleteDeliverable
                            deliverableId={d._id}
                            fileName={d.fileName}
                            trigger={<span className="w-full text-sm">Delete</span>}
                          />
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>

                {/* Chapter progress (latest version only) */}
                {cp && isLatest && (
                  <div className="mt-3 flex items-center gap-3">
                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${progressBarColor(cp.status)}`}
                        style={{ width: `${(cp.points / CHAPTER_MAX) * 100}%` }}
                      />
                    </div>
                    <span className="min-w-18 text-right text-xs text-muted-foreground">
                      {cp.points}% of {CHAPTER_MAX}%
                    </span>
                  </div>
                )}
                {!chNum && (
                  <p className="mt-2 text-xs text-amber-600 dark:text-amber-400">
                    Saved under an older phase, so it is not counted in progress.
                  </p>
                )}
              </div>
            );
          })
        )}
      </TabsContent>

      {/* UPLOAD */}
      <TabsContent value="uploads">
        <div className="rounded-2xl border bg-card p-5 lg:p-6 space-y-5">
          <div className="space-y-1.5">
            <label className="text-foreground text-sm font-medium">Chapter </label>
            <SelectDemo value={phase} onValueChange={setPhase} />
            {uploadHint && (
              <p
                className={`rounded-lg px-3 py-2 text-xs ${
                  alreadyApproved
                    ? "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300"
                    : "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300"
                }`}
              >
                {uploadHint}
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <label className="text-foreground text-sm font-medium">Select file</label>
            <div
              onClick={() => fileInputRef.current?.click()}
              onDragOver={(e) => {
                e.preventDefault();
                setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={handleDrop}
              className={`cursor-pointer rounded-2xl border-2 border-dashed flex items-center justify-center p-8 transition-colors ${
                dragging
                  ? "border-blue-500 bg-blue-50 dark:bg-blue-950/30"
                  : "border-border hover:border-blue-400 hover:bg-blue-50/50 dark:hover:bg-blue-950/20"
              }`}
            >
              <div className="flex flex-col items-center justify-center text-center">
                {file ? (
                  <>
                    <div className={`flex h-14 w-14 items-center justify-center rounded-full ${fileStyle(file.name).wrap}`}>
                      <FileText className="h-7 w-7" />
                    </div>
                    <p className="mt-3 text-sm font-medium text-foreground break-all">{file.name}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {(file.size / (1024 * 1024)).toFixed(2)}MB • Click to choose a different file
                    </p>
                  </>
                ) : (
                  <>
                    <div className="flex h-14 w-14 items-center justify-center rounded-full bg-blue-100 text-blue-600 dark:bg-blue-900/50 dark:text-blue-300">
                      <UploadCloud className="h-7 w-7" />
                    </div>
                    <p className="mt-3 text-sm font-medium text-foreground">Click to select a file, or drag it here</p>
                    <p className="text-xs text-muted-foreground mt-1">PDF, DOC, DOCX, XLSX, PPTX, or ZIP (max 50MB)</p>
                  </>
                )}
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.doc,.docx,.xlsx,.pptx,.zip"
                onChange={handleFileChange}
                className="hidden"
              />
            </div>
          </div>

          <Button
            onClick={handleUpload}
            disabled={!file || !phase || uploading || alreadyApproved}
            className="h-11 w-full rounded-xl gap-2 bg-blue-600 text-white hover:bg-blue-700"
          >
            {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <UploadCloud className="h-4 w-4" />}
            {uploading ? "Uploading..." : "Upload deliverable"}
          </Button>
        </div>
      </TabsContent>

      {/* TASKS */}
      <TabsContent value="tasks">
        {tasks === undefined ? (
          <p className="text-center py-4 text-muted-foreground">Loading...</p>
        ) : tasks.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-center rounded-2xl border border-dashed bg-card">
            <CheckSquare className="h-12 w-12 text-muted-foreground/40 mb-3" />
            <p className="font-medium text-foreground">No tasks yet</p>
            <p className="text-sm text-muted-foreground mt-1">Tasks will be created by your instructor.</p>
          </div>
        ) : (
          tasks.map((task) => (
            <div key={task._id} className={rowClass}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3 min-w-0">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-blue-100 text-blue-600 dark:bg-blue-900/50 dark:text-blue-300">
                    <CheckSquare className="h-6 w-6" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-semibold text-foreground text-sm lg:text-base">{task.title}</h3>
                    <p className="text-muted-foreground text-xs mt-0.5 wrap-break-word">{task.description}</p>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 text-xs text-muted-foreground">
                      <span>Assigned to: {task.assignedTo}</span>
                      <span className="inline-flex items-center gap-1">
                        <CalendarDays className="h-3.5 w-3.5" /> Due {formatDate(task.dueDate)}
                      </span>
                    </div>
                  </div>
                </div>
                <span className={`${BADGE_BASE} ${getTaskBadge(task.status)}`}>{getTaskLabel(task.status)}</span>
              </div>

              <div className="flex justify-end mt-3">
                <Button
                  size="sm"
                  disabled={task.status === "completed"}
                  onClick={() => {
                    if (task.status === "pending") updateTaskStatus({ taskId: task._id, status: "in_progress" });
                    else if (task.status === "in_progress") updateTaskStatus({ taskId: task._id, status: "completed" });
                  }}
                  className={`rounded-full px-4 gap-1.5 text-white ${
                    task.status === "pending"
                      ? "bg-blue-600 hover:bg-blue-700"
                      : task.status === "in_progress"
                      ? "bg-green-600 hover:bg-green-700"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  {task.status === "pending" ? (
                    <>
                      <Play className="h-3.5 w-3.5" /> Start task
                    </>
                  ) : task.status === "in_progress" ? (
                    <>
                      <Check className="h-3.5 w-3.5" /> Mark as done
                    </>
                  ) : (
                    <>
                      <Check className="h-3.5 w-3.5" /> Completed
                    </>
                  )}
                </Button>
              </div>
            </div>
          ))
        )}
      </TabsContent>

      {/* PDF viewer */}
      <PDFViewer
        open={!!selectedDeliverable && typeof fileUrl === "string" && fileUrl.startsWith("http")}
        fileUrl={fileUrl ?? ""}
        fileName={selectedDeliverable?.fileName ?? ""}
        deliverableId={selectedDeliverable?.deliverableId as Id<"deliverables"> | undefined}
        initialPage={selectedDeliverable?.initialPage ?? 1}
        onClose={() => setSelectedDeliverable(null)}
      />

      {/* OnlyOffice editor */}
      {officeDoc && typeof officeUrl === "string" && officeUrl.startsWith("http") && (
        <OnlyOfficeEditor
          // key changes after every save, so OnlyOffice never serves a stale cached copy
          fileId={`${officeDoc.deliverableId}-${officeDoc.storageId}`}
          deliverableId={officeDoc.deliverableId}
          fileName={officeDoc.fileName}
          fileUrl={officeUrl}
          mode={officeDoc.mode}
          userId={user?.id}
          userName={user?.fullName ?? undefined}
          onClose={() => setOfficeDoc(null)}
        />
      )}
    </Tabs>
  );
}