"use client";

import { useRouter } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import { useState, useRef, useEffect, useLayoutEffect, useMemo } from "react";
import { useMutation, useQuery, useConvex } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { forceSaveDraft } from "@/lib/onlyoffice-draft";
import { Button } from "@/components/ui/button";
import { SelectDemo } from "@/app/components/select";
import { toast } from "sonner";
import dynamic from "next/dynamic";
import { DeleteDeliverable } from "@/app/components/deleteDeliverable";
import { chapterOf, computeProgress } from "@/lib/progress";
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
  Undo2,
  RotateCcw,
  CheckCircle2,
  Clock,
  Info,
  Pencil,
  Plus,
  X,
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
  "inline-flex items-center justify-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap";
const CARD = "rounded-2xl border bg-card shadow-xs";
const TH = "px-4 py-3 text-left text-sm font-semibold text-foreground whitespace-nowrap";
const EDITOR_SESSION_KEY = "student-editor-session";

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

// Student-side task button. "Mark as Done" sends the task to the instructor for review.
function TaskActions({
  status,
  onChange,
}: {
  status: string;
  onChange: (s: "in_progress" | "under_review") => void;
}) {
  if (status === "completed")
    return (
      <Button size="sm" disabled variant="outline" className="rounded-lg gap-1.5 text-muted-foreground">
        <Check className="h-3.5 w-3.5" /> Completed
      </Button>
    );

  if (status === "under_review")
    return (
      <Button
        size="sm"
        variant="outline"
        className="rounded-lg gap-1.5 text-blue-700 border-blue-300 dark:text-blue-300 dark:border-blue-800"
        onClick={() => onChange("in_progress")}
      >
        <Undo2 className="h-3.5 w-3.5" /> Undo
      </Button>
    );

  if (status === "needs_revision")
    return (
      <Button
        size="sm"
        className="rounded-lg gap-1.5 bg-orange-500 text-white hover:bg-orange-600"
        onClick={() => onChange("under_review")}
      >
        <RotateCcw className="h-3.5 w-3.5" /> Resubmit
      </Button>
    );

  if (status === "in_progress")
    return (
      <Button
        size="sm"
        className="rounded-lg gap-1.5 bg-blue-600 text-white hover:bg-blue-700"
        onClick={() => onChange("under_review")}
      >
        Mark as Done
      </Button>
    );

  return (
    <Button
      size="sm"
      className="rounded-lg gap-1.5 bg-blue-600 text-white hover:bg-blue-700"
      onClick={() => onChange("in_progress")}
    >
      <Play className="h-3.5 w-3.5" /> Start Task
    </Button>
  );
}

export function TabsDemo({
  capstoneProjectId,
  proposalResult,
  isArchived = false,
  highlightDeliverableId,
  highlightPage,
  showBanner = true,
}: {
  capstoneProjectId?: Id<"capstoneProjects">;
  proposalResult?: "passed" | "passed_with_revisions" | "failed";
  isArchived?: boolean;
  highlightDeliverableId?: Id<"deliverables"> | null;
  highlightPage?: number | null;
  /** Set to false if your page already renders its own "Manuscript & Task Management" banner. */
  showBanner?: boolean;
}) {
  const router = useRouter();
  const { user } = useUser();
  const convex = useConvex();
  // Assumes Clerk publicMetadata.role === "admin". Change this line if your admin check differs.
  const isAdmin = (user?.publicMetadata as { role?: string } | undefined)?.role === "admin";

  // Upload section
  const [showUpload, setShowUpload] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [phase, setPhase] = useState("");
  const [uploading, setUploading] = useState(false);
  const [dragging, setDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Tasks filter
  const [taskFilter, setTaskFilter] = useState("all");

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
    phase: string;
    mode: "edit" | "view";
    fileUrl?: string;
    draft?: { id: string; baseVersion: number; docKey: string; phase: string; fileSize: string };
  } | null>(null);
  const [isRestoringEditor, setIsRestoringEditor] = useState(false);
  const restoreAttemptStartedRef = useRef(false);

  useLayoutEffect(() => {
    if (sessionStorage.getItem(EDITOR_SESSION_KEY)) {
      setIsRestoringEditor(true);
    }
  }, []);

  const officeUrl = useQuery(
    api.dashboard.getFileUrl,
    officeDoc ? { storageId: officeDoc.storageId as Id<"_storage"> } : "skip"
  );

  // Remember the file URL once it has loaded, so a late save that replaces the
  // draft file can't tear the editor down while you're working in it.
  const [loadedOfficeUrl, setLoadedOfficeUrl] = useState<{ storageId: string; url: string } | null>(null);

  useEffect(() => {
    if (!officeDoc) {
      setLoadedOfficeUrl(null);
      return;
    }
    if (
      typeof officeUrl === "string" &&
      officeUrl.startsWith("http") &&
      loadedOfficeUrl?.storageId !== officeDoc.storageId
    ) {
      setLoadedOfficeUrl({ storageId: officeDoc.storageId, url: officeUrl });
    }
  }, [officeDoc, officeUrl, loadedOfficeUrl]);

  const resolvedOfficeUrl =
    officeDoc?.fileUrl ??
    (officeDoc && loadedOfficeUrl?.storageId === officeDoc.storageId
      ? loadedOfficeUrl.url
      : null);

  // Only complain if the file never loaded at all
  useEffect(() => {
    if (officeDoc && officeUrl === null && !resolvedOfficeUrl) {
      toast.error("The draft file is missing. Please try again.");
      if (isRestoringEditor) {
        sessionStorage.removeItem(EDITOR_SESSION_KEY);
        setIsRestoringEditor(false);
      }
      setOfficeDoc(null);
    }
  }, [officeDoc, officeUrl, resolvedOfficeUrl, isRestoringEditor]);

  const generateUploadUrl = useMutation(api.dashboard.generateUploadUrl);
  const saveDeliverable = useMutation(api.dashboard.saveDeliverable);
  const studentUpdateTask = useMutation(api.dashboard.studentUpdateTask);
  const startDraft = useMutation(api.drafts.startDraft);

  const deliverables = useQuery(
    api.dashboard.getDeliverables,
    capstoneProjectId ? { capstoneProjectId } : "skip"
  );
  const tasks = useQuery(
    api.dashboard.getTasks,
    capstoneProjectId ? { capstoneProjectId } : "skip"
  );

  type Deliverable = NonNullable<typeof deliverables>[number];

  // Restore editor session if the page was refreshed during an edit
  useEffect(() => {
    if (!deliverables || officeDoc || restoreAttemptStartedRef.current) return;
    const saved = sessionStorage.getItem(EDITOR_SESSION_KEY);
    if (!saved) return;

    restoreAttemptStartedRef.current = true;
    let target: { deliverableId: string } | null = null;
    try {
      target = JSON.parse(saved) as { deliverableId: string };
    } catch {
      sessionStorage.removeItem(EDITOR_SESSION_KEY);
      setIsRestoringEditor(false);
      return;
    }

    const deliverable = deliverables.find((item) => item._id === target?.deliverableId);
    if (!deliverable) {
      sessionStorage.removeItem(EDITOR_SESSION_KEY);
      setIsRestoringEditor(false);
      return;
    }

    setIsRestoringEditor(true);
    void startDraft({ deliverableId: deliverable._id })
      .then((draft) => {
        setOfficeDoc({
          fileName: deliverable.fileName,
          storageId: draft.storageId,
          deliverableId: deliverable._id,
          phase: deliverable.phase,
          mode: "edit",
          draft: {
            id: draft.draftId,
            baseVersion: draft.baseVersion,
            docKey: `${draft.draftId}-${draft.storageId}`,
            phase: deliverable.phase,
            fileSize: deliverable.fileSize,
          },
        });
      })
      .catch((error) => {
        sessionStorage.removeItem(EDITOR_SESSION_KEY);
        setIsRestoringEditor(false);
        toast.error(error instanceof Error ? error.message : "Couldn't restore the editor.");
      });
  }, [deliverables, officeDoc, startDraft]);

  const progress = useMemo(() => computeProgress(deliverables ?? []), [deliverables]);
  const chosenChapter = chapterOf(phase);
  const chosen = chosenChapter ? progress.chapters[chosenChapter - 1] : null;
  const alreadyApproved = chosen?.status === "approved";

  // Chapters 4-5 stay locked until the proposal defense is passed
  const proposalDone =
    proposalResult === "passed" || proposalResult === "passed_with_revisions";
  const proposalLocked = !!chosenChapter && chosenChapter >= 4 && !proposalDone;

  let uploadHint = "";
  if (chosenChapter && chosen) {
    if (proposalLocked)
      uploadHint =
        proposalResult === "failed"
          ? `Your proposal defense was not passed. Chapter ${chosenChapter} stays locked until a re-defense is passed.`
          : `Chapter ${chosenChapter} unlocks after you pass the proposal defense.`;
    else if (alreadyApproved) uploadHint = `Chapter ${chosenChapter} is already approved.`;
    else if (chosen.status === "needs_revision")
      uploadHint = `Resubmitting sends Chapter ${chosenChapter} back to your adviser for review.`;
    else if (chosen.status === "under_review")
      uploadHint = `This replaces the version under review.`;
    else uploadHint = `Uploading sends Chapter ${chosenChapter} to your adviser for review.`;
  }

  // Deep-link from a notification: open the PDF at the right page
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
  }, [highlightDeliverableId, highlightPage, deliverables, router]);

  const changeTaskStatus = async (taskId: Id<"tasks">, status: "in_progress" | "under_review") => {
    try {
      await studentUpdateTask({ taskId, status });
      if (status === "under_review") toast.success("Sent to your instructor for review.");
    } catch (err) {
      console.error(err);
      toast.error("Couldn't update the task. Try again.");
    }
  };

  // Open (or create) the draft and open the editor on it.
  const startEdit = async (d: Deliverable) => {
    try {
      const draft = await startDraft({ deliverableId: d._id });
      setOfficeDoc({
        fileName: d.fileName,
        storageId: draft.storageId,
        deliverableId: d._id,
        phase: d.phase,
        mode: "edit",
        draft: {
          id: draft.draftId,
          baseVersion: draft.baseVersion,
          docKey: `${draft.draftId}-${draft.storageId}`,
          phase: d.phase,
          fileSize: d.fileSize,
        },
      });
      sessionStorage.setItem(
        EDITOR_SESSION_KEY,
        JSON.stringify({ deliverableId: d._id }),
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't open the editor.");
    }
  };

  const selectChapter = async (targetPhase: string, hasChanges: boolean) => {
    const target = deliverables
      ?.filter((item) => item.phase === targetPhase)
      .reduce<Deliverable | null>(
        (latest, item) => (!latest || item.version > latest.version ? item : latest),
        null,
      );

    if (!target?.storageId) throw new Error("This chapter has no available file.");
    if (!isOffice(target.fileName) && !isPdf(target.fileName)) {
      throw new Error("This file type cannot be opened in OnlyOffice.");
    }

    const current = officeDoc;
    if (current?.draft && hasChanges) {
      await forceSaveDraft(
        current.draft.docKey,
        () =>
          convex.query(api.drafts.getByDeliverable, {
            deliverableId: current.deliverableId as Id<"deliverables">,
          }),
        current.storageId,
      );
    }

    if (isPdf(target.fileName)) {
      const targetUrl = await convex.query(api.dashboard.getFileUrl, {
        storageId: target.storageId as Id<"_storage">,
      });
      if (!targetUrl) throw new Error("The selected chapter file is unavailable.");
      sessionStorage.removeItem(EDITOR_SESSION_KEY);
      setOfficeDoc({
        fileName: target.fileName,
        storageId: target.storageId,
        deliverableId: target._id,
        phase: target.phase,
        mode: "view",
        fileUrl: targetUrl,
      });
      return;
    }

    const draft = await startDraft({ deliverableId: target._id });
    const targetUrl = await convex.query(api.dashboard.getFileUrl, {
      storageId: draft.storageId,
    });
    if (!targetUrl) throw new Error("The selected chapter draft is unavailable.");
    setOfficeDoc({
      fileName: target.fileName,
      storageId: draft.storageId,
      deliverableId: target._id,
      phase: target.phase,
      mode: "edit",
      fileUrl: targetUrl,
      draft: {
        id: draft.draftId,
        baseVersion: draft.baseVersion,
        docKey: `${draft.draftId}-${draft.storageId}`,
        phase: target.phase,
        fileSize: target.fileSize,
      },
    });
    sessionStorage.setItem(
      EDITOR_SESSION_KEY,
      JSON.stringify({ deliverableId: target._id }),
    );
  };

  const viewDocument = (d: Deliverable) => {
    if (isPdf(d.fileName)) {
      setSelectedDeliverable({
        fileName: d.fileName,
        storageId: d.storageId!,
        deliverableId: d._id,
        initialPage: 1,
      });
    } else if (isOffice(d.fileName)) {
      setOfficeDoc({
        fileName: d.fileName,
        storageId: d.storageId!,
        deliverableId: d._id,
        phase: d.phase,
        mode: "view",
      });
    }
  };

  // Close saves edits to the draft; only Submit persists a new version.
  const closeEditor = async (hasChanges: boolean) => {
    const doc = officeDoc;
    if (doc?.draft && hasChanges) {
      const deliverableId = doc.deliverableId as Id<"deliverables">;
      await forceSaveDraft(
        doc.draft.docKey,
        () => convex.query(api.drafts.getByDeliverable, { deliverableId }),
        doc.storageId,
      );
    }
    setOfficeDoc(null);
    sessionStorage.removeItem(EDITOR_SESSION_KEY);
  };

  // Submit button in the editor header: save latest edits, then create the next version.
  const submitDraft = async (hasChanges: boolean) => {
    const doc = officeDoc;
    if (!doc?.draft || !capstoneProjectId) throw new Error("Missing project.");
    const deliverableId = doc.deliverableId as Id<"deliverables">;
    const getDraft = () =>
      convex.query(api.drafts.getByDeliverable, { deliverableId });
    const latest = hasChanges
      ? await forceSaveDraft(doc.draft.docKey, getDraft, doc.storageId)
      : await getDraft();
    if (!latest) throw new Error("Draft not found.");
    const version = await saveDeliverable({
      storageId: latest.storageId,
      fileName: doc.fileName,
      phase: doc.draft.phase,
      fileSize: doc.draft.fileSize,
      capstoneProjectId,
      draftId: latest._id,
    });
    const savedVersion = (await convex.query(api.dashboard.getDeliverables, {
      capstoneProjectId,
    })).find(
      (deliverable) =>
        deliverable.phase === doc.draft?.phase && deliverable.version === version,
    );
    if (!savedVersion?.storageId) {
      throw new Error(
        `Submitted version ${version}, but couldn't reopen the editor from that version.`,
      );
    }

    const nextDraft = await startDraft({ deliverableId: savedVersion._id });
    const nextDraftUrl = await convex.query(api.dashboard.getFileUrl, {
      storageId: nextDraft.storageId,
    });
    if (!nextDraftUrl) {
      throw new Error(
        `Submitted version ${version}, but couldn't load a new draft from it.`,
      );
    }

    setOfficeDoc({
      fileName: savedVersion.fileName,
      storageId: nextDraft.storageId,
      deliverableId: savedVersion._id,
      phase: savedVersion.phase,
      mode: "edit",
      fileUrl: nextDraftUrl,
      draft: {
        id: nextDraft.draftId,
        baseVersion: nextDraft.baseVersion,
        docKey: `${nextDraft.draftId}-${nextDraft.storageId}`,
        phase: savedVersion.phase,
        fileSize: savedVersion.fileSize,
      },
    });
    sessionStorage.setItem(
      EDITOR_SESSION_KEY,
      JSON.stringify({ deliverableId: savedVersion._id }),
    );
    toast.success(`Submitted as version ${version}. You can continue editing.`);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) setFile(e.target.files[0]);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragging(false);
    if (e.dataTransfer.files?.[0]) setFile(e.dataTransfer.files[0]);
  };

  const closeUpload = () => {
    setShowUpload(false);
    setFile(null);
    setPhase("");
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
    if (proposalLocked) {
      toast.error("Pass the proposal defense before uploading Chapter 4 or 5.");
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
      closeUpload();
    } catch (err) {
      console.error(err);
      toast.error(`Upload failed: ${err instanceof Error ? err.message : String(err)}`);
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

  const getStatusIcon = (status: string) => {
    if (status === "approved") return CheckCircle2;
    if (status === "under_review") return Clock;
    return RotateCcw;
  };

  const getTaskBadge = (status: string) => {
    if (status === "completed") return "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300";
    if (status === "in_progress") return "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300";
    if (status === "under_review") return "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300";
    if (status === "needs_revision") return "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300";
    return "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300";
  };

  const getTaskDot = (status: string) => {
    if (status === "completed") return "bg-green-600";
    if (status === "in_progress") return "bg-blue-600";
    if (status === "under_review") return "bg-amber-500";
    if (status === "needs_revision") return "bg-orange-500";
    return "bg-slate-400";
  };

  const getTaskLabel = (status: string) => {
    if (status === "completed") return "Completed";
    if (status === "in_progress") return "In Progress";
    if (status === "under_review") return "Waiting to be checked by instructor";
    if (status === "needs_revision") return "Needs Revision";
    return "Pending";
  };

  // Priority is optional: the column only shows if your tasks have a `priority` field.
  const getPriority = (task: unknown) =>
    (task as { priority?: string }).priority?.toLowerCase();
  const hasPriority = !!tasks?.some((t) => getPriority(t));
  const priorityBadge = (p?: string) => {
    if (p === "high") return "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300";
    if (p === "medium") return "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300";
    return "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300";
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const formatDateTime = (dateStr: string) => {
    const d = new Date(dateStr);
    const time = d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
    return `${formatDate(dateStr)} at ${time}`;
  };

  const filteredTasks = (tasks ?? []).filter((t) => {
    if (taskFilter === "all") return true;
    return t.status === taskFilter;
  });

  const taskCounts = {
    all: tasks?.length ?? 0,
    pending: tasks?.filter((t) => t.status === "pending").length ?? 0,
    in_progress: tasks?.filter((t) => t.status === "in_progress").length ?? 0,
    under_review: tasks?.filter((t) => t.status === "under_review").length ?? 0,
    needs_revision: tasks?.filter((t) => t.status === "needs_revision").length ?? 0,
    completed: tasks?.filter((t) => t.status === "completed").length ?? 0,
  };

  const taskFilterOptions = [
    { key: "all", label: "All", count: taskCounts.all },
    { key: "pending", label: "To Do", count: taskCounts.pending },
    { key: "in_progress", label: "In Progress", count: taskCounts.in_progress },
    { key: "under_review", label: "Under Review", count: taskCounts.under_review },
    { key: "needs_revision", label: "Needs Revision", count: taskCounts.needs_revision },
    { key: "completed", label: "Completed", count: taskCounts.completed },
  ];

  return (
    <div className="w-full space-y-6">
      {/* Banner */}
      {showBanner && (
        <div className="relative isolate overflow-hidden rounded-2xl bg-linear-to-r from-blue-100 via-blue-50 to-sky-100 dark:from-blue-950/60 dark:via-blue-950/30 dark:to-slate-900 p-6 lg:p-8">
          <div className="relative z-10">
            <h1 className="text-2xl lg:text-3xl font-bold text-foreground">
              Manuscript &amp; Task Management
            </h1>
            <p className="text-sm lg:text-base text-muted-foreground mt-2">
              Manage your manuscript and keep track of your assigned tasks.
            </p>
          </div>
          <UploadCloud
            aria-hidden
            strokeWidth={1.4}
            className="pointer-events-none absolute right-8 top-1/2 hidden h-28 w-28 -translate-y-1/2 text-blue-300/70 dark:text-blue-800/60 sm:block"
          />
        </div>
      )}

      {/* Upload section */}
      {showUpload && (
        <div className={`${CARD} p-5 lg:p-6 space-y-5`}>
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-xl font-semibold text-foreground">Upload New Document</h2>
              <p className="text-sm text-muted-foreground">
                Upload a new version or chapter manuscript for adviser review.
              </p>
            </div>
            <button
              type="button"
              onClick={closeUpload}
              aria-label="Close upload"
              className="p-1.5 rounded-md hover:bg-muted transition-colors"
            >
              <X className="h-5 w-5 text-muted-foreground" />
            </button>
          </div>

          <div className="space-y-2">
            <label className="text-foreground text-sm font-medium">Select Chapter</label>
            <SelectDemo value={phase} onValueChange={setPhase} />
            {uploadHint && (
              <div
                className={`flex items-start gap-2 rounded-xl p-3 text-xs leading-relaxed ${
                  proposalLocked
                    ? "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300"
                    : alreadyApproved
                      ? "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300"
                      : "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300"
                }`}
              >
                {alreadyApproved && !proposalLocked ? (
                  <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" />
                ) : (
                  <Info className="h-4 w-4 shrink-0 mt-0.5" />
                )}
                <span>{uploadHint}</span>
              </div>
            )}
          </div>

          <div className="space-y-2">
            <label className="text-foreground text-sm font-medium">Select File</label>
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
                    <div className={`flex h-16 w-16 items-center justify-center rounded-full ${fileStyle(file.name).wrap}`}>
                      <FileText className="h-8 w-8" />
                    </div>
                    <p className="mt-3 text-sm font-semibold text-foreground break-all">{file.name}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {(file.size / (1024 * 1024)).toFixed(2)} MB • Click to select a different file
                    </p>
                  </>
                ) : (
                  <>
                    <div className="flex h-16 w-16 items-center justify-center rounded-full bg-blue-100 text-blue-600 dark:bg-blue-900/50 dark:text-blue-300">
                      <UploadCloud className="h-8 w-8" />
                    </div>
                    <p className="mt-3 text-sm font-semibold text-foreground">
                      Click to select a file, or drag and drop here
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Accepts PDF, DOC, DOCX, XLSX, PPTX, or ZIP (max 50MB)
                    </p>
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

          <div className="flex items-center justify-between pt-1">
            {file ? (
              <button
                type="button"
                onClick={() => setFile(null)}
                className="text-xs text-muted-foreground hover:text-destructive transition-colors"
              >
                Clear selected file
              </button>
            ) : <div />}

            <div className="flex items-center gap-2">
              <Button variant="outline" className="rounded-lg" onClick={closeUpload} disabled={uploading}>
                Cancel
              </Button>
              <Button
                onClick={handleUpload}
                disabled={!file || !phase || uploading || alreadyApproved || proposalLocked}
                className="rounded-lg gap-2 bg-blue-600 text-white hover:bg-blue-700"
              >
                {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <UploadCloud className="h-4 w-4" />}
                {uploading ? "Uploading..." : "Upload Deliverable"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* MY MANUSCRIPT */}
      <div className={`${CARD} p-5 lg:p-6`}>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <FileText className="h-7 w-7 text-blue-600" />
            <h2 className="text-xl font-semibold text-foreground">My Manuscript</h2>
          </div>
          <Button
            className="rounded-lg gap-2 bg-blue-600 text-white hover:bg-blue-700 self-start sm:self-auto"
            onClick={() => setShowUpload(true)}
            disabled={showUpload}
          >
            <Plus className="h-4 w-4" />
            Upload New Document
          </Button>
        </div>

        <div className="mt-5">
          {deliverables === undefined ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
            </div>
          ) : deliverables.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center rounded-xl border border-dashed">
              <FileText className="h-12 w-12 text-muted-foreground/40 mb-3" />
              <p className="font-medium text-foreground">No documents submitted yet</p>
              <p className="text-sm text-muted-foreground mt-1">
                Upload your first chapter to start the review.
              </p>
              <Button
                size="sm"
                className="mt-4 rounded-lg bg-blue-600 text-white hover:bg-blue-700"
                onClick={() => setShowUpload(true)}
                disabled={showUpload}
              >
                Upload Now
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border">
              <table className="w-full min-w-205 text-sm">
                <thead className="bg-muted/50">
                  <tr>
                    <th className={TH}>Document Name</th>
                    <th className={TH}>Version</th>
                    <th className={TH}>Last Updated</th>
                    <th className={TH}>Status</th>
                    <th className={`${TH} text-right`}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {deliverables.map((d) => {
                    const fs = fileStyle(d.fileName);
                    const FileTypeIcon = fs.icon;
                    const chNum = chapterOf(d.phase);
                    const cp = chNum ? progress.chapters[chNum - 1] : null;
                    const isLatest = !!cp && cp.latestId === d._id;
                    // Locked once the chapter (or this file) is approved. Only admins can delete.
                    const deleteLocked =
                      (cp?.status === "approved" || d.status === "approved") && !isAdmin;
                    const canView = isPdf(d.fileName) || isOffice(d.fileName);
                    const canEdit = isOffice(d.fileName) && isLatest && !isArchived;
                    const StatusIcon = getStatusIcon(d.status);
                    return (
                      <tr key={d._id} className={`border-t ${chNum && !isLatest ? "opacity-60" : ""}`}>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3 min-w-0">
                            <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${fs.wrap}`}>
                              <FileTypeIcon className="h-5 w-5" />
                            </div>
                            <div className="min-w-0">
                              <p className="font-medium text-foreground truncate max-w-64">{d.fileName}</p>
                              <p className="text-xs text-muted-foreground">{d.phase}</p>
                              {!chNum && (
                                <p className="text-xs text-amber-600 dark:text-amber-400">
                                  Saved under an older phase, so it is not counted in progress.
                                </p>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span className="inline-flex rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-medium text-blue-700 dark:bg-blue-950 dark:text-blue-300">
                            v{d.version}
                            {d.versionLabel && ` (${d.versionLabel})`}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-foreground whitespace-nowrap">
                          <span className="inline-flex items-center gap-2">
                            <CalendarDays className="h-4 w-4 text-muted-foreground" />
                            {formatDateTime(d.uploadedAt)}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`${BADGE_BASE} ${getStatusBadge(d.status)}`}>
                            <StatusIcon className="h-3.5 w-3.5" />
                            {getStatusLabel(d.status)}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              size="sm"
                              className="rounded-lg bg-blue-600 text-white hover:bg-blue-700"
                              disabled={!canView}
                              onClick={() => viewDocument(d)}
                            >
                              View Document
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="rounded-lg gap-1.5"
                              disabled={!canEdit}
                              title={
                                canEdit
                                  ? "Edit this document"
                                  : "Only the latest Word, Excel or PowerPoint version can be edited"
                              }
                              onClick={() => startEdit(d)}
                            >
                              <Pencil className="h-3.5 w-3.5" /> Edit
                            </Button>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <button
                                  className="p-1.5 rounded-md hover:bg-muted transition-colors"
                                  aria-label="File options"
                                >
                                  <MoreVertical className="h-4 w-4 text-muted-foreground" />
                                </button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="flex flex-col justify-center">
                                {isPdf(d.fileName) && (
                                  <DropdownMenuItem
                                    onClick={() =>
                                      setOfficeDoc({
                                        fileName: d.fileName,
                                        storageId: d.storageId!,
                                        deliverableId: d._id,
                                        phase: d.phase,
                                        mode: "view",
                                      })
                                    }
                                  >
                                    Open in OnlyOffice
                                  </DropdownMenuItem>
                                )}

                                {/* Download is available for every non-PDF file type */}
                                {!isPdf(d.fileName) && <DownloadItem storageId={d.storageId} />}

                                {deleteLocked ? (
                                  <DropdownMenuItem disabled className="text-muted-foreground">
                                    Delete (locked)
                                  </DropdownMenuItem>
                                ) : (
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
                                )}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* MY TASKS */}
      <div id="my-tasks" className={`${CARD} p-5 lg:p-6 scroll-mt-4`}>
        <div className="flex items-center gap-3">
          <CheckSquare className="h-7 w-7 text-blue-600" />
          <h2 className="text-xl font-semibold text-foreground">My Tasks</h2>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          {taskFilterOptions.map((opt) => (
            <button
              key={opt.key}
              onClick={() => setTaskFilter(opt.key)}
              className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                taskFilter === opt.key
                  ? "bg-blue-100 text-blue-700 shadow-[inset_0_-2px_0_0_var(--color-blue-600)] dark:bg-blue-950 dark:text-blue-300"
                  : "bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground"
              }`}
            >
              {opt.label} ({opt.count})
            </button>
          ))}
        </div>

        <div className="mt-4">
          {tasks === undefined ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
            </div>
          ) : filteredTasks.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center rounded-xl border border-dashed">
              <CheckSquare className="h-12 w-12 text-muted-foreground/40 mb-3" />
              <p className="font-medium text-foreground">
                {taskFilter === "all" ? "No tasks assigned yet" : "No tasks in this category"}
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                {taskFilter === "all"
                  ? "Tasks will be assigned by your instructor as the project progresses."
                  : "Try choosing another filter option above."}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border">
              <table className="w-full min-w-205 text-sm">
                <thead className="bg-muted/50">
                  <tr>
                    <th className={TH}>Task Title</th>
                    <th className={TH}>Description</th>
                    <th className={TH}>Due Date</th>
                    {hasPriority && <th className={TH}>Priority</th>}
                    <th className={TH}>Status</th>
                    <th className={`${TH} text-right`}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredTasks.map((task) => {
                    const priority = getPriority(task);
                    return (
                      <tr key={task._id} className="border-t align-middle">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            {task.status === "completed" ? (
                              <CheckCircle2 className="h-5 w-5 shrink-0 text-green-600" />
                            ) : (
                              <span className="h-3 w-3 shrink-0 rounded-full bg-blue-600" />
                            )}
                            <span className="font-medium text-foreground">{task.title}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">
                          <p>{task.description}</p>
                          <p className="mt-0.5 text-xs">
                            {task.assignedTo} · {task.targetRole ?? "All Roles"}
                          </p>
                        </td>
                        <td className="px-4 py-3 text-foreground whitespace-nowrap">
                          <span className="inline-flex items-center gap-2">
                            <CalendarDays className="h-4 w-4 text-muted-foreground" />
                            {formatDate(task.dueDate)}
                          </span>
                        </td>
                        {hasPriority && (
                          <td className="px-4 py-3">
                            {priority ? (
                              <span className={`${BADGE_BASE} capitalize ${priorityBadge(priority)}`}>
                                {priority}
                              </span>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </td>
                        )}
                        <td className="px-4 py-3">
                          <span className={`${BADGE_BASE} ${getTaskBadge(task.status)}`}>
                            <span className={`h-2 w-2 rounded-full ${getTaskDot(task.status)}`} />
                            {getTaskLabel(task.status)}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex justify-end">
                            <TaskActions
                              status={task.status}
                              onChange={(s) => changeTaskStatus(task._id, s)}
                            />
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

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
      {officeDoc && resolvedOfficeUrl && (
        <OnlyOfficeEditor
          fileId={`${officeDoc.deliverableId}-${officeDoc.storageId}${officeDoc.mode === "view" ? "-view2" : ""}`}
          deliverableId={officeDoc.deliverableId}
          fileName={officeDoc.fileName}
          fileUrl={resolvedOfficeUrl}
          phase={officeDoc.phase}
          deliverables={deliverables ?? []}
          workspaceSidebar
          workspaceReadOnly={isArchived}
          onSelectChapter={selectChapter}
          mode={officeDoc.mode}
          userId={user?.id}
          userName={user?.fullName ?? undefined}
          docKey={officeDoc.draft?.docKey}
          draftId={officeDoc.draft?.id}
          baseVersion={officeDoc.draft?.baseVersion}
          onSubmit={officeDoc.draft ? submitDraft : undefined}
          onEditorReady={() => setIsRestoringEditor(false)}
          onEditorError={() => setIsRestoringEditor(false)}
          onClose={closeEditor}
        />
      )}
      {isRestoringEditor && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-slate-950/80 text-white">
          <div className="text-center">
            <Loader2 className="mx-auto h-8 w-8 animate-spin" />
            <p className="mt-3 text-sm">Restoring your document workspace…</p>
          </div>
        </div>
      )}
    </div>
  );
}