"use client";

import { useQuery, useMutation, useConvex } from "convex/react";
import { useUser } from "@clerk/nextjs";
import { api } from "@/convex/_generated/api";
import { DefenseBadge, DefenseStatusCard } from "@/app/components/defense-status-card";
import { Id } from "@/convex/_generated/dataModel";
import { forceSaveDraft } from "@/lib/onlyoffice-draft";
import { useState, useMemo, useEffect, useRef, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import dynamic from "next/dynamic";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SelectDemo } from "@/app/components/select";
import { DeleteDeliverable } from "@/app/components/deleteDeliverable";
import { toast } from "sonner";
import { chapterOf, computeProgress, CHAPTER_MAX, TOTAL_CHAPTERS } from "@/lib/progress";
import {
  CheckCircle2,
  Clock,
  RotateCcw,
  Users,
  UserCheck,
  Mail,
  KeyRound,
  Loader2,
  FileText,
  FileSpreadsheet,
  Presentation,
  FileArchive,
  File as FileIcon,
  UploadCloud,
  CheckSquare,
  MoreVertical,
  CalendarDays,
  Play,
  Check,
  Undo2,
  Info,
} from "lucide-react";

const TEAM_ROLES = [
  "Project Manager",
  "Programmer",
  "Designer",
  "System Analyst",
  "System Architect",
] as const;
type TeamRole = (typeof TEAM_ROLES)[number];
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
const OFFICE_EXTENSIONS = ["doc", "docx", "odt", "xls", "xlsx", "ods", "ppt", "pptx", "odp"];
const isOffice = (fileName: string) =>
  OFFICE_EXTENSIONS.includes(fileName.split(".").pop()?.toLowerCase() ?? "");

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
const rowClass =
  "rounded-2xl border bg-card p-4 lg:p-5 mb-3 transition-all hover:shadow-md hover:border-blue-200 dark:hover:border-blue-900";
const EDITOR_SESSION_KEY = "student-editor-session";

const initials = (name?: string) =>
  (name ?? "")
    .split(" ")
    .filter(Boolean)
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

const progressBarColor = (status: string | null) => {
  if (status === "approved") return "bg-green-600";
  if (status === "needs_revision") return "bg-amber-500";
  return "bg-blue-600";
};

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

function TaskActions({
  status,
  onChange,
}: {
  status: string;
  onChange: (s: "in_progress" | "under_review") => void;
}) {
  if (status === "completed")
    return (
      <Button size="sm" disabled className="rounded-full px-4 gap-1.5 bg-muted text-muted-foreground">
        <Check className="h-3.5 w-3.5" /> Completed
      </Button>
    );

  if (status === "under_review")
    return (
      <div className="flex items-center gap-3">
        <span className="text-xs text-muted-foreground">Waiting for your instructor</span>
        <Button
          size="sm"
          variant="outline"
          className="rounded-full px-4 gap-1.5"
          onClick={() => onChange("in_progress")}
        >
          <Undo2 className="h-3.5 w-3.5" /> Undo
        </Button>
      </div>
    );

  if (status === "needs_revision")
    return (
      <div className="flex items-center gap-3">
        <span className="text-xs text-orange-600 dark:text-orange-400">
          Your instructor sent this back
        </span>
        <Button
          size="sm"
          className="rounded-full px-4 gap-1.5 bg-orange-500 text-white hover:bg-orange-600"
          onClick={() => onChange("under_review")}
        >
          <RotateCcw className="h-3.5 w-3.5" /> Resubmit
        </Button>
      </div>
    );

  if (status === "in_progress")
    return (
      <Button
        size="sm"
        className="rounded-full px-4 gap-1.5 bg-green-600 text-white hover:bg-green-700"
        onClick={() => onChange("under_review")}
      >
        <Check className="h-3.5 w-3.5" /> Mark as done
      </Button>
    );

  return (
    <Button
      size="sm"
      className="rounded-full px-4 gap-1.5 bg-blue-600 text-white hover:bg-blue-700"
      onClick={() => onChange("in_progress")}
    >
      <Play className="h-3.5 w-3.5" /> Start task
    </Button>
  );
}

function DashboardContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const currentTab = searchParams.get("tab") || "deliverables";
  const deliverableIdFromUrl = searchParams.get("deliverableId") as Id<"deliverables"> | null;
  const pageFromUrl = searchParams.get("page") || "1";
  const highlightPageFromUrl = pageFromUrl ? parseInt(pageFromUrl) : null;

  const { user } = useUser();
  const convex = useConvex();
  const isAdmin = (user?.publicMetadata as { role?: string } | undefined)?.role === "admin";

  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  // join team by code
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const meQuery = useQuery(api.users.getMe);
  const me = mounted ? meQuery : undefined;
  const joinTeam = useMutation(api.dashboard.joinTeam);
  const syncReadiness = useMutation(api.defense.syncDefenseReadiness);
  const setMyTeamRole = useMutation(api.dashboard.setMyTeamRole);
  const [selectedTeamRole, setSelectedTeamRole] = useState<TeamRole | "">("");
  const [savingTeamRole, setSavingTeamRole] = useState(false);

  const projectQuery = useQuery(
    api.dashboard.getMyProject,
    me ? { clerkId: me.clerkId } : "skip"
  );
  const project = mounted ? projectQuery : undefined;
  const currentTeamRole =
    project?.teamRoles?.find((assignment) => assignment.memberId === me?._id)?.role ?? "";

  useEffect(() => {
    setSelectedTeamRole(currentTeamRole);
  }, [currentTeamRole, project]);

  const teamMembers = useQuery(
    api.dashboard.getProjectMembers,
    project ? { capstoneProjectId: project._id as Id<"capstoneProjects"> } : "skip"
  );
  const projectAdviser = useQuery(
    api.dashboard.getProjectAdviser,
    project ? { capstoneProjectId: project._id as Id<"capstoneProjects"> } : "skip"
  );
  const deliverables = useQuery(
    api.dashboard.getDeliverables,
    project ? { capstoneProjectId: project._id as Id<"capstoneProjects"> } : "skip"
  );
  const tasks = useQuery(
    api.dashboard.getTasks,
    project ? { capstoneProjectId: project._id as Id<"capstoneProjects"> } : "skip"
  );

  const generateUploadUrl = useMutation(api.dashboard.generateUploadUrl);
  const saveDeliverable = useMutation(api.dashboard.saveDeliverable);
  const studentUpdateTask = useMutation(api.dashboard.studentUpdateTask);
  const startDraft = useMutation(api.drafts.startDraft);

  // Upload Form State
  const [file, setFile] = useState<File | null>(null);
  const [phase, setPhase] = useState("");
  const [uploading, setUploading] = useState(false);
  const [dragging, setDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Tasks Filter State
  const [taskFilter, setTaskFilter] = useState("all");

  // PDF Viewer State
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

  // OnlyOffice State
  const [officeDoc, setOfficeDoc] = useState<{
    fileName: string;
    storageId: string;
    deliverableId: string;
    phase: string;
    mode: "edit" | "view";
    draft?: { id: string; baseVersion: number; docKey: string; phase: string; fileSize: string };
  } | null>(null);

  const [isRestoringEditor, setIsRestoringEditor] = useState(false);

  const officeUrl = useQuery(
    api.dashboard.getFileUrl,
    officeDoc ? { storageId: officeDoc.storageId as Id<"_storage"> } : "skip"
  );

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
    officeDoc && loadedOfficeUrl?.storageId === officeDoc.storageId ? loadedOfficeUrl.url : null;

  useEffect(() => {
    if (officeDoc && officeUrl === null && !resolvedOfficeUrl) {
      toast.error("The draft file is missing. Please try again.");
      setOfficeDoc(null);
    }
  }, [officeDoc, officeUrl, resolvedOfficeUrl]);

  // Restore editor session if refreshed during an edit
  useEffect(() => {
    if (!deliverables || officeDoc || isRestoringEditor) return;
    const saved = sessionStorage.getItem(EDITOR_SESSION_KEY);
    if (!saved) return;

    let target: { deliverableId: string } | null = null;
    try {
      target = JSON.parse(saved) as { deliverableId: string };
    } catch {
      sessionStorage.removeItem(EDITOR_SESSION_KEY);
      return;
    }

    const deliverable = deliverables.find((item) => item._id === target?.deliverableId);
    if (!deliverable) {
      sessionStorage.removeItem(EDITOR_SESSION_KEY);
      return;
    }

    sessionStorage.removeItem(EDITOR_SESSION_KEY);
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
            docKey: draft.draftId,
            phase: deliverable.phase,
            fileSize: deliverable.fileSize,
          },
        });
      })
      .catch((error) => {
        toast.error(error instanceof Error ? error.message : "Couldn't restore the editor.");
      })
      .finally(() => setIsRestoringEditor(false));
  }, [deliverables, officeDoc, isRestoringEditor, startDraft]);

  // Deep-link to open PDF from notification
  useEffect(() => {
    if (!deliverableIdFromUrl || !deliverables) return;
    const match = deliverables.find((d) => d._id === deliverableIdFromUrl);
    if (match && match.storageId && isPdf(match.fileName)) {
      setSelectedDeliverable({
        fileName: match.fileName,
        storageId: match.storageId,
        deliverableId: match._id,
        initialPage: highlightPageFromUrl || 1,
      });
      setTimeout(() => {
        router.replace(window.location.pathname, { scroll: false });
      }, 500);
    }
  }, [deliverableIdFromUrl, deliverables, highlightPageFromUrl, router]);

  const progress = useMemo(() => computeProgress(deliverables ?? []), [deliverables]);

  // At 100% the project becomes "Ready for defense" on its own
  useEffect(() => {
    if (project && !project.stage && progress.total >= 100) {
      syncReadiness({ projectId: project._id as Id<"capstoneProjects"> }).catch(() => {});
    }
  }, [project?._id, project?.stage, progress.total, syncReadiness]);

  const handleJoin = async () => {
    const trimmed = code.trim().toUpperCase();
    if (!trimmed) {
      setError("Please enter an invite code.");
      return;
    }
    if (!me?.clerkId) {
      setError("Could not identify your account. Please try again.");
      return;
    }
    setIsLoading(true);
    setError("");
    try {
      await joinTeam({ inviteCode: trimmed });
    } catch {
      setError("Invalid invite code. Please check and try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const startEdit = async (d: NonNullable<typeof deliverables>[number]) => {
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
          docKey: draft.draftId,
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

  const closeEditor = async () => {
    const doc = officeDoc;
    if (doc?.draft) {
      try {
        const deliverableId = doc.deliverableId as Id<"deliverables">;
        await forceSaveDraft(doc.draft.docKey, () =>
          convex.query(api.drafts.getByDeliverable, { deliverableId }),
        );
      } catch (err) {
        console.error(err);
        toast.error(err instanceof Error ? err.message : "Couldn't save your latest edits before closing.");
        throw err;
      }
    }
    setOfficeDoc(null);
    sessionStorage.removeItem(EDITOR_SESSION_KEY);
  };

  const submitDraft = async () => {
    const doc = officeDoc;
    if (!doc?.draft || !project?._id) throw new Error("Missing project.");
    const deliverableId = doc.deliverableId as Id<"deliverables">;
    const latest = await forceSaveDraft(doc.draft.docKey, () =>
      convex.query(api.drafts.getByDeliverable, { deliverableId }),
    );
    const version = await saveDeliverable({
      storageId: latest.storageId,
      fileName: doc.fileName,
      phase: doc.draft.phase,
      fileSize: doc.draft.fileSize,
      capstoneProjectId: project._id as Id<"capstoneProjects">,
      draftId: latest._id,
    });
    toast.success(`Submitted as version ${version}.`);
    setOfficeDoc(null);
    sessionStorage.removeItem(EDITOR_SESSION_KEY);
  };

  // Upload handler
  const chosenChapter = chapterOf(phase);
  const chosen = chosenChapter ? progress.chapters[chosenChapter - 1] : null;
  const alreadyApproved = chosen?.status === "approved";

  let uploadHint = "";
  if (chosenChapter && chosen) {
    if (alreadyApproved) uploadHint = `Chapter ${chosenChapter} is already approved.`;
    else if (chosen.status === "needs_revision")
      uploadHint = `Resubmitting sends Chapter ${chosenChapter} back to your adviser for review.`;
    else if (chosen.status === "under_review")
      uploadHint = `This replaces the version currently under review.`;
    else uploadHint = `Uploading sends Chapter ${chosenChapter} to your adviser for review.`;
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) setFile(e.target.files[0]);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragging(false);
    if (e.dataTransfer.files?.[0]) setFile(e.dataTransfer.files[0]);
  };

  const handleUpload = async () => {
    if (!file || !phase || !project?._id) {
      toast.error("Please select a chapter and choose a file first.");
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
        capstoneProjectId: project._id as Id<"capstoneProjects">,
      });

      toast.success("Uploaded successfully!");
      setFile(null);
      setPhase("");
      router.push("/dashboard/student?tab=deliverables", { scroll: false });
    } catch (err) {
      console.error(err);
      toast.error(`Upload failed: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setUploading(false);
    }
  };

  // Task status update
  const changeTaskStatus = async (taskId: Id<"tasks">, status: "in_progress" | "under_review") => {
    try {
      await studentUpdateTask({ taskId, status });
      if (status === "under_review") toast.success("Sent to your instructor for review.");
      else toast.success("Task updated.");
    } catch (err) {
      console.error(err);
      toast.error("Couldn't update the task. Try again.");
    }
  };

  const saveTeamRole = async () => {
    if (!project || !selectedTeamRole || selectedTeamRole === currentTeamRole) return;
    setSavingTeamRole(true);
    try {
      await setMyTeamRole({
        capstoneProjectId: project._id,
        role: selectedTeamRole,
      });
      toast.success("Your team role has been updated.");
    } catch (error) {
      console.error("Failed to update team role:", error);
      toast.error(error instanceof Error ? error.message : "Couldn't update your team role.");
    } finally {
      setSavingTeamRole(false);
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

  const firstName = me?.name?.split(" ")[0];

  const stats = [
    {
      label: "Approved",
      value: progress.approved,
      icon: CheckCircle2,
      card: "bg-green-50 dark:bg-green-950/30",
      iconWrap: "bg-green-100 text-green-600 dark:bg-green-900/50 dark:text-green-400",
    },
    {
      label: "Under review",
      value: progress.underReview,
      icon: Clock,
      card: "bg-blue-50 dark:bg-blue-950/30",
      iconWrap: "bg-blue-100 text-blue-600 dark:bg-blue-900/50 dark:text-blue-400",
    },
    {
      label: "Needs revision",
      value: progress.needsRevision,
      icon: RotateCcw,
      card: "bg-amber-50 dark:bg-amber-950/30",
      iconWrap: "bg-amber-100 text-amber-600 dark:bg-amber-900/50 dark:text-amber-400",
    },
  ];

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
    { key: "all", label: "All Tasks", count: taskCounts.all },
    { key: "pending", label: "Pending", count: taskCounts.pending },
    { key: "in_progress", label: "In Progress", count: taskCounts.in_progress },
    { key: "under_review", label: "Under Review", count: taskCounts.under_review },
    { key: "needs_revision", label: "Needs Revision", count: taskCounts.needs_revision },
    { key: "completed", label: "Completed", count: taskCounts.completed },
  ];

  return (
    <div className="scroll-smooth bg-background min-h-screen">
      <div className="lg:px-5 pb-8 space-y-6">
        {/* Welcome Banner */}
        <div className="rounded-2xl bg-linear-to-r from-blue-100 via-blue-50 to-sky-100 dark:from-blue-950/60 dark:via-blue-950/30 dark:to-slate-900 p-6 lg:p-8">
          <h1 className="text-2xl lg:text-3xl font-semibold text-foreground">
            Welcome back,{" "}
            {me === undefined ? (
              <span className="text-muted-foreground">...</span>
            ) : (
              firstName ?? "—"
            )}
            !
          </h1>
          <p className="text-sm lg:text-base text-muted-foreground mt-2">
            Track your project progress and capstone deliverables.
          </p>
        </div>

        {project === null ? (
          <div className="rounded-2xl border bg-card p-8 lg:p-10 flex flex-col items-center justify-center text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-blue-100 text-blue-600 dark:bg-blue-900/50 dark:text-blue-300 mb-4">
              <Users className="h-8 w-8" />
            </div>
            <h2 className="text-lg font-semibold text-foreground">You&apos;re not in a team yet</h2>
            <p className="text-sm text-muted-foreground max-w-sm mt-1">
              Enter the invite code your instructor gave you to join your capstone team.
            </p>

            <div className="flex flex-col items-center gap-2 w-full max-w-xs mt-5">
              <div className="relative w-full">
                <KeyRound className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  type="text"
                  placeholder="e.g. ECAP-XXXX-XXXX"
                  value={code}
                  onChange={(e) => {
                    setCode(e.target.value.toUpperCase());
                    setError("");
                  }}
                  onKeyDown={(e) => e.key === "Enter" && handleJoin()}
                  className="h-11 w-full rounded-xl pl-9 text-center font-mono tracking-widest text-sm"
                />
              </div>
              {error && <p className="text-xs text-red-500">{error}</p>}
              <Button
                onClick={handleJoin}
                disabled={isLoading || !me?.clerkId}
                className="h-11 w-full rounded-xl gap-2 bg-blue-600 text-white hover:bg-blue-700"
              >
                {isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
                {isLoading ? "Joining..." : "Join team"}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground mt-4">Don&apos;t have a code? Contact your instructor.</p>
          </div>
        ) : project === undefined ? (
          <div className="rounded-2xl border bg-card p-10 flex items-center justify-center">
            <p className="text-sm text-muted-foreground animate-pulse">Loading...</p>
          </div>
        ) : (
          <>
            {/* Project Overview */}
            <div className="rounded-2xl border bg-card p-5 lg:p-6 shadow-xs">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-lg font-semibold text-foreground leading-tight">{project.teamName}</h2>
                    <DefenseBadge project={project} progress={progress.total} />
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">{project.projectTitle}</p>
                </div>
                <span className="shrink-0 inline-flex items-center gap-1 rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-700 dark:bg-green-900/40 dark:text-green-300">
                  <CheckCircle2 className="h-3.5 w-3.5" /> Enrolled
                </span>
              </div>

              <div className="mt-5 flex flex-col gap-3 rounded-xl border bg-muted/30 p-4 sm:flex-row sm:items-end sm:justify-between">
                <div className="space-y-1">
                  <label htmlFor="student-team-role" className="text-sm font-medium">
                    Your role in this team
                  </label>
                  <p className="text-xs text-muted-foreground">
                    Instructors use team roles to assign role-specific tasks.
                  </p>
                  <Select
                    value={selectedTeamRole}
                    onValueChange={(value) => setSelectedTeamRole(value as TeamRole)}
                  >
                    <SelectTrigger id="student-team-role" className="w-full sm:w-64">
                      <SelectValue placeholder="Choose your team role" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        {TEAM_ROLES.map((role) => (
                          <SelectItem key={role} value={role}>{role}</SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </div>
                <Button
                  type="button"
                  size="sm"
                  onClick={saveTeamRole}
                  disabled={
                    savingTeamRole ||
                    !selectedTeamRole ||
                    selectedTeamRole === currentTeamRole
                  }
                >
                  {savingTeamRole ? "Saving..." : "Save Role"}
                </Button>
              </div>

              <div className="mt-5">
                <div className="flex items-end justify-between gap-3">
                  <p className="text-sm text-muted-foreground">
                    {progress.approved} of {TOTAL_CHAPTERS} chapters approved
                  </p>
                  <span className="text-3xl font-semibold text-foreground tabular-nums leading-none">
                    {progress.total}%
                  </span>
                </div>
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

              {/* Defense Status */}
              <DefenseStatusCard project={project} progress={progress.total} />

              {/* Stats */}
              <div className="grid grid-cols-3 gap-3 mt-5">
                {stats.map((s) => {
                  const Icon = s.icon;
                  return (
                    <div key={s.label} className={`${s.card} rounded-2xl p-3 lg:p-4 flex flex-col items-center text-center gap-2`}>
                      <div className={`${s.iconWrap} flex h-9 w-9 lg:h-10 lg:w-10 items-center justify-center rounded-full`}>
                        <Icon className="h-4 w-4 lg:h-5 lg:w-5" />
                      </div>
                      <p className="text-2xl font-semibold text-foreground leading-none">{s.value}</p>
                      <p className="text-xs text-muted-foreground">{s.label}</p>
                    </div>
                  );
                })}
              </div>
              <p className="mt-3 text-xs text-muted-foreground">
                Counts use the latest version of each chapter.
                {progress.superseded > 0 &&
                  ` ${progress.superseded} older ${progress.superseded === 1 ? "version is" : "versions are"} superseded.`}
              </p>
            </div>

            {/* Adviser & Team Members (Stacked) */}
            <div className="space-y-5">
              {/* Adviser */}
              <div>
                <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground mb-3">
                  <UserCheck className="h-4 w-4 text-blue-600" /> Adviser
                </h2>
                <div className="rounded-2xl border bg-card p-4 lg:p-5 shadow-xs">
                  {projectAdviser === undefined ? (
                    <p className="text-sm text-muted-foreground animate-pulse">Loading...</p>
                  ) : projectAdviser === null ? (
                    <div className="flex items-center gap-3">
                      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
                        -
                      </div>
                      <p className="text-sm text-muted-foreground">No adviser assigned</p>
                    </div>
                  ) : (
                    <div className="flex items-center gap-3">
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-violet-100 text-sm font-semibold text-violet-700 dark:bg-violet-900/50 dark:text-violet-300">
                        {initials(projectAdviser.name)}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm lg:text-base font-medium text-foreground">{projectAdviser.name}</p>
                        <p className="text-xs lg:text-sm text-muted-foreground capitalize">{projectAdviser.role}</p>
                        <p className="flex items-center gap-1 text-xs lg:text-sm text-muted-foreground truncate">
                          <Mail className="h-3.5 w-3.5 shrink-0" />
                          <span className="truncate">{projectAdviser.email}</span>
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Team Members */}
              <div>
                <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground mb-3">
                  <Users className="h-4 w-4 text-blue-600" /> Team members
                </h2>
                <div className="rounded-2xl border bg-card p-4 lg:p-5 shadow-xs">
                  {teamMembers === undefined ? (
                    <p className="text-sm text-muted-foreground animate-pulse">Loading members...</p>
                  ) : teamMembers.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No team members found</p>
                  ) : (
                    <div className="flex flex-col divide-y">
                      {teamMembers.map((member) => (
                        <div key={member._id} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-100 text-sm font-semibold text-blue-700 dark:bg-blue-900/50 dark:text-blue-300">
                            {initials(member.name)}
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="text-sm lg:text-base font-medium text-foreground truncate">{member.name}</p>
                              {me?._id === member._id && (
                                <span className="rounded-full bg-blue-600 px-2 py-0.5 text-[10px] font-medium text-white">
                                  You
                                </span>
                              )}
                            </div>
                            <p className="text-xs lg:text-sm text-muted-foreground capitalize">{member.role}</p>
                            <p className="text-xs lg:text-sm text-muted-foreground">
                              Team role: {project.teamRoles?.find((assignment) => assignment.memberId === member._id)?.role ?? "Not selected"}
                            </p>
                            <p className="text-xs lg:text-sm text-muted-foreground truncate">{member.email}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* DETAILS / SCREEN MODAL SECTION BELOW MEMBERS (Controlled by Sidebar) */}
            <div id="student-section" className="space-y-4 pt-3">
              {/* DELIVERABLES VIEW */}
              {currentTab === "deliverables" && (
                <div className="space-y-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <h2 className="text-xl font-semibold text-foreground">Deliverables</h2>
                      <p className="text-sm text-muted-foreground">
                        Your submitted chapter files and their review status.
                      </p>
                    </div>
                    <Button asChild size="sm" className="rounded-xl gap-2 bg-blue-600 text-white hover:bg-blue-700 self-start sm:self-auto">
                      <Link href="/dashboard/student?tab=uploads" scroll={false}>
                        <UploadCloud className="h-4 w-4" />
                        Upload New
                      </Link>
                    </Button>
                  </div>

                  {deliverables === undefined ? (
                    <div className="flex items-center justify-center py-12">
                      <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
                    </div>
                  ) : deliverables.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 text-center rounded-2xl border border-dashed bg-card">
                      <FileText className="h-12 w-12 text-muted-foreground/40 mb-3" />
                      <p className="font-medium text-foreground">No deliverables submitted yet</p>
                      <p className="text-sm text-muted-foreground mt-1">
                        Click &ldquo;Upload New&rdquo; in the sidebar or above to submit your first chapter.
                      </p>
                      <Button asChild size="sm" className="mt-4 rounded-xl bg-blue-600 text-white hover:bg-blue-700">
                        <Link href="/dashboard/student?tab=uploads" scroll={false}>Upload Now</Link>
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {deliverables.map((d) => {
                        const fs = fileStyle(d.fileName);
                        const FileTypeIcon = fs.icon;
                        const chNum = chapterOf(d.phase);
                        const cp = chNum ? progress.chapters[chNum - 1] : null;
                        const isLatest = !!cp && cp.latestId === d._id;
                        const deleteLocked = (cp?.status === "approved" || d.status === "approved") && !isAdmin;
                        const canOpenForEditing = isLatest && isOffice(d.fileName);

                        return (
                          <div
                            key={d._id}
                            className={`${rowClass} ${chNum && !isLatest ? "opacity-60" : ""} ${
                              canOpenForEditing ? "cursor-pointer" : ""
                            }`}
                            onClick={() => {
                              if (canOpenForEditing) void startEdit(d);
                            }}
                            onKeyDown={(event) => {
                              if (canOpenForEditing && (event.key === "Enter" || event.key === " ")) {
                                event.preventDefault();
                                void startEdit(d);
                              }
                            }}
                            role={canOpenForEditing ? "button" : undefined}
                            tabIndex={canOpenForEditing ? 0 : undefined}
                          >
                            <div className="flex items-center justify-between gap-3">
                              <div className="flex items-center gap-3 min-w-0">
                                <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full ${fs.wrap}`}>
                                  <FileTypeIcon className="h-6 w-6" />
                                </div>
                                <div className="min-w-0">
                                  <h3 className="font-semibold text-foreground text-sm lg:text-base truncate">{d.fileName}</h3>
                                  <p className="text-muted-foreground text-xs">
                                    {d.phase} • Version {d.version}
                                    {d.versionLabel && ` (${d.versionLabel})`}
                                  </p>
                                  <p className="text-muted-foreground text-xs mt-0.5">
                                    {formatDate(d.uploadedAt)} • {d.fileSize}
                                  </p>
                                </div>
                              </div>

                              <div className="flex items-center gap-1 shrink-0">
                                <span className={`${BADGE_BASE} ${getStatusBadge(d.status)}`}>
                                  {getStatusLabel(d.status)}
                                </span>
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <button
                                      className="p-1.5 rounded-md hover:bg-muted transition-colors"
                                      aria-label="File options"
                                      onClick={(event) => event.stopPropagation()}
                                    >
                                      <MoreVertical className="h-4 w-4 text-muted-foreground" />
                                    </button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end" className="flex flex-col justify-center">
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
                                          View PDF
                                        </DropdownMenuItem>
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
                                      </>
                                    ) : isOffice(d.fileName) ? (
                                      <DropdownMenuItem
                                        onClick={() =>
                                          isLatest
                                            ? startEdit(d)
                                            : setOfficeDoc({
                                                fileName: d.fileName,
                                                storageId: d.storageId!,
                                                deliverableId: d._id,
                                                phase: d.phase,
                                                mode: "view",
                                              })
                                        }
                                      >
                                        {isLatest ? "Open for editing" : "View in Editor"}
                                      </DropdownMenuItem>
                                    ) : null}

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
                            </div>

                            {/* Chapter progress */}
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
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* UPLOAD VIEW */}
              {currentTab === "uploads" && (
                <div className="space-y-4">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <h2 className="text-xl font-semibold text-foreground">Upload Deliverable</h2>
                      <p className="text-sm text-muted-foreground">
                        Upload a new version or chapter manuscript for adviser review.
                      </p>
                    </div>
                    <Button asChild variant="outline" size="sm" className="rounded-xl self-start sm:self-auto">
                      <Link href="/dashboard/student?tab=deliverables" scroll={false}>View All Deliverables</Link>
                    </Button>
                  </div>

                  <div className="rounded-2xl border bg-card p-6 lg:p-8 space-y-6 shadow-xs">
                    {/* Chapter selector */}
                    <div className="space-y-2">
                      <label className="text-foreground text-sm font-medium">Select Chapter</label>
                      <SelectDemo value={phase} onValueChange={setPhase} />
                      {uploadHint && (
                        <div
                          className={`flex items-start gap-2 rounded-xl p-3 text-xs leading-relaxed ${
                            alreadyApproved
                              ? "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300"
                              : "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300"
                          }`}
                        >
                          {alreadyApproved ? (
                            <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" />
                          ) : (
                            <Info className="h-4 w-4 shrink-0 mt-0.5" />
                          )}
                          <span>{uploadHint}</span>
                        </div>
                      )}
                    </div>

                    {/* File Dropzone */}
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

                    <div className="flex items-center justify-between pt-2">
                      {file ? (
                        <button
                          type="button"
                          onClick={() => setFile(null)}
                          className="text-xs text-muted-foreground hover:text-destructive transition-colors"
                        >
                          Clear selected file
                        </button>
                      ) : <div />}

                      <Button
                        onClick={handleUpload}
                        disabled={!file || !phase || uploading || alreadyApproved}
                        className="h-11 px-6 rounded-xl gap-2 bg-blue-600 text-white hover:bg-blue-700"
                      >
                        {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <UploadCloud className="h-4 w-4" />}
                        {uploading ? "Uploading Deliverable..." : "Upload Deliverable"}
                      </Button>
                    </div>
                  </div>
                </div>
              )}

              {/* TASKS VIEW */}
              {currentTab === "tasks" && (
                <div className="space-y-4">
                  <div>
                    <h2 className="text-xl font-semibold text-foreground">Tasks</h2>
                    <p className="text-sm text-muted-foreground">
                      Tasks and project milestones assigned to your team by your instructor.
                    </p>
                  </div>

                  {/* Filter Tabs */}
                  <div className="flex flex-wrap items-center gap-1.5 rounded-2xl bg-muted/60 p-1.5 w-fit">
                    {taskFilterOptions.map((opt) => (
                      <button
                        key={opt.key}
                        onClick={() => setTaskFilter(opt.key)}
                        className={`flex items-center gap-1.5 rounded-xl px-3.5 py-1.5 text-xs font-medium transition-all ${
                          taskFilter === opt.key
                            ? "bg-blue-600 text-white shadow-sm"
                            : "text-muted-foreground hover:text-foreground hover:bg-background/50"
                        }`}
                      >
                        <span>{opt.label}</span>
                        <span
                          className={`rounded-full px-1.5 py-0.2 text-[10px] ${
                            taskFilter === opt.key
                              ? "bg-blue-500 text-white"
                              : "bg-muted text-muted-foreground"
                          }`}
                        >
                          {opt.count}
                        </span>
                      </button>
                    ))}
                  </div>

                  {tasks === undefined ? (
                    <div className="flex items-center justify-center py-12">
                      <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
                    </div>
                  ) : filteredTasks.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 text-center rounded-2xl border border-dashed bg-card">
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
                    <div className="space-y-3">
                      {filteredTasks.map((task) => (
                        <div key={task._id} className={rowClass}>
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex items-start gap-3 min-w-0">
                              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-blue-100 text-blue-600 dark:bg-blue-900/50 dark:text-blue-300">
                                <CheckSquare className="h-6 w-6" />
                              </div>
                              <div className="min-w-0">
                                <h3 className="font-semibold text-foreground text-sm lg:text-base">{task.title}</h3>
                                <p className="text-muted-foreground text-xs mt-0.5 break-words">{task.description}</p>
                                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 text-xs text-muted-foreground">
                                  <span>Team: {task.assignedTo}</span>
                                  <span>Role: {task.targetRole ?? "All Roles"}</span>
                                  <span className="inline-flex items-center gap-1">
                                    <CalendarDays className="h-3.5 w-3.5" /> Due {formatDate(task.dueDate)}
                                  </span>
                                </div>
                              </div>
                            </div>
                            <span className={`${BADGE_BASE} ${getTaskBadge(task.status)}`}>
                              {getTaskLabel(task.status)}
                            </span>
                          </div>

                          <div className="flex justify-end mt-4 pt-3 border-t">
                            <TaskActions
                              status={task.status}
                              onChange={(s) => changeTaskStatus(task._id, s)}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* PDF Viewer Dialog */}
            <PDFViewer
              open={!!selectedDeliverable && typeof fileUrl === "string" && fileUrl.startsWith("http")}
              fileUrl={fileUrl ?? ""}
              fileName={selectedDeliverable?.fileName ?? ""}
              deliverableId={selectedDeliverable?.deliverableId as Id<"deliverables"> | undefined}
              initialPage={selectedDeliverable?.initialPage ?? 1}
              onClose={() => setSelectedDeliverable(null)}
            />

            {/* OnlyOffice Document Editor Modal */}
            {officeDoc && resolvedOfficeUrl && (
              <OnlyOfficeEditor
                fileId={`${officeDoc.deliverableId}-${officeDoc.storageId}${officeDoc.mode === "view" ? "-view2" : ""}`}
                deliverableId={officeDoc.deliverableId}
                fileName={officeDoc.fileName}
                fileUrl={resolvedOfficeUrl}
                mode={officeDoc.mode}
                userId={user?.id}
                userName={user?.fullName ?? undefined}
                docKey={officeDoc.draft?.docKey}
                draftId={officeDoc.draft?.id}
                baseVersion={officeDoc.draft?.baseVersion}
                onSubmit={officeDoc.draft ? submitDraft : undefined}
                onClose={closeEditor}
              />
            )}

            {isRestoringEditor && (
              <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/80 text-white">
                <div className="text-center">
                  <Loader2 className="mx-auto h-8 w-8 animate-spin" />
                  <p className="mt-3 text-sm">Restoring your document editor…</p>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default function Dashboard() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center min-h-screen">
          <p className="text-sm text-muted-foreground animate-pulse">Loading...</p>
        </div>
      }
    >
      <DashboardContent />
    </Suspense>
  );
}