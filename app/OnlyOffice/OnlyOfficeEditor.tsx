"use client";

import { useEffect, useRef, useState } from "react";

type OnlyOfficeEditorProps = {
  fileId: string;
  fileName: string;
  fileUrl: string;
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
    const existingScript = document.querySelector<HTMLScriptElement>(
      'script[data-onlyoffice-api="true"]',
    );
    const script = existingScript ?? document.createElement("script");

    const handleLoad = () => resolve();
    const handleError = () => {
      onlyOfficeApiPromise = null;
      reject(new Error(`OnlyOffice could not be reached at ${serverUrl}.`));
    };

    script.addEventListener("load", handleLoad, { once: true });
    script.addEventListener("error", handleError, { once: true });

    if (!existingScript) {
      script.src = `${serverUrl}/web-apps/apps/api/documents/api.js`;
      script.dataset.onlyofficeApi = "true";
      document.body.appendChild(script);
    }
  });

  return onlyOfficeApiPromise;
}

export default function OnlyOfficeEditor({
  fileId,
  fileName,
  fileUrl,
  onClose,
}: OnlyOfficeEditorProps) {
  const editorRef = useRef<{ destroyEditor: () => void } | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const elementId = "onlyoffice-editor";
  const serverUrl = process.env.NEXT_PUBLIC_ONLYOFFICE_URL || "http://localhost:8080";
  const callbackUrl =
    process.env.NEXT_PUBLIC_ONLYOFFICE_CALLBACK_URL ||
    (typeof window === "undefined"
      ? ""
      : `${window.location.origin}/api/onlyoffice/callback`);

  useEffect(() => {
    let cancelled = false;

    async function createEditor() {
      try {
        await loadOnlyOfficeApi(serverUrl);
      } catch (error) {
        if (!cancelled) {
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
            comment: true,
            edit: true,
            fillForms: true,
            print: true,
          },
          title: fileName,
          url: fileUrl,
        },
        documentType: getDocumentType(fileName),
        editorConfig: {
          callbackUrl: `${callbackUrl}?fileId=${encodeURIComponent(fileId)}`,
          customization: { autosave: true, forcesave: true },
          mode: "edit",
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
  }, [callbackUrl, fileId, fileName, fileUrl, serverUrl]);

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
        <div id={elementId} className="min-h-0 flex-1" />
      )}
    </div>
  );
}
