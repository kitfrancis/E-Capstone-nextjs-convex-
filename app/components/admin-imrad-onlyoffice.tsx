"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { Check, LoaderCircle, X } from "lucide-react";
import { Button } from "@/components/ui/button";

type AdminDocsApi = {
  DocEditor: new (elementId: string, config: Record<string, unknown>) => {
    destroyEditor: () => void;
  };
};

declare global {
  interface Window {
    DocsAPI?: AdminDocsApi;
  }
}

let onlyOfficeApiPromise: Promise<void> | null = null;
const LOAD_TIMEOUT_MS = 15000;

function loadOnlyOfficeApi(serverUrl: string) {
  if (window.DocsAPI) return Promise.resolve();
  if (onlyOfficeApiPromise) return onlyOfficeApiPromise;

  onlyOfficeApiPromise = new Promise<void>((resolve, reject) => {
    const script = document.createElement("script");
    let finished = false;
    const timeout = window.setTimeout(() => {
      fail();
    }, LOAD_TIMEOUT_MS);

    const fail = () => {
      if (finished) return;
      finished = true;
      window.clearTimeout(timeout);
      script.remove();
      onlyOfficeApiPromise = null;
      reject(new Error(`OnlyOffice could not be reached at ${serverUrl}.`));
    };

    script.addEventListener("load", () => {
      if (finished) return;
      finished = true;
      window.clearTimeout(timeout);
      resolve();
    });
    script.addEventListener("error", fail);
    script.src = `${serverUrl}/web-apps/apps/api/documents/api.js`;
    script.dataset.onlyofficeApi = "true";
    document.body.appendChild(script);
  });

  return onlyOfficeApiPromise;
}

type AdminImradOnlyOfficeProps = {
  teamName: string;
  projectTitle: string;
  submissionId: Id<"imradSubmissions">;
  completedParts: number[];
  fileId: string | null;
  fileName: string | null;
  fileUrl: string | null;
  onClose: () => void;
};

export default function AdminImradOnlyOffice({
  teamName,
  projectTitle,
  submissionId,
  completedParts,
  fileId,
  fileName,
  fileUrl,
  onClose,
}: AdminImradOnlyOfficeProps) {
  const editorRef = useRef<{ destroyEditor: () => void } | null>(null);
  const creatingDocumentRef = useRef(false);
  const editorElementId = `admin-imrad-editor-${useId().replace(/:/g, "")}`;
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [partUpdateError, setPartUpdateError] = useState("");
  const [updatingPart, setUpdatingPart] = useState(false);
  const [localCompletedParts, setLocalCompletedParts] = useState(completedParts);
  const [workingDocument, setWorkingDocument] = useState<{
    storageId: Id<"_storage">;
    fileName: string;
    url: string;
  } | null>(null);
  const generateUploadUrl = useMutation(api.archive.generateUploadUrl);
  const saveWorkingDocument = useMutation(api.imrad.saveWorkingDocument);
  const completeWorkingDocumentPart = useMutation(
    api.imrad.completeWorkingDocumentPart
  );
  const serverUrl = (process.env.NEXT_PUBLIC_ONLYOFFICE_URL || "http://localhost:8080")
    .replace(/\/+$/, "");
  const effectiveFileId = fileId ?? workingDocument?.storageId ?? null;
  const effectiveFileName = fileName ?? workingDocument?.fileName ?? null;
  const effectiveFileUrl = fileUrl ?? workingDocument?.url ?? null;
  const partNames = ["Introduction", "Methodology", "Results", "Discussion"];
  const nextPartNumber = localCompletedParts.length + 1;
  const nextPartName = partNames[nextPartNumber - 1];

  useEffect(() => {
    setLocalCompletedParts(completedParts);
  }, [completedParts]);

  const markPartDone = async () => {
    if (!effectiveFileId || !nextPartName || updatingPart) return;
    setUpdatingPart(true);
    setPartUpdateError("");
    try {
      await completeWorkingDocumentPart({
        submissionId,
        partNumber: nextPartNumber as 1 | 2 | 3 | 4,
      });
      setLocalCompletedParts((current) =>
        current.includes(nextPartNumber) ? current : [...current, nextPartNumber]
      );
    } catch (updateError) {
      console.error("Failed to complete IMRAD part:", updateError);
      setPartUpdateError(
        updateError instanceof Error
          ? updateError.message
          : "Could not update IMRAD progress or notify the instructor."
      );
    } finally {
      setUpdatingPart(false);
    }
  };

  useEffect(() => {
    if (fileId && fileName && fileUrl) return;
    if (workingDocument || creatingDocumentRef.current) return;
    creatingDocumentRef.current = true;

    const createTeamCopy = async () => {
      try {
        const templateResponse = await fetch("/imrad/imrad-conversion-guide.pdf");
        if (!templateResponse.ok) {
          throw new Error("Could not load the IMRAD Conversion Guide template.");
        }
        const templateFile = await templateResponse.blob();
        if (templateFile.type !== "application/pdf") {
          throw new Error("The IMRAD Conversion Guide template is not a PDF.");
        }

        const uploadUrl = await generateUploadUrl();
        const response = await fetch(uploadUrl, {
          method: "POST",
          headers: { "Content-Type": "application/pdf" },
          body: templateFile,
        });
        if (!response.ok) throw new Error("Could not copy the IMRAD guide to Convex storage.");
        const result: unknown = await response.json();
        if (
          !result ||
          typeof result !== "object" ||
          !("storageId" in result) ||
          typeof result.storageId !== "string"
        ) {
          throw new Error("The IMRAD guide upload returned an invalid storage ID.");
        }
        const savedDocument = await saveWorkingDocument({
          submissionId,
          storageId: result.storageId as Id<"_storage">,
        });
        if (!savedDocument.url) {
          throw new Error("The team copy was saved, but its file URL is unavailable.");
        }
        setWorkingDocument({
          storageId: savedDocument.storageId,
          fileName: savedDocument.fileName,
          url: savedDocument.url,
        });
      } catch (draftError) {
        setLoading(false);
        setError(
          draftError instanceof Error
            ? draftError.message
            : "Could not create the team IMRAD guide copy."
        );
      }
    };

    void createTeamCopy();
  }, [
    fileId,
    fileName,
    fileUrl,
    generateUploadUrl,
    saveWorkingDocument,
    submissionId,
    workingDocument,
  ]);

  useEffect(() => {
    let cancelled = false;

    const createEditor = async () => {
      if (!effectiveFileId || !effectiveFileName || !effectiveFileUrl) {
        return;
      }

      try {
        setLoading(true);
        setError("");
        await loadOnlyOfficeApi(serverUrl);
        if (cancelled) return;
        if (!window.DocsAPI) {
          setLoading(false);
          setError("The OnlyOffice API loaded without creating its editor interface.");
          return;
        }

        const callbackBase =
          process.env.NEXT_PUBLIC_ONLYOFFICE_CALLBACK_URL ||
          `${window.location.origin}/api/onlyoffice/callback`;
        const callbackUrl = new URL(callbackBase);
        callbackUrl.searchParams.set("adminImrad", "1");

        editorRef.current = new window.DocsAPI.DocEditor(editorElementId, {
          document: {
            fileType: "pdf",
            key: `admin-imrad-${effectiveFileId}`,
            permissions: {
              edit: true,
              comment: false,
              review: false,
              fillForms: true,
              print: true,
            },
            title: effectiveFileName,
            url: effectiveFileUrl,
          },
          documentType: "pdf",
          editorConfig: {
            callbackUrl: callbackUrl.toString(),
            customization: { autosave: false, forcesave: false },
            mode: "edit",
            user: { id: "admin-imrad", name: "Administrator" },
          },
          events: {
            onAppReady: () => {
              if (!cancelled) setLoading(false);
            },
            onError: (event: { data?: { errorDescription?: string } }) => {
              console.error("Admin IMRAD OnlyOffice error:", event.data);
              if (cancelled) return;
              setLoading(false);
              setError(
                event.data?.errorDescription
                  ? `OnlyOffice error: ${event.data.errorDescription}`
                  : "OnlyOffice could not open this PDF."
              );
            },
          },
          height: "100%",
          type: "desktop",
          width: "100%",
        });
      } catch (loadError) {
        if (cancelled) return;
        setLoading(false);
        setError(
          loadError instanceof Error
            ? loadError.message
            : "OnlyOffice could not be loaded."
        );
      }
    };

    void createEditor();

    return () => {
      cancelled = true;
      editorRef.current?.destroyEditor();
      editorRef.current = null;
    };
  }, [
    editorElementId,
    effectiveFileId,
    effectiveFileName,
    effectiveFileUrl,
    serverUrl,
  ]);

  return (
    <div
      aria-label={`OnlyOffice PDF editor for ${teamName}`}
      className="flex min-h-0 flex-1 flex-col overflow-hidden bg-background"
    >
      <header className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-border bg-card px-4 py-2">
        <div className="min-w-0">
          <h2 className="truncate font-semibold text-foreground">{teamName}</h2>
          <p className="truncate text-sm text-muted-foreground">
            {projectTitle} · {effectiveFileName ?? "Preparing IMRAD draft PDF"}
          </p>
          <p className="text-xs text-amber-600 dark:text-amber-400">
            Admin PDF editor · saving changes is not connected yet
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          {nextPartName ? (
            <Button
              type="button"
              onClick={markPartDone}
              disabled={!effectiveFileId || updatingPart}
            >
              {updatingPart ? (
                <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Check className="mr-2 h-4 w-4" />
              )}
              {updatingPart
                ? "Updating..."
                : `Update Instructor: Part ${nextPartNumber} Done`}
            </Button>
          ) : (
            <span className="text-sm font-medium text-emerald-600 dark:text-emerald-400">
              All 4 IMRAD parts complete
            </span>
          )}
          <Button type="button" variant="outline" onClick={onClose}>
            <X className="mr-2 h-4 w-4" />
            Close
          </Button>
        </div>
      </header>
      {partUpdateError && (
        <p role="alert" className="shrink-0 border-b border-destructive/30 bg-destructive/10 px-4 py-2 text-sm text-destructive">
          {partUpdateError}
        </p>
      )}
      <main className="relative min-h-0 flex-1 bg-slate-800">
        {loading && !error && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-slate-800 text-sm text-white/80">
            Connecting to OnlyOffice...
          </div>
        )}
        {error ? (
          <div role="alert" className="flex h-full items-center justify-center px-6 text-center text-sm text-white">
            {error}
          </div>
        ) : (
          <div id={editorElementId} className="h-full w-full" />
        )}
      </main>
    </div>
  );
}
