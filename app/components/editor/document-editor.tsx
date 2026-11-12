"use client";

import { useEffect, useRef, useState } from "react";
import {
  BookOpen,
  ChevronDown,
  ChevronUp,
  CircleAlert,
  FileText,
  History,
  Keyboard,
  Loader2,
  Power,
  RotateCw,
  Save,
} from "lucide-react";
import type { Id } from "@/convex/_generated/dataModel";
import {
  registerEditorWorkspace,
  useAppTheme,
} from "@/components/ui/theme-provider";
import WorkspaceChat from "./workspace-chat";

type WorkspaceDeliverable = {
  _id: string;
  storageId?: string;
  fileName: string;
  phase: string;
  version: number;
  uploadedAt: string;
  versionLabel?: string;
  message?: string;
};

type VersionComparison = {
  selectedDeliverableId: string;
  selectedVersion: number;
  selectedFileName: string;
  selectedFileUrl: string;
  comparisonFileUrl: string;
  comparisonStorageId: string;
  comparisonFileType: string;
  comparisonVersion: number;
  comparisonIsDraft: boolean;
};

type OnlyOfficeEditorProps = {
  fileId: string;
  deliverableId: string;
  fileName: string;
  fileUrl: string;
  phase?: string;
  capstoneProjectId?: Id<"capstoneProjects">;
  deliverables?: WorkspaceDeliverable[];
  workspaceSidebar?: boolean;
  workspaceReadOnly?: boolean;
  mode?: "edit" | "review" | "comment" | "view";
  userId?: string;
  userName?: string;
  onSelectChapter?: (phase: string, hasChanges: boolean) => Promise<void>;
  onCompareVersion?: (
    deliverableId: string,
    shouldForceSave: boolean,
    draftStorageIdAtSelection: string | null,
  ) => Promise<VersionComparison>;
  onGetDraftStorageId?: () => Promise<string | null>;
  onClose: (hasChanges: boolean) => void | Promise<void>;
  // NEW: draft editing
  docKey?: string;                 // unique per editor session (falls back to fileId)
  draftId?: string;                // tells the callback to save into the draft, not a version
  draftSessionRevision?: number;
  baseVersion?: number;            // shows "Draft based on v1" and labels the button "Submit as v2"
  onSubmit?: (hasChanges: boolean) => Promise<void>;
  latestVersionAvailable?: number;
  onOpenLatestVersion?: (hasChanges: boolean) => Promise<void>;
  onEditorReady?: () => void;
  onEditorError?: () => void;
};

type DocsApi = {
  DocEditor: new (elementId: string, config: Record<string, unknown>) => {
    destroyEditor: () => void;
  };
};

type OnlyOfficeInstance = {
  destroyEditor: () => void;
  setRequestedDocument?: (document: {
    c: "compare";
    fileType: string;
    url: string;
  }) => void;
};

type EditorSlot = 0 | 1;
const elementIds = ["onlyoffice-editor-0", "onlyoffice-editor-1"] as const;
const CALLBACK_TARGET_ERROR = "The OnlyOffice save callback points to a different site";
const SAVE_WITH_SHORTCUT_MESSAGE =
  "OnlyOffice couldn't confirm your latest edits. Press Ctrl+S in the document, wait for it to save, then try again.";

function isSaveConfirmationError(error: unknown) {
  return (
    error instanceof Error &&
    (error.message.includes(CALLBACK_TARGET_ERROR) ||
      error.message.startsWith("Couldn't save your latest edits") ||
      error.message.includes("has not confirmed your latest edits") ||
      (error.message.toLowerCase().includes("onlyoffice") &&
        error.message.toLowerCase().includes("save")))
  );
}

declare global {
  interface Window {
    DocsAPI?: DocsApi;
  }
}

let onlyOfficeApiPromise: Promise<void> | null = null;

const LOAD_TIMEOUT_MS = 15000;

const EDITABLE_EXTENSIONS = new Set([
  "doc", "docx", "odt", "xls", "xlsx", "ods", "ppt", "pptx", "odp", "pdf",
]);

export function isOnlyOfficeEditable(fileName: string) {
  const extension = fileName.split(".").pop()?.toLowerCase();
  return extension ? EDITABLE_EXTENSIONS.has(extension) : false;
}

function getDocumentType(fileName: string) {
  const extension = fileName.split(".").pop()?.toLowerCase();
  if (extension === "pdf") return "pdf";
  if (extension && ["xls", "xlsx", "ods"].includes(extension)) return "cell";
  if (extension && ["ppt", "pptx", "odp"].includes(extension)) return "slide";
  return "word";
}

function isWordDocument(fileName: string) {
  return ["doc", "docx", "odt"].includes(fileName.split(".").pop()?.toLowerCase() ?? "");
}

function loadOnlyOfficeApi(serverUrl: string) {
  if (window.DocsAPI) return Promise.resolve();
  if (onlyOfficeApiPromise) return onlyOfficeApiPromise;

  onlyOfficeApiPromise = new Promise<void>((resolve, reject) => {
    document.querySelector('script[data-onlyoffice-api="true"]')?.remove();

    const script = document.createElement("script");
    let finished = false;

    const fail = () => {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      script.remove();
      onlyOfficeApiPromise = null;
      reject(
        new Error(
          `OnlyOffice could not be reached at ${serverUrl}. Check that the OnlyOffice server is running.`,
        ),
      );
    };

    const timer = setTimeout(fail, LOAD_TIMEOUT_MS);

    script.addEventListener("load", () => {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      resolve();
    });
    script.addEventListener("error", fail);

    script.src = `${serverUrl}/web-apps/apps/api/documents/api.js`;
    script.dataset.onlyofficeApi = "true";
    document.body.appendChild(script);
  });

  return onlyOfficeApiPromise;
}

export default function OnlyOfficeEditor({
  fileId,
  deliverableId,
  fileName,
  fileUrl,
  phase,
  capstoneProjectId,
  deliverables = [],
  workspaceSidebar = false,
  workspaceReadOnly = false,
  mode = "view",
  userId,
  userName,
  onSelectChapter,
  onCompareVersion,
  onGetDraftStorageId,
  onClose,
  docKey,
  draftId,
  draftSessionRevision,
  baseVersion,
  onSubmit,
  latestVersionAvailable,
  onOpenLatestVersion,
  onEditorReady,
  onEditorError,
}: OnlyOfficeEditorProps) {
  const { theme, mounted: themeMounted } = useAppTheme();
  const onEditorReadyRef = useRef(onEditorReady);
  const onEditorErrorRef = useRef(onEditorError);
  onEditorReadyRef.current = onEditorReady;
  onEditorErrorRef.current = onEditorError;
  const activeEditorRef = useRef<{ editor: OnlyOfficeInstance; slot: EditorSlot } | null>(null);
  const stagedEditorRef = useRef<{ editor: OnlyOfficeInstance; slot: EditorSlot } | null>(null);
  const activeSlotRef = useRef<EditorSlot | null>(null);
  const hasPendingChangesRef = useRef(false);
  const hasChangesRef = useRef(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeEditorSlot, setActiveEditorSlot] = useState<EditorSlot | null>(null);
  const [showSaveWarning, setShowSaveWarning] = useState(false);
  const [activeDocument, setActiveDocument] = useState<{
    phase?: string;
    fileName: string;
    draftId?: string;
    baseVersion?: number;
  } | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [closing, setClosing] = useState(false); // NEW
  const [openingLatestVersion, setOpeningLatestVersion] = useState(false);
  const [showSubmitReminder, setShowSubmitReminder] = useState(false);
  const [versionAwaitingCompare, setVersionAwaitingCompare] =
    useState<WorkspaceDeliverable | null>(null);
  const [showCompareReminder, setShowCompareReminder] = useState(false);
  const [capturingDraftBaseline, setCapturingDraftBaseline] = useState(false);
  const [draftStorageIdAtSelection, setDraftStorageIdAtSelection] =
    useState<string | null>(null);
  const [comparison, setComparison] = useState<VersionComparison | null>(null);
  const [comparisonError, setComparisonError] = useState<string | null>(null);
  const [comparing, setComparing] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [switchingChapter, setSwitchingChapter] = useState<string | null>(null);
  const [expandedVersionPhase, setExpandedVersionPhase] = useState<string | null>(null);
  const serverUrl = process.env.NEXT_PUBLIC_ONLYOFFICE_URL || "http://localhost:8080";
  const callbackUrl =
    process.env.NEXT_PUBLIC_ONLYOFFICE_CALLBACK_URL?.trim() ||
    (typeof window === "undefined"
      ? ""
      : `${window.location.origin}/api/onlyoffice/callback`);

  const editorMode = comparison || workspaceReadOnly ? "view" : mode;
  const canSubmit = editorMode === "edit" && !!onSubmit;
  const chapterNames = [
    "Chapter 1: Introduction",
    "Chapter 2: Literature Review",
    "Chapter 3: Methodology",
    "Chapter 4: Results & Discussion",
    "Chapter 5: Conclusion",
  ];
  const currentPhase = activeDocument?.phase ?? phase ?? "";
  const displayedFileName = activeDocument?.fileName ?? fileName;
  const displayedDraftId = comparison ? undefined : activeDocument?.draftId ?? draftId;
  const displayedBaseVersion = comparison ? undefined : activeDocument?.baseVersion ?? baseVersion;
  const chapterMatch = currentPhase.match(/chapter\s*(\d+)/i);
  const currentChapterNumber = chapterMatch ? Number(chapterMatch[1]) : null;
  const currentPhaseDeliverables = deliverables
    .filter((deliverable) => deliverable.phase === currentPhase)
    .sort((a, b) => b.version - a.version);
  const showAllVersions = expandedVersionPhase === currentPhase;
  const visibleVersions = showAllVersions
    ? currentPhaseDeliverables
    : currentPhaseDeliverables.slice(0, 3);
  const latestVersion = currentPhaseDeliverables[0]?.version ?? baseVersion ?? 1;
  const nextVersion = Math.max(latestVersion, baseVersion ?? 0) + 1;
  const workspaceTitle = comparison
    ? `Comparing v${comparison.selectedVersion} with ${
        comparison.comparisonIsDraft
          ? `draft based on v${comparison.comparisonVersion}`
          : `v${comparison.comparisonVersion}`
      }`
    : currentPhase || displayedFileName;

  useEffect(() => {
    hasPendingChangesRef.current = false;
    hasChangesRef.current = false;
  }, [fileId, draftId, fileName, phase]);

  useEffect(() => registerEditorWorkspace(), []);

  useEffect(() => {
    if (!workspaceSidebar || editorMode !== "edit") return;

    const warnBeforeLeaving = (event: BeforeUnloadEvent) => {
      if (!hasPendingChangesRef.current) return;
      event.preventDefault();
      event.returnValue = "";
    };

    window.addEventListener("beforeunload", warnBeforeLeaving);
    return () => window.removeEventListener("beforeunload", warnBeforeLeaving);
  }, [editorMode, workspaceSidebar]);

  useEffect(() => {
    if (switchingChapter && activeDocument?.phase === switchingChapter) {
      setSwitchingChapter(null);
    }
  }, [activeDocument, switchingChapter]);

  useEffect(
    () => () => {
      activeEditorRef.current?.editor.destroyEditor();
      stagedEditorRef.current?.editor.destroyEditor();
      activeEditorRef.current = null;
      stagedEditorRef.current = null;
      activeSlotRef.current = null;
    },
    [],
  );

  async function handleSelectChapter(chapterPhase: string) {
    if (
      !onSelectChapter ||
      chapterPhase === currentPhase ||
      switchingChapter ||
      submitting ||
      closing
    ) {
      return;
    }

    setSwitchingChapter(chapterPhase);
    setSubmitError(null);
    try {
      await onSelectChapter(chapterPhase, hasChangesRef.current);
    } catch (error) {
      const saveConfirmationFailed = isSaveConfirmationError(error);
      if (saveConfirmationFailed) setShowSaveWarning(true);
      setSwitchingChapter(null);
      setSubmitError(saveConfirmationFailed
        ? null
        : error instanceof Error
          ? error.message
          : "Couldn't open that chapter.");
    }
  }

  async function openVersionComparison(
    item: WorkspaceDeliverable,
    hasChanges: boolean,
    storageIdAtSelection: string | null,
  ) {
    if (!onCompareVersion || comparing) return;
    setComparing(true);
    setComparisonError(null);
    try {
      const nextComparison = await onCompareVersion(
        item._id,
        hasChanges,
        storageIdAtSelection,
      );
      hasChangesRef.current = false;
      setComparison(nextComparison);
    } catch (error) {
      const saveConfirmationFailed = isSaveConfirmationError(error);
      if (saveConfirmationFailed) setShowSaveWarning(true);
      setComparisonError(
        saveConfirmationFailed
          ? SAVE_WITH_SHORTCUT_MESSAGE
          : error instanceof Error
            ? error.message
            : "Couldn't compare these versions.",
      );
    } finally {
      setComparing(false);
    }
  }

  async function handleSelectVersion(item: WorkspaceDeliverable) {
    if (!onCompareVersion || comparing || submitting || closing || switchingChapter) return;
    if (hasPendingChangesRef.current || hasChangesRef.current) {
      setCapturingDraftBaseline(true);
      try {
        const storageId = await onGetDraftStorageId?.();
        if (!storageId) throw new Error("The current draft could not be loaded.");
        const baseStorageId = currentPhaseDeliverables.find(
          (version) => version._id === deliverableId,
        )?.storageId;
        const needsSave =
          hasPendingChangesRef.current ||
          (hasChangesRef.current && storageId === baseStorageId);
        if (!needsSave) {
          void openVersionComparison(item, false, storageId);
          return;
        }
        setVersionAwaitingCompare(item);
        setShowCompareReminder(true);
        setDraftStorageIdAtSelection(storageId);
      } catch (error) {
        setShowCompareReminder(false);
        setVersionAwaitingCompare(null);
        setComparisonError(
          error instanceof Error ? error.message : "Couldn't check the current draft.",
        );
      } finally {
        setCapturingDraftBaseline(false);
      }
      return;
    }
    void openVersionComparison(item, false, null);
  }

  useEffect(() => {
    if (!themeMounted) return;

    let cancelled = false;
    let activated = false;
    let comparisonRequested = false;
    let createdEditor: OnlyOfficeInstance | null = null;
    const activeSlot = activeSlotRef.current;
    const editorSlot: EditorSlot = activeSlot === null ? 0 : activeSlot === 0 ? 1 : 0;
    const elementId = elementIds[editorSlot];
    setLoadError(null);
    setLoading(true);

    const clearSlot = (slot: EditorSlot) => {
      document.getElementById(elementIds[slot])?.replaceChildren();
    };

    async function createEditor() {
      try {
        await loadOnlyOfficeApi(serverUrl);
      } catch (error) {
        if (!cancelled) {
          onEditorErrorRef.current?.();
          setLoading(false);
          setSwitchingChapter(null);
          setLoadError(
            error instanceof Error
              ? error.message
              : `OnlyOffice could not be reached at ${serverUrl}.`,
          );
        }
        return;
      }

      if (cancelled) return;
      if (!window.DocsAPI) {
        onlyOfficeApiPromise = null;
        onEditorErrorRef.current?.();
        setLoading(false);
        setSwitchingChapter(null);
        setLoadError("OnlyOffice could not be initialized.");
        return;
      }

      // NEW: draftId is added so the callback knows to write to the draft
      const query =
        `fileId=${encodeURIComponent(deliverableId)}` +
        (draftId
          ? `&draftId=${encodeURIComponent(draftId)}&sessionRevision=${draftSessionRevision ?? 0}`
          : "") +
        (editorMode === "comment" ? "&notify=1" : "");
      const editorFileName = comparison?.selectedFileName ?? fileName;
      const editorFileUrl = comparison?.selectedFileUrl ?? fileUrl;
      const documentKey = comparison
        ? `compare-${comparison.selectedDeliverableId}-${deliverableId}-${comparison.selectedVersion}-${comparison.comparisonStorageId}`
        : docKey ?? fileId;

      clearSlot(editorSlot);
      let editor: OnlyOfficeInstance;
      try {
        editor = new window.DocsAPI.DocEditor(elementId, {
          document: {
            fileType: editorFileName.split(".").pop()?.toLowerCase() || "docx",
            key: documentKey,
            permissions: {
              comment: editorMode !== "view",
              edit: editorMode === "edit",
              review: editorMode === "review",
              fillForms: editorMode === "edit",
              print: true,
            },
            title: editorFileName,
            url: editorFileUrl,
          },
          documentType: getDocumentType(editorFileName),
          editorConfig: {
            callbackUrl: `${callbackUrl}?${query}`,
            coEditing: {
              mode: "fast",
              change: true,
            },
            customization: {
              autosave: true,
              forcesave: true,
              chat: false,
              comments: true,
              uiTheme: theme === "dark" ? "theme-dark" : "theme-light",
            },
            mode: editorMode === "view" ? "view" : "edit",
            user: userId ? { id: userId, name: userName ?? "User" } : undefined,
          },
          events: {
            onAppReady: () => {
              queueMicrotask(() => {
                if (cancelled) return;
                const readyEditor = createdEditor;
                if (!readyEditor) return;
                const previousEditor = activeEditorRef.current;
                if (previousEditor && previousEditor.slot !== editorSlot) {
                  previousEditor.editor.destroyEditor();
                  clearSlot(previousEditor.slot);
                }
                activeEditorRef.current = { editor: readyEditor, slot: editorSlot };
                stagedEditorRef.current = null;
                activeSlotRef.current = editorSlot;
                activated = true;
                setActiveEditorSlot(editorSlot);
                setActiveDocument({
                  phase,
                  fileName: editorFileName,
                  draftId: comparison ? undefined : draftId,
                  baseVersion: comparison ? undefined : baseVersion,
                });
                setSwitchingChapter(null);
                if (!comparison) {
                  setLoading(false);
                  onEditorReadyRef.current?.();
                }
              });
            },
            onDocumentReady: () => {
              if (!comparison || !createdEditor || comparisonRequested) return;
              try {
                if (!createdEditor.setRequestedDocument) {
                  throw new Error("This OnlyOffice version does not support document comparison.");
                }
                comparisonRequested = true;
                createdEditor.setRequestedDocument({
                  c: "compare",
                  fileType: comparison.comparisonFileType,
                  url: comparison.comparisonFileUrl,
                });
                setLoading(false);
                onEditorReadyRef.current?.();
              } catch (error) {
                setLoadError(
                  error instanceof Error
                    ? error.message
                    : "OnlyOffice couldn't start comparing these versions.",
                );
                setLoading(false);
                onEditorErrorRef.current?.();
              }
            },
            onDocumentStateChange: (event: { data?: boolean }) => {
              if (typeof event.data !== "boolean") return;
              hasPendingChangesRef.current = event.data;
              if (event.data) hasChangesRef.current = true;
            },
            onError: (event: { data?: { errorDescription?: string } }) => {
              queueMicrotask(() => {
                console.error("OnlyOffice error:", event?.data);
                if (cancelled) return;
                onEditorErrorRef.current?.();
                if (createdEditor && stagedEditorRef.current?.editor === createdEditor) {
                  createdEditor.destroyEditor();
                  createdEditor = null;
                  stagedEditorRef.current = null;
                  clearSlot(editorSlot);
                }
                setSwitchingChapter(null);
                setLoading(false);
                setLoadError(
                  event?.data?.errorDescription
                    ? `OnlyOffice error: ${event.data.errorDescription}`
                    : "OnlyOffice reported an error. Open the browser console for details.",
                );
              });
            },
          },
          height: "100%",
          type: "desktop",
          width: "100%",
        });
      } catch (error) {
        if (!cancelled) {
          onEditorErrorRef.current?.();
          setLoading(false);
          setSwitchingChapter(null);
          setLoadError(
            error instanceof Error ? error.message : "OnlyOffice could not open this document.",
          );
        }
        return;
      }
      createdEditor = editor;
      stagedEditorRef.current = { editor, slot: editorSlot };
    }

    void createEditor();

    return () => {
      cancelled = true;
      if (!activated && createdEditor) {
        createdEditor.destroyEditor();
        if (stagedEditorRef.current?.editor === createdEditor) {
          stagedEditorRef.current = null;
        }
        clearSlot(editorSlot);
      }
    };
  }, [
    callbackUrl,
    comparison,
    editorMode,
    userId,
    userName,
    deliverableId,
    fileId,
    fileName,
    fileUrl,
    serverUrl,
    docKey,
    draftId,
    draftSessionRevision,
    phase,
    baseVersion,
    theme,
    themeMounted,
    retryCount,
  ]);

  // NEW: Submit button handler
  async function handleSubmit() {
    if (!onSubmit) return;
    setShowSubmitReminder(false);
    setSubmitting(true);
    setSubmitError(null);
    try {
      await onSubmit(hasChangesRef.current);
    } catch (error) {
      const saveConfirmationFailed = isSaveConfirmationError(error);
      if (saveConfirmationFailed) setShowSaveWarning(true);
      setSubmitError(saveConfirmationFailed
        ? null
        : error instanceof Error
          ? error.message
          : "Submit failed. Your draft is still saved.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleOpenLatestVersion() {
    if (!onOpenLatestVersion) return;
    setOpeningLatestVersion(true);
    setSubmitError(null);
    try {
      await onOpenLatestVersion(hasChangesRef.current);
    } catch (error) {
      setSubmitError(
        error instanceof Error ? error.message : "Couldn't open the latest version.",
      );
    } finally {
      setOpeningLatestVersion(false);
    }
  }

  // Close after OnlyOffice has finished its normal autosave synchronization.
  async function handleClose() {
    setClosing(true);
    setSubmitError(null);
    try {
      await onClose(hasChangesRef.current);
    } catch (error) {
      const saveConfirmationFailed = isSaveConfirmationError(error);
      if (saveConfirmationFailed) setShowSaveWarning(true);
      setSubmitError(saveConfirmationFailed
        ? null
        : error instanceof Error
          ? error.message
          : "Couldn't save your latest edits before closing.");
    } finally {
      setClosing(false);
    }
  }

  return (
    <div
      className={`fixed inset-0 z-50 grid bg-slate-200 text-slate-900 dark:bg-slate-950 dark:text-slate-100 ${
        theme === "dark" ? "dark" : ""
      }`}
      style={{
        gridTemplateColumns: workspaceSidebar
          ? capstoneProjectId
            ? "276px minmax(0, 1fr) 340px"
            : "276px minmax(0, 1fr)"
          : capstoneProjectId
            ? "minmax(0, 1fr) 340px"
            : "minmax(0, 1fr)",
        gridTemplateRows: "minmax(0, 1fr)",
      }}
    >
      {workspaceSidebar && (
        <aside className="flex min-h-0 min-w-0 flex-col border-r border-slate-200 bg-white text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200">
          <div className="flex min-h-14 items-center gap-2 border-b border-slate-200 px-3 dark:border-slate-700">
            <FileText className="h-5 w-5 shrink-0 text-sky-600" />
            <p className="min-w-0 flex-1 truncate text-sm font-semibold text-slate-800 dark:text-slate-100">
              {workspaceTitle}
            </p>
            {displayedDraftId && displayedBaseVersion !== undefined && (
              <span className="shrink-0 rounded-md bg-sky-50 px-1.5 py-1 text-[10px] font-semibold text-sky-700 dark:bg-sky-950 dark:text-sky-300">
                v{nextVersion}.0
              </span>
            )}
          </div>

          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-3">
            <section aria-labelledby="version-history-heading">
              <h2
                id="version-history-heading"
                className="mb-2 flex items-center gap-2 px-1 text-[11px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400"
              >
                <History className="h-3.5 w-3.5" />
                Version History
              </h2>
              {currentPhaseDeliverables.length > 3 && (
                <button
                  type="button"
                  aria-expanded={showAllVersions}
                  aria-controls="version-history-list"
                  onClick={() =>
                    setExpandedVersionPhase(showAllVersions ? null : currentPhase)
                  }
                  className="mb-2 flex w-full items-center justify-between rounded-md px-2 py-1.5 text-xs font-semibold text-sky-700 transition-colors hover:bg-sky-50 dark:text-sky-300 dark:hover:bg-slate-800"
                >
                  <span>
                    {showAllVersions
                      ? "Show latest 3"
                      : `See all ${currentPhaseDeliverables.length} versions`}
                  </span>
                  {showAllVersions ? (
                    <ChevronUp className="h-3.5 w-3.5" aria-hidden="true" />
                  ) : (
                    <ChevronDown className="h-3.5 w-3.5" aria-hidden="true" />
                  )}
                </button>
              )}
              {comparison && (
                <button
                  type="button"
                  onClick={() => {
                    setComparison(null);
                    setComparisonError(null);
                    setLoadError(null);
                  }}
                  className="mb-2 w-full rounded-md border border-sky-200 bg-sky-50 px-2.5 py-2 text-left text-xs font-semibold text-sky-700 hover:bg-sky-100 dark:border-sky-800 dark:bg-sky-950/50 dark:text-sky-300 dark:hover:bg-sky-950"
                >
                  Return to current editor
                </button>
              )}
              {comparisonError && (
                <p role="alert" className="mb-2 rounded-md bg-rose-50 px-2.5 py-2 text-xs text-rose-700 dark:bg-rose-950/40 dark:text-rose-300">
                  {comparisonError}
                </p>
              )}
              {comparing && (
                <p className="mb-2 flex items-center gap-2 px-1 text-xs text-sky-700 dark:text-sky-300" role="status">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Preparing comparison…
                </p>
              )}
              <div id="version-history-list" className="space-y-1.5">
                {currentPhaseDeliverables.length > 0 ? (
                  visibleVersions.map((item) => (
                    <button
                      type="button"
                      key={item._id}
                      onClick={() => void handleSelectVersion(item)}
                      disabled={
                        !onCompareVersion ||
                        !item.storageId ||
                        !isWordDocument(item.fileName) ||
                        !isWordDocument(fileName) ||
                        comparing ||
                        submitting ||
                        closing ||
                        switchingChapter !== null
                      }
                      title={
                        !isWordDocument(item.fileName) || !isWordDocument(fileName)
                          ? "ONLYOFFICE comparison is available for Word documents."
                          : "Compare this version with the current saved draft or latest version."
                      }
                      className={`block w-full rounded-md border px-2.5 py-2 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                        comparison?.selectedDeliverableId === item._id
                          ? "border-violet-300 bg-violet-50 dark:border-violet-800 dark:bg-violet-950/50"
                          : item.version === latestVersion
                            ? "border-sky-200 bg-sky-50 dark:border-sky-800 dark:bg-sky-950/40"
                            : "border-slate-200 bg-white hover:border-sky-200 hover:bg-sky-50 dark:border-slate-700 dark:bg-slate-800 dark:hover:border-sky-800 dark:hover:bg-slate-700"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-semibold text-sky-700 dark:text-sky-300">
                          v{item.version}.0
                          {item.versionLabel ? ` · ${item.versionLabel}` : ""}
                        </span>
                        <time className="shrink-0 text-[10px] text-slate-400 dark:text-slate-500">
                          {new Date(item.uploadedAt).toLocaleDateString(undefined, {
                            month: "short",
                            day: "numeric",
                          })}
                        </time>
                      </div>
                      <p className="mt-1 truncate text-[11px] text-slate-500 dark:text-slate-400">
                        {item.message || item.fileName}
                      </p>
                      <p className="mt-1 text-[10px] text-slate-400 dark:text-slate-500">
                        {comparison?.selectedDeliverableId === item._id
                          ? "Currently comparing"
                          : "Select to compare"}
                      </p>
                    </button>
                  ))
                ) : (
                  <p className="rounded-md border border-dashed border-slate-200 px-2.5 py-3 text-xs text-slate-400 dark:border-slate-700 dark:text-slate-500">
                    No submitted versions yet.
                  </p>
                )}
              </div>
            </section>

            {canSubmit && (
              <section
                aria-labelledby="save-version-heading"
                className="rounded-lg border border-slate-200 bg-slate-50 p-2.5 dark:border-slate-700 dark:bg-slate-800"
              >
                <div className="mb-2 flex items-center justify-between gap-2">
                  <h2 id="save-version-heading" className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                    Save New Snapshot
                  </h2>
                  <span className="rounded border border-sky-200 bg-sky-100 px-1.5 py-0.5 text-[10px] font-semibold text-sky-700 dark:border-sky-800 dark:bg-sky-950 dark:text-sky-300">
                    v{nextVersion}.0
                  </span>
                </div>
                {submitError && (
                  <p role="alert" className="mb-2 text-xs text-rose-600">
                    {submitError}
                  </p>
                )}
                <button
                  type="button"
                  onClick={() => setShowSubmitReminder(true)}
                  disabled={submitting || closing || switchingChapter !== null || loading || !!loadError}
                  className="flex min-h-9 w-full appearance-none items-center justify-center rounded-md bg-sky-400 px-3 py-2 text-xs font-semibold text-white shadow-sm hover:bg-sky-500 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Save className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
                  {submitting ? "Submitting…" : "Submit Version"}
                </button>
              </section>
            )}

            <section aria-labelledby="manuscript-chapters-heading">
              <h2
                id="manuscript-chapters-heading"
                className="mb-2 flex items-center gap-2 border-t border-slate-200 px-1 pt-3 text-[11px] font-bold uppercase tracking-wide text-slate-500 dark:border-slate-700 dark:text-slate-400"
              >
                <BookOpen className="h-3.5 w-3.5" />
                Manuscript Chapters
              </h2>
              <div className="space-y-1">
                {chapterNames.map((name, index) => {
                  const chapter = index + 1;
                  const chapterPhase = `Chapter ${chapter}`;
                  const latest = deliverables
                    .filter((item) => item.phase === chapterPhase)
                    .reduce<WorkspaceDeliverable | null>(
                      (found, item) => (!found || item.version > found.version ? item : found),
                      null,
                    );
                  const isCurrent = currentChapterNumber === chapter;
                  const canOpenChapter =
                    !workspaceReadOnly &&
                    !!latest?.storageId &&
                    isOnlyOfficeEditable(latest.fileName);

                  return (
                    <button
                      type="button"
                      key={chapterPhase}
                      aria-current={isCurrent ? "page" : undefined}
                      disabled={!canOpenChapter || switchingChapter !== null || submitting || closing}
                      onClick={() => void handleSelectChapter(chapterPhase)}
                      title={
                        workspaceReadOnly
                          ? "Archived projects are read-only."
                          : canOpenChapter
                          ? `Open ${chapterPhase}`
                          : latest
                            ? "This file type cannot be opened in OnlyOffice."
                            : "No submission yet"
                      }
                      className={`block w-full rounded-md border px-2.5 py-2 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
                        isCurrent
                          ? "border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-800 dark:bg-sky-950/50 dark:text-sky-300"
                          : canOpenChapter
                            ? "border-transparent text-slate-600 hover:border-slate-200 hover:bg-slate-50 dark:text-slate-300 dark:hover:border-slate-700 dark:hover:bg-slate-800"
                            : "border-transparent text-slate-400 dark:text-slate-600"
                      }`}
                    >
                      <div className="flex items-center gap-2 text-xs font-medium">
                        <FileText className="h-3.5 w-3.5 shrink-0 text-slate-400 dark:text-slate-500" />
                        <span className="min-w-0 flex-1 truncate">{name}</span>
                        {switchingChapter === chapterPhase && (
                          <span className="shrink-0 text-[10px] text-sky-600">Opening…</span>
                        )}
                      </div>
                      <p className="mt-1 truncate pl-5 text-[10px] text-slate-400 dark:text-slate-500">
                        {latest?.fileName ?? "No submission yet"}
                      </p>
                    </button>
                  );
                })}
              </div>
            </section>
          </div>

          <div className="border-t border-slate-200 bg-white p-2 dark:border-slate-700 dark:bg-slate-900">
            {submitError && !canSubmit && (
              <p role="alert" className="mb-2 px-1 text-xs text-rose-600">
                {submitError}
              </p>
            )}
            <button
              type="button"
              onClick={handleClose}
              disabled={submitting || closing || switchingChapter !== null}
              className="flex w-full items-center justify-center gap-2 rounded-md border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
            >
              <Power className="h-3.5 w-3.5" />
              {closing ? (mode === "comment" ? "Closing…" : "Saving…") : mode === "comment" ? "Close Editor" : "Close Workspace"}
            </button>
          </div>
        </aside>
      )}

      <div className="flex min-h-0 min-w-0 flex-col bg-[#17232b]">
        {!workspaceSidebar && (
          <div className="flex items-center justify-between gap-3 bg-[#173f4a] px-4 py-3 text-white">
            <div className="flex min-w-0 items-center gap-3">
              <p className="truncate text-sm font-bold">{displayedFileName}</p>
              {displayedDraftId && displayedBaseVersion !== undefined && (
                <span className="shrink-0 rounded-full bg-white/15 px-2.5 py-0.5 text-xs">
                  Draft based on v{displayedBaseVersion}
                </span>
              )}
            </div>
            <div className="flex shrink-0 items-center gap-2">
              {submitError && <span className="text-xs text-amber-300">{submitError}</span>}
              {canSubmit && (
                <button
                  type="button"
                  onClick={() => setShowSubmitReminder(true)}
                  disabled={submitting || closing || loading || !!loadError}
                  className="rounded-lg bg-blue-600 px-4 py-1.5 text-sm font-semibold text-white hover:bg-blue-500 disabled:opacity-50"
                >
                  {submitting ? "Submitting…" : `Submit as v${nextVersion}`}
                </button>
              )}
              <button
                type="button"
                onClick={handleClose}
                disabled={submitting || closing}
                className="rounded-lg px-3 py-1.5 text-sm text-[#d8f1ed] hover:bg-white/10 disabled:opacity-50"
              >
                {closing ? (mode === "comment" ? "Closing…" : "Saving…") : mode === "comment" ? "Close Editor" : "Close"}
              </button>
            </div>
          </div>
        )}
        {latestVersionAvailable !== undefined && onOpenLatestVersion && (
          <div
            className="flex items-center justify-between gap-3 border-b border-amber-200 bg-amber-50 px-4 py-2 text-xs text-amber-950"
            role="status"
          >
            <span>A newer submitted version is available.</span>
            <button
              type="button"
              onClick={() => void handleOpenLatestVersion()}
              disabled={openingLatestVersion || submitting || closing || switchingChapter !== null}
              className="shrink-0 rounded-md bg-amber-700 px-3 py-1.5 font-semibold text-white hover:bg-amber-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {openingLatestVersion ? "Opening…" : `Open latest (v${latestVersionAvailable})`}
            </button>
          </div>
        )}
        {comparison && !workspaceSidebar && (
          <div className="flex items-center justify-between gap-3 bg-violet-950 px-4 py-2 text-xs text-white">
            <span>
              Comparing v{comparison.selectedVersion} with{" "}
              {comparison.comparisonIsDraft
                ? `the current draft (based on v${comparison.comparisonVersion})`
                : `v${comparison.comparisonVersion}`}
            </span>
            <button
              type="button"
              onClick={() => {
                setComparison(null);
                setComparisonError(null);
                setLoadError(null);
              }}
              className="rounded border border-white/30 px-2.5 py-1 font-medium hover:bg-white/10"
            >
              Return to editor
            </button>
          </div>
        )}
        <div className="relative min-h-0 min-w-0 flex-1">
          <div
            id={elementIds[0]}
            className="absolute inset-0"
            style={{
              opacity: activeEditorSlot === 0 || activeEditorSlot === null ? 1 : 0,
              pointerEvents:
                activeEditorSlot === 0 || activeEditorSlot === null ? "auto" : "none",
              zIndex: activeEditorSlot === 0 || activeEditorSlot === null ? 1 : 0,
            }}
          />
          <div
            id={elementIds[1]}
            className="absolute inset-0"
            style={{
              opacity: activeEditorSlot === 1 ? 1 : 0,
              pointerEvents: activeEditorSlot === 1 ? "auto" : "none",
              zIndex: activeEditorSlot === 1 ? 1 : 0,
            }}
          />
          {loading && (
            <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-slate-950/55 px-6 text-center text-sm text-white">
              <Loader2 className="h-6 w-6 animate-spin text-sky-300" />
              <span>
                {comparison
                  ? `Loading comparison with v${comparison.selectedVersion}…`
                  : activeEditorRef.current
                    ? `Loading ${phase ?? "chapter"}…`
                    : "Loading editor…"}
              </span>
            </div>
          )}
          {loadError && (
            <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-3 bg-slate-950/70 px-6 text-center text-sm text-white">
              <p role="alert">{loadError}</p>
              <button
                type="button"
                onClick={() => {
                  setLoadError(null);
                  setRetryCount((count) => count + 1);
                }}
                className="inline-flex items-center gap-2 rounded-md bg-sky-600 px-3 py-2 text-xs font-semibold text-white hover:bg-sky-700"
              >
                <RotateCw className="h-3.5 w-3.5" />
                Retry loading
              </button>
            </div>
          )}
        </div>
      </div>
      {capstoneProjectId && currentPhase && (
        <WorkspaceChat capstoneProjectId={capstoneProjectId} phase={currentPhase} />
      )}
      {showSaveWarning && (
        <div className="fixed inset-0 z-100 flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-[2px]">
          <div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="save-warning-title"
            aria-describedby="save-warning-description"
            className="w-full max-w-lg overflow-hidden rounded-2xl bg-white text-slate-900 shadow-[0_24px_80px_rgba(15,23,42,0.3)] ring-1 ring-black/5"
          >
            <div className="h-1.5 bg-red-400" />
            <div className="p-6 sm:p-7">
              <div className="flex items-start gap-4">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-red-50 text-red-700 ring-1 ring-red-200">
                  <CircleAlert className="h-6 w-6" aria-hidden="true" />
                </span>
                <div className="min-w-0 flex-1 pt-0.5">
                  <h2 id="save-warning-title" className="text-xl font-semibold tracking-tight">
                    We couldn’t confirm your save
                  </h2>
                  <p
                    id="save-warning-description"
                    className="mt-2 text-sm leading-6 text-slate-600 sm:text-base"
                  >
                    Your latest edits may not be saved yet. Keep the document open and try again.
                  </p>
                </div>
              </div>
              <div className="mt-6 flex items-center gap-3 rounded-xl bg-slate-50 px-4 py-3.5">
                <span className="shrink-0 text-sm text-slate-600">Try saving with</span>
                <span className="inline-flex items-center gap-1.5" aria-label="Control plus S">
                  <kbd className="rounded-md border border-slate-300 bg-white px-2 py-1 font-sans text-xs font-semibold text-slate-700 shadow-sm">
                    Ctrl
                  </kbd>
                  <span className="text-xs text-slate-400">+</span>
                  <kbd className="rounded-md border border-slate-300 bg-white px-2 py-1 font-sans text-xs font-semibold text-slate-700 shadow-sm">
                    S
                  </kbd>
                </span>
                <span className="min-w-0 text-sm leading-5 text-slate-600">
                  then wait for OnlyOffice to finish saving.
                </span>
              </div>
              <div className="mt-6 flex justify-end border-t border-slate-100 pt-5">
                <button
                  type="button"
                  autoFocus
                  onClick={() => setShowSaveWarning(false)}
                  className="min-h-10 rounded-lg bg-slate-900 px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-600 focus-visible:ring-offset-2"
                >
                  Got it
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {showSubmitReminder && (
        <div className="fixed inset-0 z-20 flex items-center justify-center bg-black/50 px-4">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="submit-reminder-title"
            className="w-full max-w-md rounded-xl bg-white p-6 text-slate-900 shadow-xl"
          >
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-100 text-blue-600">
                <Save className="h-5 w-5" aria-hidden="true" />
              </div>
              <div>
                <h2 id="submit-reminder-title" className="text-lg font-semibold">
                  Save before submitting
                </h2>
                <p className="mt-1 text-sm text-slate-600">
                  Make sure your latest edits are saved first.
                </p>
              </div>
            </div>
            <p className="mt-2 text-sm text-slate-600">
              Press{" "}
              <span className="inline-flex items-center gap-1 rounded-md border border-slate-300 bg-slate-100 px-2 py-1 font-semibold text-slate-800">
                <Keyboard className="h-3.5 w-3.5" aria-hidden="true" />
                Ctrl+S
              </span>{" "}
              in OnlyOffice, then click Continue to submit this manuscript as a new version.
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowSubmitReminder(false)}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSubmit}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500"
              >
                Continue to submit
              </button>
            </div>
          </div>
        </div>
      )}
      {showCompareReminder && versionAwaitingCompare && (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-slate-950/65 px-4 py-8">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="compare-reminder-title"
            className="w-full max-w-xl rounded-2xl bg-white p-8 text-slate-900 shadow-2xl"
          >
            <div className="flex items-start gap-4">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-sky-100 text-sky-700">
                <Save className="h-7 w-7" aria-hidden="true" />
              </div>
              <div>
                <h2 id="compare-reminder-title" className="text-2xl font-semibold">
                  Save your draft before comparing
                </h2>
                <p className="mt-2 text-base leading-relaxed text-slate-600">
                  Press Ctrl+S in OnlyOffice to save your latest edits, then continue. We’ll confirm the draft is updated before opening the comparison.
                </p>
              </div>
            </div>
            <p className="mt-5 rounded-lg bg-amber-50 px-4 py-3 text-sm leading-relaxed text-amber-900">
              If the draft cannot be confirmed as saved, the comparison will not open. This does not submit a new version.
            </p>
            <div className="mt-7 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => {
                  setShowCompareReminder(false);
                  setVersionAwaitingCompare(null);
                  setDraftStorageIdAtSelection(null);
                }}
                className="min-h-11 rounded-lg border border-slate-300 px-5 py-2.5 text-sm font-medium hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  const selected = versionAwaitingCompare;
                  setShowCompareReminder(false);
                  setVersionAwaitingCompare(null);
                  if (selected) {
                    const shouldForceSave =
                      hasPendingChangesRef.current || hasChangesRef.current;
                    void openVersionComparison(
                      selected,
                      shouldForceSave,
                      draftStorageIdAtSelection,
                    );
                  }
                  setDraftStorageIdAtSelection(null);
                }}
                disabled={comparing || capturingDraftBaseline}
                className="min-h-11 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-500 disabled:opacity-50"
              >
                {capturingDraftBaseline ? "Checking draft…" : "Continue to compare"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}