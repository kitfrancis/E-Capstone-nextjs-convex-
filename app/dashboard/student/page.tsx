"use client";

import { useQuery, useMutation, useConvex } from "convex/react";
import { useUser } from "@clerk/nextjs";
import { api } from "@/convex/_generated/api";
import { DefenseBadge, DefenseStatusCard } from "@/app/components/defense-status-card";
import { ProposalScheduleCard } from "@/app/components/proposal-schedule-card";
import { Id } from "@/convex/_generated/dataModel";
import { forceSaveDraft } from "@/lib/onlyoffice-draft";
import { useState, useMemo, useEffect, useRef, Suspense, Fragment } from "react";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SelectDemo } from "@/app/components/select";
import { DeleteDeliverable } from "@/app/components/deleteDeliverable";
import { toast } from "sonner";
import { chapterOf, computeProgress, TOTAL_CHAPTERS } from "@/lib/progress";
import {
  CheckCircle2,
  Clock,
  RotateCcw,
  RefreshCw,
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
  BarChart3,
  Code2,
  ShieldCheck,
  Archive as ArchiveIcon,
  ChevronRight,
  Pencil,
  Plus,
  FolderOpen,
  GraduationCap,
} from "lucide-react";
import { FinalRevisionsCard } from "@/app/components/final-revisions-card";

const TEAM_ROLES = [
  "Project Manager",
  "Programmer",
  "Designer",
  "System Analyst",
  "System Architect",
] as const;
type TeamRole = (typeof TEAM_ROLES)[number];

// Phase name used for the final IMRaD manuscript (not counted in chapter progress)
const IMRAD_PHASE = "IMRaD Final";

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
  "inline-flex items-center justify-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap";
const CARD = "rounded-2xl border bg-card shadow-xs";
const TH = "px-4 py-3 text-left text-sm font-semibold text-foreground whitespace-nowrap";
const EDITOR_SESSION_KEY = "student-editor-session";

/**
 * Maps project.stage to the index of the CURRENT step in the journey below.
 * When there is no stage, the step is worked out from the proposal result and chapter progress.
 * Archived = 6, so every step shows as Completed.
 */
const STAGE_STEP: Record<string, number> = {
  proposal_endorsed: 1,
  proposal_scheduled: 1,
  endorsed: 3,
  defense_scheduled: 3,
  final_revisions: 4,
  chapter_revisions: 4,
  ready_to_archive: 5,
  archived: 6,
};

const JOURNEY = [
  { label: "Chapter 1–3", icon: FileText },
  { label: "Pre-Oral Defense", icon: ShieldCheck },
  { label: "Chapter 4–5", icon: Code2 },
  { label: "Final Defense", icon: Users },
  { label: "Final Revisions", icon: RefreshCw },
  { label: "Archive", icon: ArchiveIcon },
];

const AVATAR_COLORS = [
  "bg-blue-600",
  "bg-violet-600",
  "bg-emerald-600",
  "bg-amber-600",
  "bg-rose-600",
];

const initials = (name?: string) =>
  (name ?? "")
    .split(" ")
    .filter(Boolean)
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

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

function DashboardContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const currentTab = searchParams.get("tab") || "dashboard";
  const isImradUpload = searchParams.get("type") === "imrad";
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
    const syncFinalRevisions = useMutation(api.defense.syncFinalRevisions);
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

  type Deliverable = NonNullable<typeof deliverables>[number];

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
    fileUrl?: string;
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
    officeDoc?.fileUrl ??
    (officeDoc && loadedOfficeUrl?.storageId === officeDoc.storageId
      ? loadedOfficeUrl.url
      : null);

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
            docKey: `${draft.draftId}-${draft.storageId}`,
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
        router.replace(`${window.location.pathname}?tab=deliverables`, { scroll: false });
      }, 500);
    }
  }, [deliverableIdFromUrl, deliverables, highlightPageFromUrl, router]);

  // Sidebar "tasks" link: jump to the tasks card on the combined page
  useEffect(() => {
    if (currentTab === "tasks" && project) {
      document.getElementById("my-tasks")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [currentTab, project?._id]);

  // Lock the phase to IMRaD when opened from the dashboard button
  useEffect(() => {
    if (isImradUpload) {
      setPhase(IMRAD_PHASE);
    } else {
      setPhase((prev) => (prev === IMRAD_PHASE ? "" : prev));
    }
  }, [isImradUpload]);

  const progress = useMemo(() => computeProgress(deliverables ?? []), [deliverables]);

  // IMRaD: available once the instructor approves the final revisions
const readyToArchive = String(project?.stage ?? "") === "ready_to_archive";
const imradDoc = deliverables?.find((d) => d.phase === IMRAD_PHASE);
  

  // Chapter checks + proposal state (used by the readiness sync and the stepper)
  const ch13Done = progress.chapters.slice(0, 3).every((c) => c.status === "approved");
  const ch45Done = progress.chapters.slice(3, 5).every((c) => c.status === "approved");
  const proposalDone =
    project?.proposalResult === "passed" || project?.proposalResult === "passed_with_revisions";

  // Same rule the server uses: Chapters 1-3 -> proposal defense, then 100% -> final defense
  const needsSync = proposalDone ? progress.total >= 100 : ch13Done;
  useEffect(() => {
    if (project && !project.stage && needsSync) {
      syncReadiness({ projectId: project._id as Id<"capstoneProjects"> }).catch(() => {});
    }
  }, [project?._id, project?.stage, needsSync, syncReadiness]);

    // Final revisions: unlock IMRaD once every chapter was resubmitted and approved
  useEffect(() => {
    if (project?.stage === "final_revisions" && progress.total >= 100) {
      syncFinalRevisions({ projectId: project._id as Id<"capstoneProjects"> }).catch(() => {});
    }
  }, [project?._id, project?.stage, progress.total, syncFinalRevisions]);

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

  const submitDraft = async (hasChanges: boolean) => {
    const doc = officeDoc;
    if (!doc?.draft || !project?._id) throw new Error("Missing project.");
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
      capstoneProjectId: project._id as Id<"capstoneProjects">,
      draftId: latest._id,
    });
    const savedVersion = (await convex.query(api.dashboard.getDeliverables, {
      capstoneProjectId: project._id as Id<"capstoneProjects">,
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

  // Upload handler
  const chosenChapter = chapterOf(phase);
  const chosen = chosenChapter ? progress.chapters[chosenChapter - 1] : null;
    // Approved chapters can be resubmitted during final revisions (after the forms are up)
  const revisionsOpen =
    project?.stage === "final_revisions" && (project.evaluationForms?.length ?? 0) >= 3;
  const alreadyApproved = chosen?.status === "approved" && !revisionsOpen;

  // Chapters 4-5 stay locked until the proposal defense is passed
  const proposalLocked = !!chosenChapter && chosenChapter >= 4 && !proposalDone;

  // IMRaD upload is blocked until final revisions are approved, or once already submitted
 const imradNeedsRevision = imradDoc?.status === "needs_revision";
const imradBlocked =
  isImradUpload && (!readyToArchive || (!!imradDoc && !imradNeedsRevision));

  let uploadHint = "";
 if (isImradUpload) {
  if (imradDoc && !imradNeedsRevision) uploadHint = "Your IMRaD manuscript is already submitted.";
  else if (imradNeedsRevision)
    uploadHint = "Your instructor asked for changes. Upload a corrected version.";
  else if (!readyToArchive)
    uploadHint = "IMRaD upload unlocks after your final revisions are approved.";
  else uploadHint = "Upload your final formatted IMRaD manuscript (PDF) for archiving or binding.";
} else if (chosenChapter && chosen) {
    if (proposalLocked)
      uploadHint = `Chapter ${chosenChapter} unlocks after you pass the proposal defense.`;
    else if (alreadyApproved) uploadHint = `Chapter ${chosenChapter} is already approved.`;
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
    if (imradDoc && !imradNeedsRevision) {
  toast.error("Your IMRaD manuscript is already submitted.");
  return;
}
    if (isImradUpload) {
      if (!readyToArchive) {
        toast.error("IMRaD upload is only available after your final revisions are approved.");
        return;
      }
      if (!isPdf(file.name)) {
        toast.error("The IMRaD manuscript must be a PDF.");
        return;
      }
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
        capstoneProjectId: project._id as Id<"capstoneProjects">,
      });

      toast.success(
        isImradUpload ? "IMRaD manuscript submitted for archiving!" : "Uploaded successfully!"
      );
      setFile(null);
      setPhase("");
      router.push(
        isImradUpload ? "/dashboard/student" : "/dashboard/student?tab=deliverables",
        { scroll: false }
      );
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

  const getTaskLabel = (status: string) => {
    if (status === "completed") return "Completed";
    if (status === "in_progress") return "In Progress";
    if (status === "under_review") return "Waiting to be checked by instructor";
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

  const formatDateTime = (dateStr: string) => {
    const d = new Date(dateStr);
    const time = d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
    return `${formatDate(dateStr)} at ${time}`;
  };

  const firstName = me?.name?.split(" ")[0];

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

  // Project journey (Dashboard stepper)
  const stage = project?.stage ? String(project.stage) : undefined;
  const currentStep =
    stage && stage in STAGE_STEP
      ? STAGE_STEP[stage]
      : proposalDone
        ? ch45Done
          ? 3
          : 2
        : ch13Done
          ? 1
          : 0;

  // Banner: welcome on the dashboard, manuscript banner on the other pages
  const onManuscriptPages = !!project && currentTab !== "dashboard";
  const BannerIcon = onManuscriptPages ? UploadCloud : GraduationCap;

  return (
    <div className="scroll-smooth bg-background min-h-screen">
      <div className="lg:px-5 pb-8 space-y-6">
        {/* Banner */}
        <div className="relative isolate overflow-hidden rounded-2xl bg-linear-to-r from-blue-100 via-blue-50 to-sky-100 dark:from-blue-950/60 dark:via-blue-950/30 dark:to-slate-900 p-6 lg:p-8">
          <div className="relative z-10">
            {onManuscriptPages ? (
              <>
                <h1 className="text-2xl lg:text-3xl font-bold text-foreground">
                  Manuscript &amp; Task Management
                </h1>
                <p className="text-sm lg:text-base text-muted-foreground mt-2">
                  Manage your manuscript and keep track of your assigned tasks.
                </p>
              </>
            ) : (
              <>
                <h1 className="text-2xl lg:text-3xl font-bold text-foreground">
                  Welcome back,{" "}
                  {me === undefined ? (
                    <span className="text-muted-foreground">...</span>
                  ) : (
                    firstName ?? "—"
                  )}
                  !
                </h1>
                <p className="text-sm lg:text-base text-muted-foreground mt-2">
                  Track your capstone progress and manage your project.
                </p>
              </>
            )}
          </div>
          <BannerIcon
            aria-hidden
            strokeWidth={1.4}
            className="pointer-events-none absolute right-8 top-1/2 hidden h-28 w-28 -translate-y-1/2 text-blue-300/70 dark:text-blue-800/60 sm:block"
          />
        </div>

        {project === null ? (
          <div className={`${CARD} p-8 lg:p-10 flex flex-col items-center justify-center text-center`}>
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
          <div className={`${CARD} p-10 flex items-center justify-center`}>
            <p className="text-sm text-muted-foreground animate-pulse">Loading...</p>
          </div>
        ) : (
          <>
            {/* ───────────── DASHBOARD PAGE ───────────── */}
            {currentTab === "dashboard" && (
              <>
                {/* Project Progress */}
                <div className={`${CARD} p-5 lg:p-6`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3 min-w-0">
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300">
                        <BarChart3 className="h-5 w-5" />
                      </div>
                      <div className="min-w-0">
                        <h2 className="text-lg font-semibold text-foreground leading-tight">
                          Project Progress
                        </h2>
                        <p className="text-sm text-muted-foreground mt-0.5 truncate">
                          {project.projectTitle || "Your current progress in the capstone journey."}
                        </p>
                      </div>
                    </div>
                    <DefenseBadge project={project} progress={progress.total} />
                  </div>

                  {/* Journey stepper */}
                  <div className="mt-6 grid grid-cols-2 gap-x-3 gap-y-6 sm:grid-cols-3 lg:flex lg:items-start lg:gap-0">
                    {JOURNEY.map((step, i) => {
                      const state =
                        i < currentStep ? "completed" : i === currentStep ? "in_progress" : "pending";
                      const Icon = step.icon;
                      return (
                        <Fragment key={step.label}>
                          {i > 0 && (
                            <div className="mt-7 hidden flex-1 items-center text-muted-foreground/60 lg:flex">
                              <div className="h-px flex-1 bg-border" />
                              <ChevronRight className="h-4 w-4 shrink-0" />
                              <div className="h-px flex-1 bg-border" />
                            </div>
                          )}
                          <div className="flex flex-col items-center text-center lg:w-32 lg:shrink-0">
                            <div
                              className={`flex h-14 w-14 items-center justify-center rounded-full ${
                                state === "pending"
                                  ? "bg-muted text-muted-foreground"
                                  : "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300"
                              } ${state === "in_progress" ? "ring-2 ring-blue-500 ring-offset-2 ring-offset-card" : ""}`}
                            >
                              <Icon className="h-6 w-6" />
                            </div>
                            <p className="mt-2 text-sm font-semibold text-foreground">{step.label}</p>
                            <p
                              className={`mt-1 inline-flex items-center gap-1 text-sm ${
                                state === "completed"
                                  ? "text-green-600 dark:text-green-400"
                                  : state === "in_progress"
                                    ? "text-blue-600 dark:text-blue-400"
                                    : "text-muted-foreground"
                              }`}
                            >
                              {state === "completed" ? (
                                <CheckCircle2 className="h-4 w-4" />
                              ) : (
                                <Clock className="h-4 w-4" />
                              )}
                              {state === "completed"
                                ? "Completed"
                                : state === "in_progress"
                                  ? "In Progress"
                                  : "Pending"}
                            </p>
                          </div>
                        </Fragment>
                      );
                    })}
                  </div>

                  {/* Final revisions approved: ready for archiving / binding */}
                  {readyToArchive && (() => {
  const endorsed = !!project.archiveEndorsedAt;
  const s = imradDoc?.status;
  const needsUpload = !imradDoc || s === "needs_revision";
  const [title, text] = !imradDoc
    ? ["Final Revisions Completed!", "Upload your final formatted IMRaD manuscript for archival and final approval."]
    : s === "needs_revision"
      ? ["IMRaD Needs Revision", "Your instructor asked for changes. Fix them and upload a new version."]
      : s === "under_review"
        ? ["IMRaD Submitted", `${imradDoc.fileName} is waiting for your instructor to verify it.`]
        : endorsed
          ? ["Endorsed for Archiving", "Your instructor endorsed the project. The admin is doing the final verification."]
          : ["IMRaD Verified", "Waiting for your instructor to endorse the project for archiving."];
  return (
    <div className="mt-6 flex flex-col gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 sm:flex-row sm:items-center sm:justify-between dark:border-emerald-900 dark:bg-emerald-950/30">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-600 text-white">
          <FileText className="h-5 w-5" />
        </div>
        <div>
          <p className="text-sm font-semibold text-foreground">{title}</p>
          <p className="text-xs text-muted-foreground">{text}</p>
        </div>
      </div>
      {needsUpload && (
        <Button
          asChild
          className="rounded-lg gap-2 bg-emerald-600 text-white hover:bg-emerald-700 self-start sm:self-auto"
        >
          <Link href="/dashboard/student?tab=uploads&type=imrad" scroll={false}>
            <UploadCloud className="h-4 w-4" />
            {imradDoc ? "Re-upload IMRaD File" : "Upload IMRaD File"}
          </Link>
        </Button>
      )}
    </div>
  );
})()}

                  {/* Chapter detail */}
                  <div className="mt-6 border-t pt-4">
                    <div className="flex items-end justify-between gap-3">
                      <p className="text-sm text-muted-foreground">
                        {progress.approved} of {TOTAL_CHAPTERS} chapters approved
                      </p>
                      <span className="text-2xl font-semibold text-foreground tabular-nums leading-none">
                        {progress.total}%
                      </span>
                    </div>
                    <div className="mt-3 grid grid-cols-5 gap-1.5">
                      {progress.chapters.map((c) => (
                        <div key={c.chapter}>
                          <div className="h-2 overflow-hidden rounded-full bg-muted">
                            <div
                              className={`h-full rounded-full transition-all duration-500 ${
                                c.status === "approved"
                                  ? "bg-green-600"
                                  : c.status === "needs_revision"
                                    ? "bg-amber-500"
                                    : "bg-blue-600"
                              }`}
                              style={{ width: `${(c.points / (100 / TOTAL_CHAPTERS)) * 100}%` }}
                            />
                          </div>
                          <p className="mt-1 text-center text-[11px] text-muted-foreground">
                            Ch {c.chapter} · {c.points}%
                          </p>
                        </div>
                      ))}
                    </div>
                    <p className="mt-3 text-xs text-muted-foreground">
                      Counts use the latest version of each chapter.
                      {progress.superseded > 0 &&
                        ` ${progress.superseded} older ${progress.superseded === 1 ? "version is" : "versions are"} superseded.`}
                    </p>
                  </div>

                  <DefenseStatusCard project={project} progress={progress.total} />
                  <ProposalScheduleCard project={project} />
                  <FinalRevisionsCard projectId={project._id as Id<"capstoneProjects">} />
                </div>

                {/* Members / Adviser / Quick info */}
                <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-[1.5fr_1fr_0.9fr]">
                  {/* Group Members */}
                  <div className={`${CARD} flex flex-col md:col-span-2 xl:col-span-1`}>
                    <div className="flex items-start gap-3 p-5 pb-3">
                      <Users className="mt-0.5 h-6 w-6 text-blue-600" />
                      <div>
                        <h2 className="text-lg font-semibold text-foreground leading-tight">Group Members</h2>
                        <p className="text-sm text-muted-foreground">Your project team.</p>
                      </div>
                    </div>

                    <div className="border-t px-5 py-5">
                      {teamMembers === undefined ? (
                        <p className="text-sm text-muted-foreground animate-pulse">Loading members...</p>
                      ) : teamMembers.length === 0 ? (
                        <p className="text-sm text-muted-foreground">No team members found</p>
                      ) : (
                        <div className="grid grid-cols-2 gap-y-6 sm:grid-cols-3 sm:divide-x">
                          {teamMembers.map((member, i) => {
                            const memberRole = project.teamRoles?.find(
                              (assignment) => assignment.memberId === member._id
                            )?.role;
                            return (
                              <div key={member._id} className="flex flex-col items-center px-2 text-center">
                                <div
                                  className={`flex h-14 w-14 items-center justify-center rounded-full text-base font-semibold text-white ${AVATAR_COLORS[i % AVATAR_COLORS.length]}`}
                                >
                                  {initials(member.name)}
                                </div>
                                <p className="mt-2 text-sm font-medium text-foreground">
                                  {member.name}
                                  {me?._id === member._id && (
                                    <span className="ml-1.5 rounded-full bg-blue-600 px-1.5 py-0.5 align-middle text-[10px] font-medium text-white">
                                      You
                                    </span>
                                  )}
                                </p>
                                <span className="mt-2 rounded-full bg-muted px-3 py-1 text-xs font-medium text-muted-foreground">
                                  {memberRole ?? "No role yet"}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    {/* Your team role */}
                    <div className="mt-auto flex flex-col gap-3 border-t bg-muted/30 p-4 sm:flex-row sm:items-end sm:justify-between">
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
                          <SelectTrigger id="student-team-role" className="w-full sm:w-60">
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
                  </div>

                  {/* Adviser */}
                  <div className={`${CARD} flex flex-col`}>
                    <div className="flex items-start gap-3 p-5 pb-3">
                      <UserCheck className="mt-0.5 h-6 w-6 text-blue-600" />
                      <div>
                        <h2 className="text-lg font-semibold text-foreground leading-tight">Adviser</h2>
                        <p className="text-sm text-muted-foreground">Your project adviser.</p>
                      </div>
                    </div>
                    <div className="flex flex-1 flex-col border-t p-5">
                      {projectAdviser === undefined ? (
                        <p className="text-sm text-muted-foreground animate-pulse">Loading...</p>
                      ) : projectAdviser === null ? (
                        <div className="flex items-center gap-3">
                          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted text-muted-foreground">
                            -
                          </div>
                          <p className="text-sm text-muted-foreground">No adviser assigned</p>
                        </div>
                      ) : (
                        <>
                          <div className="flex items-center gap-4">
                            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-blue-100 text-lg font-semibold text-blue-700 dark:bg-blue-950 dark:text-blue-300">
                              {initials(projectAdviser.name)}
                            </div>
                            <div className="min-w-0">
                              <p className="text-base font-semibold text-foreground">{projectAdviser.name}</p>
                              <p className="text-sm text-muted-foreground capitalize">{projectAdviser.role}</p>
                            </div>
                          </div>
                          <p className="mt-auto flex items-center gap-2 border-t pt-4 text-sm text-muted-foreground">
                            <Mail className="h-4 w-4 shrink-0" />
                            <span className="truncate">{projectAdviser.email}</span>
                          </p>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Quick Info */}
                  <div className={`${CARD} flex flex-col`}>
                    <div className="flex items-center gap-3 p-5 pb-3">
                      <BarChart3 className="h-6 w-6 text-blue-600" />
                      <h2 className="text-lg font-semibold text-foreground leading-tight">Quick Info</h2>
                    </div>
                    <ul className="divide-y border-t">
                      {[
                        {
                          label: "Chapters Approved",
                          value: `${progress.approved}/${TOTAL_CHAPTERS}`,
                          Icon: FolderOpen,
                          tone: "text-violet-600 dark:text-violet-400",
                        },
                        {
                          label: "Completed Tasks",
                          value: tasks === undefined ? "—" : String(taskCounts.completed),
                          Icon: CheckCircle2,
                          tone: "text-green-600 dark:text-green-400",
                        },
                        {
                          label: "Open Tasks",
                          value:
                            tasks === undefined ? "—" : String(taskCounts.all - taskCounts.completed),
                          Icon: Clock,
                          tone: "text-blue-600 dark:text-blue-400",
                        },
                      ].map(({ label, value, Icon, tone }) => (
                        <li key={label} className="flex items-center gap-3 px-5 py-4">
                          <Icon className={`h-6 w-6 shrink-0 ${tone}`} />
                          <span className="flex-1 text-sm text-foreground">{label}</span>
                          <span className="text-base font-semibold text-foreground tabular-nums">{value}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </>
            )}

            {/* ───────────── MANUSCRIPT & TASKS PAGE ───────────── */}
            {(currentTab === "deliverables" || currentTab === "tasks") && (
              <>
                {/* My Manuscript */}
                <div className={`${CARD} p-5 lg:p-6`}>
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-center gap-3">
                      <FileText className="h-7 w-7 text-blue-600" />
                      <h2 className="text-xl font-semibold text-foreground">My Manuscript</h2>
                    </div>
                    <Button asChild className="rounded-lg gap-2 bg-blue-600 text-white hover:bg-blue-700 self-start sm:self-auto">
                      <Link href="/dashboard/student?tab=uploads" scroll={false}>
                        <Plus className="h-4 w-4" />
                        Upload New Document
                      </Link>
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
                        <Button asChild size="sm" className="mt-4 rounded-lg bg-blue-600 text-white hover:bg-blue-700">
                          <Link href="/dashboard/student?tab=uploads" scroll={false}>Upload Now</Link>
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
                              const deleteLocked =
                                (cp?.status === "approved" || d.status === "approved") && !isAdmin;
                              const canView = isPdf(d.fileName) || isOffice(d.fileName);
                              const canEdit =
                                isOffice(d.fileName) &&
                                isLatest &&
                                project?.stage !== "archived";
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
                                        <p className="text-xs text-muted-foreground">
                                          {d.phase === IMRAD_PHASE ? "Final IMRaD Manuscript" : d.phase}
                                        </p>
                                        {!chNum && d.phase !== IMRAD_PHASE && (
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

                {/* My Tasks */}
                <div id="my-tasks" className={`${CARD} p-5 lg:p-6 scroll-mt-4`}>
                  <div className="flex items-center gap-3">
                    <CheckSquare className="h-7 w-7 text-blue-600" />
                    <h2 className="text-xl font-semibold text-foreground">My Tasks</h2>
                  </div>

                  {/* Filter pills */}
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
                        <table className="w-full min-w-215 text-sm">
                          <thead className="bg-muted/50">
                            <tr>
                              <th className={TH}>Task Title</th>
                              <th className={TH}>Description</th>
                              <th className={TH}>Due Date</th>
                              <th className={TH}>Status</th>
                              <th className={`${TH} text-right`}>Action</th>
                            </tr>
                          </thead>
                          <tbody>
                            {filteredTasks.map((task) => (
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
                                <td className="px-4 py-3">
                                  <span className={`${BADGE_BASE} ${getTaskBadge(task.status)}`}>
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
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </div>
              </>
            )}

            {/* ───────────── UPLOAD PAGE ───────────── */}
            {currentTab === "uploads" && (
              <div className="space-y-4">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h2 className="text-xl font-semibold text-foreground">
                      {isImradUpload ? "Upload IMRaD Manuscript" : "Upload Deliverable"}
                    </h2>
                    <p className="text-sm text-muted-foreground">
                      {isImradUpload
                        ? "Upload your final formatted IMRaD manuscript (PDF) for archiving or binding."
                        : "Upload a new version or chapter manuscript for adviser review."}
                    </p>
                  </div>
                  <Button asChild variant="outline" size="sm" className="rounded-lg self-start sm:self-auto">
                    <Link
                      href={isImradUpload ? "/dashboard/student" : "/dashboard/student?tab=deliverables"}
                      scroll={false}
                    >
                      {isImradUpload ? "Back to Dashboard" : "View My Manuscript"}
                    </Link>
                  </Button>
                </div>

                <div className={`${CARD} p-6 lg:p-8 space-y-6`}>
                  {/* Chapter selector */}
                  <div className="space-y-2">
                    <label className="text-foreground text-sm font-medium">
                      {isImradUpload ? "Document Type" : "Select Chapter"}
                    </label>
                    {isImradUpload ? (
                      <div className="rounded-xl border bg-muted/40 px-3 py-2 text-sm text-foreground">
                        Final IMRaD Manuscript (PDF)
                      </div>
                    ) : (
                      <SelectDemo value={phase} onValueChange={setPhase} />
                    )}
                    {uploadHint && (
                      <div
                        className={`flex items-start gap-2 rounded-xl p-3 text-xs leading-relaxed ${
                          proposalLocked || (imradBlocked && !imradDoc)
                            ? "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300"
                            : alreadyApproved || imradDoc || (isImradUpload && readyToArchive)
                              ? "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300"
                              : "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300"
                        }`}
                      >
                        {proposalLocked || (imradBlocked && !imradDoc) ? (
                          <ShieldCheck className="h-4 w-4 shrink-0 mt-0.5" />
                        ) : alreadyApproved || imradDoc ? (
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
                              {isImradUpload
                                ? "PDF only (max 50MB)"
                                : "Accepts PDF, DOC, DOCX, XLSX, PPTX, or ZIP (max 50MB)"}
                            </p>
                          </>
                        )}
                      </div>
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept={isImradUpload ? ".pdf" : ".pdf,.doc,.docx,.xlsx,.pptx,.zip"}
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
                      disabled={
                        !file ||
                        !phase ||
                        uploading ||
                        alreadyApproved ||
                        proposalLocked ||
                        imradBlocked
                      }
                      className="h-11 px-6 rounded-lg gap-2 bg-blue-600 text-white hover:bg-blue-700"
                    >
                      {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <UploadCloud className="h-4 w-4" />}
                      {uploading
                        ? "Uploading..."
                        : isImradUpload
                          ? "Upload IMRaD File"
                          : "Upload Deliverable"}
                    </Button>
                  </div>
                </div>
              </div>
            )}

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
                phase={officeDoc.phase}
                deliverables={deliverables ?? []}
                workspaceSidebar
                workspaceReadOnly={project?.stage === "archived"}
                onSelectChapter={selectChapter}
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
              <div className="fixed inset-0 z-60 flex items-center justify-center bg-slate-950/80 text-white">
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