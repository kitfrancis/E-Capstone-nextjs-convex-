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
  onClose: () => void;
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
}: OnlyOfficeEditorProps) {
  const editorRef = useRef<{ destroyEditor: () => void } | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const elementId = "onlyoffice-editor";
  const serverUrl = process.env.NEXT_PUBLIC_ONLYOFFICE_URL || "http://localhost:8080";
  const callbackUrl =
    process.env.NEXT_PUBLIC_ONLYOFFICE_CALLBACK_URL ||
    (typeof window === "undefined"
      ? ""
      : `${window.location.origin}/api/onlyoffice/callback`);

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

      document.getElementById(elementId)?.replaceChildren();
      editorRef.current = new window.DocsAPI.DocEditor(elementId, {
        document: {
          fileType: fileName.split(".").pop()?.toLowerCase() || "docx",
          key: fileId,
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
          callbackUrl: `${callbackUrl}?fileId=${encodeURIComponent(deliverableId)}`,
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
  }, [callbackUrl, mode, userId, userName, deliverableId, fileId, fileName, fileUrl, serverUrl]);

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-[#17232b]">
      <div className="flex items-center justify-between bg-[#173f4a] px-4 py-3 text-white">
        <p className="truncate text-sm font-bold">{fileName}</p>
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg px-3 py-1.5 text-sm text-[#d8f1ed] hover:bg-white/10"
        >
          Close
        </button>
      </div>
      {loadError ? (
        <div className="flex flex-1 items-center justify-center px-6 text-center text-sm text-white">
          {loadError}
        </div>
      ) : (
        <div className="relative min-h-0 flex-1">
          {loading && (
            <div className="absolute inset-0 z-10 flex items-center justify-center text-sm text-white/70 pointer-events-none">
              Loading editor...
            </div>
          )}
          <div id={elementId} className="h-full w-full" />
        </div>
      )}
    </div>
  );
}