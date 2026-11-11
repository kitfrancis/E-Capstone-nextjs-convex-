"use client";

import { useEffect, useRef, useState } from "react";
import {
  BookOpen,
  FileText,
  History,
  Keyboard,
  Power,
  Save,
} from "lucide-react";

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

type OnlyOfficeEditorProps = {
  fileId: string;
  deliverableId: string;
  fileName: string;
  fileUrl: string;
  phase?: string;
  deliverables?: WorkspaceDeliverable[];
  workspaceSidebar?: boolean;
  workspaceReadOnly?: boolean;
  mode?: "edit" | "review" | "comment" | "view";
  userId?: string;
  userName?: string;
  onSelectChapter?: (phase: string, hasChanges: boolean) => Promise<void>;
  onClose: (hasChanges: boolean) => void | Promise<void>;
  // NEW: draft editing
  docKey?: string;                 // unique per editor session (falls back to fileId)
  draftId?: string;                // tells the callback to save into the draft, not a version
  baseVersion?: number;            // shows "Draft based on v1" and labels the button "Submit as v2"
  onSubmit?: (hasChanges: boolean) => Promise<void>;
};

type DocsApi = {
  DocEditor: new (elementId: string, config: Record<string, unknown>) => {
    destroyEditor: () => void;
  };
};

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
  deliverables = [],
  workspaceSidebar = false,
  workspaceReadOnly = false,
  mode = "view",
  userId,
  userName,
  onSelectChapter,
  onClose,
  docKey,
  draftId,
  baseVersion,
  onSubmit,
}: OnlyOfficeEditorProps) {
  const editorRef = useRef<{ destroyEditor: () => void } | null>(null);
  const hasPendingChangesRef = useRef(false);
  const hasChangesRef = useRef(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [closing, setClosing] = useState(false); // NEW
  const [showSubmitReminder, setShowSubmitReminder] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [switchingChapter, setSwitchingChapter] = useState<string | null>(null);
  const elementId = "onlyoffice-editor";
  const serverUrl = process.env.NEXT_PUBLIC_ONLYOFFICE_URL || "http://localhost:8080";
  const callbackUrl =
    process.env.NEXT_PUBLIC_ONLYOFFICE_CALLBACK_URL?.trim() ||
    (typeof window === "undefined"
      ? ""
      : `${window.location.origin}/api/onlyoffice/callback`);

  const editorMode = workspaceReadOnly ? "view" : mode;
  const canSubmit = editorMode === "edit" && !!onSubmit;
  const chapterNames = [
    "Chapter 1: Introduction",
    "Chapter 2: Literature Review",
    "Chapter 3: Methodology",
    "Chapter 4: Results & Discussion",
    "Chapter 5: Conclusion",
  ];
  const currentPhase = phase ?? "";
  const chapterMatch = currentPhase.match(/chapter\s*(\d+)/i);
  const currentChapterNumber = chapterMatch ? Number(chapterMatch[1]) : null;
  const currentPhaseDeliverables = deliverables
    .filter((deliverable) => deliverable.phase === currentPhase)
    .sort((a, b) => b.version - a.version);
  const latestVersion = currentPhaseDeliverables[0]?.version ?? baseVersion ?? 1;
  const nextVersion = Math.max(latestVersion, baseVersion ?? 0) + 1;
  const workspaceTitle = currentPhase || fileName;

  useEffect(() => {
    hasPendingChangesRef.current = false;
    hasChangesRef.current = false;
  }, [fileId, draftId, fileName, phase]);

  useEffect(() => {
    if (switchingChapter === phase) setSwitchingChapter(null);
  }, [phase, switchingChapter]);

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
      setSwitchingChapter(null);
      setSubmitError(
        error instanceof Error ? error.message : "Couldn't open that chapter.",
      );
    }
  }

  useEffect(() => {
    let cancelled = false;
    setLoadError(null);
    setLoading(true);

    async function createEditor() {
      try {
        await loadOnlyOfficeApi(serverUrl);
      } catch (error) {
        if (!cancelled) {
          setLoading(false);
          setLoadError(
            error instanceof Error
              ? error.message
              : `OnlyOffice could not be reached at ${serverUrl}.`,
          );
        }
        return;
      }

      if (cancelled || !window.DocsAPI) return;

      // NEW: draftId is added so the callback knows to write to the draft
      const query =
        `fileId=${encodeURIComponent(deliverableId)}` +
        (draftId ? `&draftId=${encodeURIComponent(draftId)}` : "") +
        (editorMode === "comment" ? "&notify=1" : "");
      const documentKey = docKey ?? fileId;
        
      document.getElementById(elementId)?.replaceChildren();
      editorRef.current = new window.DocsAPI.DocEditor(elementId, {
        document: {
          fileType: fileName.split(".").pop()?.toLowerCase() || "docx",
          key: documentKey,
          permissions: {
            comment: editorMode !== "view",
            edit: editorMode === "edit",
            review: editorMode === "review",
            fillForms: editorMode === "edit",
            print: true,
          },
          title: fileName,
          url: fileUrl,
        },
        documentType: getDocumentType(fileName),
        editorConfig: {
          callbackUrl: `${callbackUrl}?${query}`,
          coEditing: {
            mode: "fast",
            change: true,
          },
          customization: { autosave: true, forcesave: true },
          mode: editorMode === "view" ? "view" : "edit",
          user: userId ? { id: userId, name: userName ?? "User" } : undefined,
        },
        events: {
          onAppReady: () => {
            if (!cancelled) setLoading(false);
          },
          onDocumentStateChange: (event: { data?: boolean }) => {
            if (typeof event.data !== "boolean") return;
            hasPendingChangesRef.current = event.data;
            if (event.data) hasChangesRef.current = true;
          },
          onError: (event: { data?: { errorDescription?: string } }) => {
            console.error("OnlyOffice error:", event?.data);
            if (!cancelled) {
              setLoading(false);
              setLoadError(
                event?.data?.errorDescription
                  ? `OnlyOffice error: ${event.data.errorDescription}`
                  : "OnlyOffice reported an error. Open the browser console for details.",
              );
            }
          },
        },
        height: "100%",
        type: "desktop",
        width: "100%",
      });
    }

    void createEditor();

    return () => {
      cancelled = true;
      editorRef.current?.destroyEditor();
      editorRef.current = null;
      document.getElementById(elementId)?.replaceChildren();
    };
  }, [callbackUrl, editorMode, userId, userName, deliverableId, fileId, fileName, fileUrl, serverUrl, docKey, draftId]);

  // NEW: Submit button handler
  async function handleSubmit() {
    if (!onSubmit) return;
    setShowSubmitReminder(false);
    setSubmitting(true);
    setSubmitError(null);
    try {
      await onSubmit(hasChangesRef.current);
      editorRef.current?.destroyEditor();
      editorRef.current = null;
    } catch (error) {
      setSubmitError(
        error instanceof Error ? error.message : "Submit failed. Your draft is still saved.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  // Close after OnlyOffice has finished its normal autosave synchronization.
  async function handleClose() {
    setClosing(true);
    setSubmitError(null);
    try {
      await onClose(hasChangesRef.current);
    } catch (error) {
      setSubmitError(
        error instanceof Error ? error.message : "Couldn't save your latest edits before closing.",
      );
    } finally {
      setClosing(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 grid bg-slate-200"
      style={{
        gridTemplateColumns: workspaceSidebar ? "276px minmax(0, 1fr)" : "minmax(0, 1fr)",
        gridTemplateRows: "minmax(0, 1fr)",
      }}
    >
      {workspaceSidebar && (
        <aside className="flex min-h-0 min-w-0 flex-col border-r border-slate-200 bg-white text-slate-700">
          <div className="flex min-h-14 items-center gap-3 border-b border-slate-200 px-4">
            <FileText className="h-5 w-5 shrink-0 text-sky-600" />
            <p className="min-w-0 flex-1 truncate text-sm font-semibold text-slate-800">
              {workspaceTitle}
            </p>
            {draftId && baseVersion !== undefined && (
              <span className="shrink-0 rounded-md bg-sky-50 px-1.5 py-1 text-[10px] font-semibold text-sky-700">
                v{nextVersion}.0
              </span>
            )}
          </div>

          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-3">
            <section aria-labelledby="version-history-heading">
              <h2
                id="version-history-heading"
                className="mb-2 flex items-center gap-2 px-1 text-[11px] font-bold uppercase tracking-wide text-slate-500"
              >
                <History className="h-3.5 w-3.5" />
                Version History
              </h2>
              <div className="space-y-1.5">
                {currentPhaseDeliverables.length > 0 ? (
                  currentPhaseDeliverables.map((item) => (
                    <div
                      key={item._id}
                      className={`rounded-md border px-2.5 py-2 ${
                        item.version === latestVersion
                          ? "border-sky-200 bg-sky-50"
                          : "border-slate-200 bg-white"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-semibold text-sky-700">
                          v{item.version}.0
                          {item.versionLabel ? ` · ${item.versionLabel}` : ""}
                        </span>
                        <time className="shrink-0 text-[10px] text-slate-400">
                          {new Date(item.uploadedAt).toLocaleDateString(undefined, {
                            month: "short",
                            day: "numeric",
                          })}
                        </time>
                      </div>
                      <p className="mt-1 truncate text-[11px] text-slate-500">
                        {item.message || item.fileName}
                      </p>
                    </div>
                  ))
                ) : (
                  <p className="rounded-md border border-dashed border-slate-200 px-2.5 py-3 text-xs text-slate-400">
                    No submitted versions yet.
                  </p>
                )}
              </div>
            </section>

            {canSubmit && (
              <section
                aria-labelledby="save-version-heading"
                className="rounded-lg border border-slate-200 bg-slate-50 p-2.5"
              >
                <div className="mb-2 flex items-center justify-between gap-2">
                  <h2 id="save-version-heading" className="text-xs font-semibold text-slate-700">
                    Save New Snapshot
                  </h2>
                  <span className="rounded border border-sky-200 bg-sky-100 px-1.5 py-0.5 text-[10px] font-semibold text-sky-700">
                    v{nextVersion}.0
                  </span>
                </div>
                <textarea
                  aria-label="Describe changes made"
                  placeholder="Describe changes made..."
                  className="mb-2 block min-h-16 w-full resize-none rounded-md border border-slate-200 bg-white p-2 text-xs text-slate-700 outline-none placeholder:text-slate-400 focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
                />
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
                className="mb-2 flex items-center gap-2 border-t border-slate-200 px-1 pt-3 text-[11px] font-bold uppercase tracking-wide text-slate-500"
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
                          ? "border-sky-200 bg-sky-50 text-sky-700"
                          : canOpenChapter
                            ? "border-transparent text-slate-600 hover:border-slate-200 hover:bg-slate-50"
                            : "border-transparent text-slate-400"
                      }`}
                    >
                      <div className="flex items-center gap-2 text-xs font-medium">
                        <FileText className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                        <span className="min-w-0 flex-1 truncate">{name}</span>
                        {switchingChapter === chapterPhase && (
                          <span className="shrink-0 text-[10px] text-sky-600">Opening…</span>
                        )}
                      </div>
                      <p className="mt-1 truncate pl-5 text-[10px] text-slate-400">
                        {latest?.fileName ?? "No submission yet"}
                      </p>
                    </button>
                  );
                })}
              </div>
            </section>
          </div>

          <div className="border-t border-slate-200 bg-white p-2">
            {submitError && !canSubmit && (
              <p role="alert" className="mb-2 px-1 text-xs text-rose-600">
                {submitError}
              </p>
            )}
            <button
              type="button"
              onClick={handleClose}
              disabled={submitting || closing || switchingChapter !== null}
              className="flex w-full items-center justify-center gap-2 rounded-md border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Power className="h-3.5 w-3.5" />
              {closing ? "Saving…" : "Close Workspace"}
            </button>
          </div>
        </aside>
      )}

      <div className="flex min-h-0 min-w-0 flex-col bg-[#17232b]">
        {!workspaceSidebar && (
          <div className="flex items-center justify-between gap-3 bg-[#173f4a] px-4 py-3 text-white">
            <div className="flex min-w-0 items-center gap-3">
              <p className="truncate text-sm font-bold">{fileName}</p>
              {draftId && baseVersion !== undefined && (
                <span className="shrink-0 rounded-full bg-white/15 px-2.5 py-0.5 text-xs">
                  Draft based on v{baseVersion}
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
                {closing ? "Saving…" : "Close"}
              </button>
            </div>
          </div>
        )}
        {loadError ? (
          <div className="flex flex-1 items-center justify-center px-6 text-center text-sm text-white">
            {loadError}
          </div>
        ) : (
          <div className="relative min-h-0 min-w-0 flex-1">
            {loading && (
              <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center text-sm text-white/70">
                Loading editor...
              </div>
            )}
            <div id={elementId} className="absolute inset-0" />
          </div>
        )}
      </div>
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
    </div>
  );
}