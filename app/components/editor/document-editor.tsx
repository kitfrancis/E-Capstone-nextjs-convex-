"use client";

import { useEffect, useRef, useState } from "react";

type OnlyOfficeEditorProps = {
  fileId: string;
  deliverableId: string;
  fileName: string;
  fileUrl: string;
  mode?: "edit" | "review" | "comment" | "view";
  userId?: string;
  userName?: string;
  onClose: () => void | Promise<void>; // CHANGED: can be async so Close can wait for the save
  // NEW: draft editing
  docKey?: string;                 // unique per editor session (falls back to fileId)
  draftId?: string;                // tells the callback to save into the draft, not a version
  baseVersion?: number;
  onSubmit?: () => Promise<void>;  // parent calls POST /submit; throws on failure
  versionMessage?: string;
  onVersionMessageChange?: (message: string) => void;
  versionLabel?: string;
  onVersionLabelChange?: (version: string) => void;
  versions?: Array<{
    id: string;
    version: number;
    versionLabel?: string;
    message?: string;
    uploadedAt: string;
  }>;
  selectedVersionId?: string;
  onVersionSelect?: (versionId: string) => void;
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
  mode = "view",
  userId,
  userName,
  onClose,
  docKey,
  draftId,
  baseVersion,
  onSubmit,
  versionMessage = "",
  onVersionMessageChange,
  versionLabel = "",
  onVersionLabelChange,
  versions = [],
  selectedVersionId = "",
  onVersionSelect,
}: OnlyOfficeEditorProps) {
  const editorRef = useRef<{ destroyEditor: () => void } | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [closing, setClosing] = useState(false); // NEW
  const [submitError, setSubmitError] = useState<string | null>(null);
  const elementId = "onlyoffice-editor";
  const serverUrl = process.env.NEXT_PUBLIC_ONLYOFFICE_URL || "http://localhost:8080";
  const callbackUrl =
    process.env.NEXT_PUBLIC_ONLYOFFICE_CALLBACK_URL ||
    (typeof window === "undefined"
      ? ""
      : `${window.location.origin}/api/onlyoffice/callback`);

  const canSubmit = mode === "edit" && !!onSubmit;

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
        (mode === "comment" ? "&notify=1" : "");
      // Every browser editing the same draft must use the same key so
      // OnlyOffice places them in the same collaborative editing session.
      const documentKey = draftId ?? docKey ?? fileId;
        
      document.getElementById(elementId)?.replaceChildren();
      editorRef.current = new window.DocsAPI.DocEditor(elementId, {
        document: {
          fileType: fileName.split(".").pop()?.toLowerCase() || "docx",
          key: documentKey,
          permissions: {
            comment: mode !== "view",
            edit: mode === "edit",
            review: mode === "review",
            fillForms: mode === "edit",
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
          mode: mode === "view" ? "view" : "edit",
          user: userId ? { id: userId, name: userName ?? "User" } : undefined,
        },
        events: {
          onAppReady: () => {
            if (!cancelled) setLoading(false);
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
  }, [callbackUrl, mode, userId, userName, deliverableId, fileId, fileName, fileUrl, serverUrl, docKey, draftId]);

  // NEW: Submit button handler
  async function handleSubmit() {
    if (!onSubmit) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      await onSubmit(); // server forcesaves, then creates the new version
      editorRef.current?.destroyEditor();
      editorRef.current = null;
      onClose();
    } catch (error) {
      setSubmitError(
        error instanceof Error ? error.message : "Submit failed. Your draft is still saved.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  // NEW: Close waits for the parent to save the draft before closing
  async function handleClose() {
    setClosing(true);
    try {
      await onClose();
    } finally {
      setClosing(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-[#17232b]">
      <div className="flex min-h-0 flex-1">
        <aside
          className="flex shrink-0 flex-col overflow-y-auto border-r border-slate-200 bg-white"
          style={{ width: "18rem", minWidth: "18rem", flex: "0 0 18rem", color: "#0f172a" }}
        >
          <div className="border-b border-slate-200 px-4 py-3">
            <p className="truncate text-sm font-bold" style={{ color: "#0f172a" }}>{fileName}</p>
            {draftId && baseVersion !== undefined && (
              <span className="mt-2 inline-block rounded-full bg-slate-100 px-2.5 py-0.5 text-xs" style={{ color: "#475569" }}>
                Draft based on v{baseVersion}
              </span>
            )}
          </div>
          <div className="p-3">
            <h2 className="text-sm font-semibold" style={{ color: "#0f172a" }}>Version control</h2>
            <p className="mt-1 text-xs" style={{ color: "#475569" }}>Document history</p>
            {submitError && <p className="mt-3 text-xs" style={{ color: "#b45309" }}>{submitError}</p>}
            {canSubmit && (
              <button
                type="button"
                onClick={handleSubmit}
                disabled={submitting || closing || loading || !!loadError}
                className="mb-4 w-full rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500 disabled:opacity-50"
              >
                {submitting ? "Submitting…" : "Submit"}
              </button>
            )}
            {mode === "edit" && onSubmit && (
              <label className="mb-4 block">
                <span className="text-xs font-medium" style={{ color: "#334155" }}>
                  Message for this version
                </span>
                <input
                  value={versionMessage}
                  onChange={(event) => onVersionMessageChange?.(event.target.value)}
                  placeholder="Describe your changes"
                  className="mt-1 w-full rounded-md border border-slate-300 bg-white px-2.5 py-2 text-xs outline-none placeholder:text-slate-500 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                  style={{ color: "#0f172a" }}
                />
                <span className="mt-3 block text-xs font-medium" style={{ color: "#334155" }}>
                  Version
                </span>
                <input
                  value={versionLabel}
                  onChange={(event) => onVersionLabelChange?.(event.target.value)}
                  placeholder="v1.1"
                  pattern="v?[1-5]\.[0-9]+"
                  className="mt-1 w-full rounded-md border border-slate-300 bg-white px-2.5 py-2 text-xs outline-none placeholder:text-slate-500 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                  style={{ color: "#0f172a" }}
                />
              </label>
            )}
            <div className="space-y-2">
              {versions.length === 0 ? (
                <p className="text-xs" style={{ color: "#475569" }}>No submitted versions yet.</p>
              ) : (
                versions.map((version) => (
                  <button
                    key={version.id}
                    type="button"
                    onClick={() => onVersionSelect?.(version.id)}
                    className={`w-full rounded-lg border px-3 py-2 text-left transition ${
                      selectedVersionId === version.id
                        ? "border-blue-300 bg-blue-50"
                        : "border-slate-200 bg-white hover:border-blue-200 hover:bg-slate-50"
                    }`}
                  >
                    <span className="block text-xs font-semibold" style={{ color: "#0f172a" }}>
                      {version.versionLabel || `v${version.version}`}
                    </span>
                    <span className="mt-1 block truncate text-xs" style={{ color: "#475569" }}>
                      {version.message || "No message"}
                    </span>
                    <span className="mt-1 block text-[11px]" style={{ color: "#64748b" }}>
                      {new Date(version.uploadedAt).toLocaleString()}
                    </span>
                  </button>
                ))
              )}
            </div>
          </div>
          <div className="mt-auto border-t border-slate-200 p-3">
            <button
              type="button"
              onClick={handleClose}
              disabled={submitting || closing}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              style={{ color: "#334155" }}
            >
              {closing ? "Saving…" : "Close"}
            </button>
          </div>
        </aside>

        {loadError ? (
          <div className="flex min-w-0 flex-1 items-center justify-center px-6 text-center text-sm text-white">
            {loadError}
          </div>
        ) : (
          <div className="relative min-w-0 flex-1">
            {loading && (
              <div className="absolute inset-0 z-10 flex items-center justify-center text-sm text-white/70 pointer-events-none">
                Loading editor...
              </div>
            )}
            <div id={elementId} className="h-full w-full" />
          </div>
        )}
      </div>
    </div>
  );
}