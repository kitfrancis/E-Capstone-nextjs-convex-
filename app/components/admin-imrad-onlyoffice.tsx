"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useMutation, useQuery } from "convex/react";
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
  audience?: "admin" | "student";
  canEdit?: boolean;
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
  audience = "admin",
  canEdit = true,
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
  const completeStudentWorkingDocumentPart = useMutation(
    api.imrad.completeStudentWorkingDocumentPart
  );
  const submitStudentImrad = useMutation(api.imrad.submitStudentImrad);
  const confirmWorkingDocumentHasNoPendingChanges = useMutation(
    api.imrad.confirmAdminWorkingDocumentHasNoPendingChanges
  );
  const confirmStudentWorkingDocumentHasNoPendingChanges = useMutation(
    api.imrad.confirmStudentWorkingDocumentHasNoPendingChanges
  );
  const createStudentImradCallbackToken = useMutation(
    api.imrad.createStudentImradCallbackToken
  );
  const adminWorkingDocumentStatus = useQuery(
    api.imrad.adminWorkingDocumentStatus,
    audience === "admin" ? { submissionId } : "skip"
  );
  const studentWorkingDocumentStatus = useQuery(
    api.imrad.studentWorkingDocumentStatus,
    audience === "student" ? { submissionId } : "skip"
  );
  const workingDocumentStatus =
    audience === "admin"
      ? adminWorkingDocumentStatus
      : studentWorkingDocumentStatus;
  const serverUrl = (process.env.NEXT_PUBLIC_ONLYOFFICE_URL || "http://localhost:8080")
    .replace(/\/+$/, "");
  const effectiveFileId = fileId ?? workingDocument?.storageId ?? null;
  const effectiveFileName = fileName ?? workingDocument?.fileName ?? null;
  const effectiveFileUrl = fileUrl ?? workingDocument?.url ?? null;
  const partNames = ["Introduction", "Methodology", "Results", "Discussion"];
  const nextPartNumber = localCompletedParts.length + 1;
  const nextPartName = partNames[nextPartNumber - 1];
  const finalPdfNeedsSave =
    localCompletedParts.length === 4 &&
    (!workingDocumentStatus?.savedAt ||
      workingDocumentStatus.revision <
        workingDocumentStatus.requiredSaveRevision);
  const [savingFinalPdf, setSavingFinalPdf] = useState(false);
  const [saveMessage, setSaveMessage] = useState("");
  const [submittingForReview, setSubmittingForReview] = useState(false);
  const needsSaveForReview =
    localCompletedParts.length === 4 &&
    (!workingDocumentStatus?.savedAt ||
      workingDocumentStatus.revision <
        workingDocumentStatus.requiredSaveRevision);

  const saveFinalPdf = async () => {
    if (!effectiveFileId || savingFinalPdf) return;
    setSavingFinalPdf(true);
    setSaveMessage("");
    try {
      const response = await fetch("/api/onlyoffice/forcesave", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          key: `${audience === "admin" ? "admin-imrad" : "imrad"}-${effectiveFileId}`,
        }),
      });
      const result: unknown = await response.json();
      if (!response.ok || !result || typeof result !== "object" || !("ok" in result) || result.ok !== true) {
        throw new Error("OnlyOffice could not save the final PDF.");
      }
      if ("waitForCallback" in result && result.waitForCallback === false) {
        if (audience === "admin") {
          await confirmWorkingDocumentHasNoPendingChanges({ submissionId });
        } else {
          await confirmStudentWorkingDocumentHasNoPendingChanges({ submissionId });
        }
        setSaveMessage(
          audience === "admin"
            ? "The latest saved PDF has no pending edits and is ready for verification."
            : "The latest saved PDF is ready to submit to your instructor."
        );
      } else {
        setSaveMessage(
          audience === "admin"
            ? "Save requested. The Final Verification action will be enabled once the saved PDF is confirmed."
            : "Save requested. Submit to your instructor once the saved PDF is confirmed."
        );
      }
    } catch (saveError) {
      console.error("Failed to save final IMRaD PDF:", saveError);
      setSaveMessage(
        saveError instanceof Error ? saveError.message : "Could not save the final PDF."
      );
    } finally {
      setSavingFinalPdf(false);
    }
  };

  useEffect(() => {
    setLocalCompletedParts(completedParts);
  }, [completedParts]);

  const markPartDone = async () => {
    if (!effectiveFileId || !nextPartName || updatingPart || !canEdit) return;
    setUpdatingPart(true);
    setPartUpdateError("");
    try {
      if (audience === "admin") {
        await completeWorkingDocumentPart({
          submissionId,
          partNumber: nextPartNumber as 1 | 2 | 3 | 4,
        });
      } else {
        await completeStudentWorkingDocumentPart({
          submissionId,
          partNumber: nextPartNumber as 1 | 2 | 3 | 4,
        });
      }
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
    if (audience === "student") return;
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
    audience,
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
        let callbackUrl: string | undefined;
        if (audience === "admin") {
          const url = new URL(callbackBase);
          url.searchParams.set("adminImradSubmissionId", submissionId);
          callbackUrl = url.toString();
        } else if (canEdit) {
          const callbackToken = await createStudentImradCallbackToken({
            submissionId,
          });
          const url = new URL(callbackBase);
          url.searchParams.set("imradSubmissionId", submissionId);
          url.searchParams.set("imradExpires", String(callbackToken.expiresAt));
          url.searchParams.set("imradToken", callbackToken.token);
          callbackUrl = url.toString();
        }

        editorRef.current = new window.DocsAPI.DocEditor(editorElementId, {
          document: {
            fileType: "pdf",
            key: `${audience === "admin" ? "admin-imrad" : "imrad"}-${effectiveFileId}`,
            permissions: {
              edit: audience === "admin" || canEdit,
              comment: false,
              review: false,
              fillForms: audience === "admin" || canEdit,
              print: true,
            },
            title: effectiveFileName,
            url: effectiveFileUrl,
          },
          documentType: "pdf",
          editorConfig: {
            ...(callbackUrl ? { callbackUrl } : {}),
            customization: { autosave: false, forcesave: false },
            mode: audience === "admin" || canEdit ? "edit" : "view",
            user:
              audience === "admin"
                ? { id: "admin-imrad", name: "Administrator" }
                : { id: "student-imrad", name: "Student" },
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
    audience,
    canEdit,
    createStudentImradCallbackToken,
    editorElementId,
    effectiveFileId,
    effectiveFileName,
    effectiveFileUrl,
    serverUrl,
    submissionId,
  ]);

  const submitToInstructor = async () => {
    if (audience !== "student" || submittingForReview || needsSaveForReview) return;
    setSubmittingForReview(true);
    setSaveMessage("");
    try {
      await submitStudentImrad({ submissionId });
      onClose();
    } catch (submitError) {
      console.error("Failed to submit student IMRaD:", submitError);
      setSaveMessage(
        submitError instanceof Error
          ? submitError.message
          : "Could not submit the IMRaD for instructor review."
      );
    } finally {
      setSubmittingForReview(false);
    }
  };

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
            Changes are saved to the team&apos;s Convex working copy when OnlyOffice saves.
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          {nextPartName && canEdit ? (
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
                : audience === "admin"
                  ? `Update Instructor: Part ${nextPartNumber} Done`
                  : `Mark Part ${nextPartNumber} Done`}
            </Button>
          ) : !nextPartName && audience === "admin" ? (
            <span className="text-sm font-medium text-emerald-600 dark:text-emerald-400">
              All 4 IMRAD parts complete
            </span>
          ) : null}
          {audience === "admin" && localCompletedParts.length === 4 && (
            <Button
              type="button"
              variant="outline"
              onClick={saveFinalPdf}
              disabled={!effectiveFileId || savingFinalPdf || !finalPdfNeedsSave}
            >
              {savingFinalPdf
                ? "Saving PDF..."
                : finalPdfNeedsSave
                  ? "Save PDF for verification"
                  : "Final PDF saved"}
            </Button>
          )}
          {audience === "student" &&
            canEdit &&
            localCompletedParts.length === 4 && (
              <>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={saveFinalPdf}
                    disabled={!effectiveFileId || savingFinalPdf || !needsSaveForReview}
                  >
                    {savingFinalPdf
                      ? "Saving PDF..."
                      : needsSaveForReview
                        ? "Save PDF for submission"
                        : "PDF saved"}
                  </Button>
                  <Button
                    type="button"
                    onClick={submitToInstructor}
                    disabled={needsSaveForReview || savingFinalPdf || submittingForReview}
                  >
                    {submittingForReview ? "Submitting..." : "Submit to Instructor"}
                  </Button>
              </>
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
      {saveMessage && (
        <p role="status" className="shrink-0 border-b border-border bg-muted/40 px-4 py-2 text-sm text-muted-foreground">
          {saveMessage}
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
