"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import {
  CalendarDays,
  Check,
  ClipboardCheck,
  FileText,
  Search,
  Play,
  X,
  Trash2,
  Upload,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import AdminImradOnlyOffice from "@/app/components/admin-imrad-onlyoffice";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const IMRAD_PARTS = [
  "Introduction",
  "Methodology",
  "Results",
  "Discussion",
] as const;

const BADGE_BASE =
  "inline-flex items-center justify-center rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap";

const STATUS_BADGE: Record<string, { label: string; cls: string }> = {
  submitted: {
    label: "Submitted",
    cls: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
  },
  processing: {
    label: "Processing",
    cls: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
  },
  verification: {
    label: "Waiting for instructor",
    cls: "bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300",
  },
  changes_requested: {
    label: "Changes requested",
    cls: "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300",
  },
  approved: {
    label: "Approved",
    cls: "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300",
  },
  completed: {
    label: "Completed",
    cls: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
  },
};

export default function AdminImradProcessingPage() {
  const liveSubmissions = useQuery(api.imrad.adminSubmissions);
  const processLiveSubmission = useMutation(api.imrad.processSubmission);
  const cancelLiveProcessing = useMutation(api.imrad.cancelProcessing);
  const deleteInvalidSubmission = useMutation(api.imrad.deleteInvalidSubmission);
  const rejectLiveSubmission = useMutation(api.imrad.rejectSubmission);
  const submitFinalVerification = useMutation(api.imrad.submitFinalVerification);
  const completeImradConversion = useMutation(api.imrad.completeConversion);
  const archiveImradConversion = useMutation(api.imrad.archiveCompletedConversion);
  const saveWorkingDocument = useMutation(api.imrad.saveWorkingDocument);
  // Any signed-in user can get an upload URL here (admin included)
  const generateUploadUrl = useMutation(api.dashboard.generateUploadUrl);

  const [search, setSearch] = useState("");
  const [yearFilter, setYearFilter] = useState("all");
  const [backendActionError, setBackendActionError] = useState("");
  const [rejectingSubmissionId, setRejectingSubmissionId] =
    useState<Id<"imradSubmissions"> | null>(null);
  const [rejectionMessage, setRejectionMessage] = useState("");
  const [activeEditor, setActiveEditor] = useState<{
    teamName: string;
    projectTitle: string;
    submissionId: Id<"imradSubmissions">;
    fileId: Id<"_storage"> | null;
    fileName: string | null;
    fileUrl: string | null;
  } | null>(null);
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [selectedUploadSubmissionId, setSelectedUploadSubmissionId] = useState("");
  const [imradFile, setImradFile] = useState<File | null>(null);
  const [uploadError, setUploadError] = useState("");
  const [uploading, setUploading] = useState(false);

  type Submission = NonNullable<typeof liveSubmissions>[number];

  const startEditor = (submission: Submission) => {
    setActiveEditor({
      teamName: submission.teamName,
      projectTitle: submission.projectTitle,
      submissionId: submission.submissionId,
      fileId: submission.workingDocument?.storageId ?? null,
      fileName: submission.workingDocument?.fileName ?? null,
      fileUrl: submission.workingDocument?.url ?? null,
    });
  };

  const years = useMemo(
    () =>
      [
        ...new Set([
          ...(liveSubmissions ?? []).map((submission) => submission.year),
        ]),
      ].sort((a, b) => b - a),
    [liveSubmissions]
  );
  const matchesFilters = (item: { project: string; team: string; year: number }) => {
    const term = search.trim().toLowerCase();
    const matchesYear = yearFilter === "all" || String(item.year) === yearFilter;
    const matchesSearch =
      !term || item.project.toLowerCase().includes(term) || item.team.toLowerCase().includes(term);
    return matchesYear && matchesSearch;
  };
  const filteredLiveProcessing = (liveSubmissions ?? []).filter(
    (submission) =>
      ["processing", "verification", "changes_requested", "approved", "completed"].includes(
        submission.status
      ) &&
      matchesFilters({
        project: submission.projectTitle,
        team: submission.teamName,
        year: submission.year,
      })
  );
  const liveProcessingSubmissions = (liveSubmissions ?? []).filter(
    (submission) =>
      submission.status === "processing" ||
      submission.status === "changes_requested"
  );
  const filteredLiveSubmissions = (liveSubmissions ?? []).filter(
    (submission) =>
      submission.status === "submitted" &&
      matchesFilters({
        project: submission.projectTitle,
        team: submission.teamName,
        year: submission.year,
      })
  );
  // saveWorkingDocument only works for a "processing" project that has no guide PDF yet
  const uploadableSubmissions = (liveSubmissions ?? []).filter(
    (submission) => submission.status === "processing" && !submission.workingDocument
  );

  const processLive = async (submissionId: Id<"imradSubmissions">) => {
    setBackendActionError("");
    try {
      await processLiveSubmission({ submissionId });
    } catch (error) {
      console.error("Failed to process IMRAD submission:", error);
      setBackendActionError(
        error instanceof Error ? error.message : "Couldn't start IMRAD processing."
      );
    }
  };

  const deleteInvalidLive = async (submission: Submission) => {
    const fileCount = submission.evaluationFiles.length;
    if (fileCount === 3) return;
    if (
      !window.confirm(
        `Delete the ${fileCount} panel evaluation files for "${submission.teamName}" and allow the instructor to resubmit? This can't be undone.`
      )
    ) {
      return;
    }

    setBackendActionError("");
    try {
      await deleteInvalidSubmission({ submissionId: submission.submissionId });
    } catch (error) {
      console.error("Failed to delete invalid IMRAD submission:", error);
      setBackendActionError(
        error instanceof Error ? error.message : "Couldn't delete the invalid submission."
      );
    }
  };

  const rejectLive = async (submissionId: Id<"imradSubmissions">) => {
    if (!rejectionMessage.trim()) {
      setBackendActionError("Enter a message explaining what the instructor needs to correct.");
      return;
    }

    setBackendActionError("");
    try {
      await rejectLiveSubmission({ submissionId, rejectionMessage });
      setRejectingSubmissionId(null);
      setRejectionMessage("");
    } catch (error) {
      console.error("Failed to reject IMRAD submission:", error);
      setBackendActionError(
        error instanceof Error ? error.message : "Couldn't reject the submission."
      );
    }
  };

  const cancelLive = async (submissionId: Id<"imradSubmissions">) => {
    const submission = liveSubmissions?.find(
      (item) => item.submissionId === submissionId
    );
    const teamName = submission?.teamName ?? "this team";
    if (
      !window.confirm(
        `Cancel IMRAD processing for "${teamName}"? This permanently deletes the generated IMRAD PDF, its progress, the three panel evaluation PDFs, and the submission record. The team and account remain, and the accepted team can submit again with new evaluation PDFs.`
      )
    ) {
      return;
    }

    setBackendActionError("");
    try {
      await cancelLiveProcessing({ submissionId });
    } catch (error) {
      console.error("Failed to cancel IMRAD processing:", error);
      setBackendActionError(
        error instanceof Error ? error.message : "Couldn't cancel IMRAD processing."
      );
    }
  };

  const runAdminFinalAction = async (
    submissionId: Id<"imradSubmissions">,
    action: "verification" | "complete" | "archive"
  ) => {
    setBackendActionError("");
    try {
      if (action === "verification") {
        await submitFinalVerification({ submissionId });
      } else if (action === "complete") {
        await completeImradConversion({ submissionId });
      } else {
        await archiveImradConversion({ submissionId });
      }
    } catch (error) {
      console.error(`Failed to run IMRAD ${action} action:`, error);
      setBackendActionError(
        error instanceof Error ? error.message : `Couldn't ${action} the IMRAD document.`
      );
    }
  };

  const resetUploadDialog = () => {
    setImradFile(null);
    setSelectedUploadSubmissionId("");
    setUploadError("");
  };

  const submitImradUpload = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedUploadSubmissionId || !imradFile) {
      setUploadError("Select a project and choose an IMRAD PDF.");
      return;
    }
    if (imradFile.type !== "application/pdf" && !imradFile.name.toLowerCase().endsWith(".pdf")) {
      setUploadError("Choose a PDF file.");
      return;
    }

    setUploading(true);
    setUploadError("");
    try {
      const uploadUrl = await generateUploadUrl();
      const result = await fetch(uploadUrl, {
        method: "POST",
        // The server checks the stored content type, so send it as a PDF
        headers: { "Content-Type": "application/pdf" },
        body: imradFile,
      });
      if (!result.ok) throw new Error(`Upload failed with status ${result.status}`);
      const { storageId } = (await result.json()) as { storageId: Id<"_storage"> };

      await saveWorkingDocument({
        submissionId: selectedUploadSubmissionId as Id<"imradSubmissions">,
        storageId,
      });
      setUploadDialogOpen(false);
      resetUploadDialog();
    } catch (error) {
      console.error("Failed to attach IMRAD PDF:", error);
      setUploadError(
        error instanceof Error ? error.message : "Couldn't attach the IMRAD PDF."
      );
    } finally {
      setUploading(false);
    }
  };

  const closeUploadDialog = (open: boolean) => {
    setUploadDialogOpen(open);
    if (!open) resetUploadDialog();
  };

  const formatDate = (ms: number) =>
    new Date(ms).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });

  // The PDF can go to the instructor only when all 4 parts are done and the latest edit is saved
  const readyForVerification = (submission: Submission) => {
    const doc = submission.workingDocument;
    return (
      !!doc &&
      doc.completedParts.length === 4 &&
      doc.savedAt !== null &&
      doc.revision >= submission.requiredSaveRevision
    );
  };

  const renderSubmittedCard = (submission: Submission) => {
    const badge = STATUS_BADGE[submission.status];
    const fileCount = submission.evaluationFiles.length;
    const invalid = fileCount !== 3;
    const rejecting = rejectingSubmissionId === submission.submissionId;

    return (
      <article
        key={submission.submissionId}
        className="min-w-0 rounded-2xl border border-border bg-card p-4 md:p-5"
      >
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="truncate text-base font-semibold text-foreground">
                {submission.teamName}
              </h3>
              <span className={`${BADGE_BASE} ${badge.cls}`}>{badge.label}</span>
              {invalid && (
                <span
                  className={`${BADGE_BASE} bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300`}
                >
                  {fileCount} of 3 evaluation files
                </span>
              )}
            </div>
            <p className="text-sm text-muted-foreground">{submission.projectTitle}</p>
            <p className="text-xs text-muted-foreground">
              Instructor: {submission.instructorName} • Submitted {formatDate(submission.submittedAt)}
            </p>
            <p className="text-sm text-foreground">{submission.description}</p>
            <ul className="flex flex-wrap gap-2 pt-1">
              {submission.evaluationFiles.map((file, i) => (
                <li key={`${file.fileName}-${i}`}>
                  {file.url ? (
                    <a
                      href={file.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1 text-xs text-foreground hover:bg-muted"
                    >
                      <FileText className="h-3.5 w-3.5" />
                      <span className="max-w-48 truncate">{file.fileName}</span>
                    </a>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-dashed border-border px-3 py-1 text-xs text-muted-foreground">
                      <FileText className="h-3.5 w-3.5" /> {file.fileName} (unavailable)
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </div>

          <div className="flex shrink-0 flex-wrap items-center gap-2">
            {invalid ? (
              <Button
                type="button"
                variant="outline"
                className="gap-1.5 text-destructive"
                onClick={() => deleteInvalidLive(submission)}
              >
                <Trash2 className="h-4 w-4" /> Delete files
              </Button>
            ) : (
              <>
                <Button
                  type="button"
                  variant="outline"
                  className="gap-1.5"
                  onClick={() => {
                    setBackendActionError("");
                    setRejectionMessage("");
                    setRejectingSubmissionId(rejecting ? null : submission.submissionId);
                  }}
                >
                  <X className="h-4 w-4" /> Reject
                </Button>
                <Button
                  type="button"
                  className="gap-1.5"
                  onClick={() => processLive(submission.submissionId)}
                >
                  <Play className="h-4 w-4" /> Start processing
                </Button>
              </>
            )}
          </div>
        </div>

        {rejecting && (
          <div className="mt-4 space-y-3 rounded-xl border border-border bg-muted/40 p-4">
            <label
              htmlFor={`reject-${submission.submissionId}`}
              className="text-sm font-medium text-foreground"
            >
              What does the instructor need to correct?
            </label>
            <Textarea
              id={`reject-${submission.submissionId}`}
              value={rejectionMessage}
              onChange={(event) => setRejectionMessage(event.target.value)}
              placeholder="e.g. Evaluation PDF for the second panelist is unsigned."
              rows={3}
            />
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setRejectingSubmissionId(null);
                  setRejectionMessage("");
                }}
              >
                Cancel
              </Button>
              <Button type="button" onClick={() => rejectLive(submission.submissionId)}>
                Send rejection
              </Button>
            </div>
          </div>
        )}
      </article>
    );
  };

  const renderProcessingCard = (submission: Submission) => {
    const badge = STATUS_BADGE[submission.status];
    const doc = submission.workingDocument;
    const completed = doc?.completedParts ?? [];
    const editable =
      submission.status === "processing" || submission.status === "changes_requested";
    const ready = readyForVerification(submission);

    return (
      <article
        key={submission.submissionId}
        className="min-w-0 rounded-2xl border border-border bg-card p-4 md:p-5"
      >
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="truncate text-base font-semibold text-foreground">
                {submission.teamName}
              </h3>
              <span className={`${BADGE_BASE} ${badge.cls}`}>{badge.label}</span>
            </div>
            <p className="text-sm text-muted-foreground">{submission.projectTitle}</p>
            <p className="text-xs text-muted-foreground">
              Instructor: {submission.instructorName} • Submitted {formatDate(submission.submittedAt)}
            </p>

            {submission.status === "changes_requested" && submission.verificationComment && (
              <p className="rounded-lg bg-orange-50 p-3 text-sm text-orange-800 dark:bg-orange-950/30 dark:text-orange-300">
                Instructor comment: {submission.verificationComment}
              </p>
            )}

            {editable && (
              <div className="pt-1">
                {doc ? (
                  <>
                    <div className="grid grid-cols-4 gap-1.5">
                      {IMRAD_PARTS.map((part, i) => {
                        const done = completed.includes(i + 1);
                        return (
                          <div key={part}>
                            <div
                              className={`h-2 rounded-full ${done ? "bg-green-600" : "bg-muted"}`}
                            />
                            <p className="mt-1 truncate text-center text-[11px] text-muted-foreground">
                              {part}
                            </p>
                          </div>
                        );
                      })}
                    </div>
                    <p className="mt-2 text-xs text-muted-foreground">
                      {completed.length}/4 parts complete •{" "}
                      {doc.savedAt
                        ? `Last saved ${formatDate(doc.savedAt)} (revision ${doc.revision})`
                        : "Not saved yet"}
                    </p>
                    {completed.length === 4 && !ready && (
                      <p className="mt-1 text-xs text-amber-600 dark:text-amber-400">
                        Open the editor and save the PDF before submitting for verification.
                      </p>
                    )}
                  </>
                ) : (
                  <p className="text-xs text-amber-600 dark:text-amber-400">
                    {submission.status === "processing"
                      ? "No guide PDF attached yet. Use Upload Imrad to attach one."
                      : "The guide PDF is missing."}
                  </p>
                )}
              </div>
            )}

            {submission.status === "verification" && (
              <p className="text-xs text-muted-foreground">
                The instructor is verifying the final PDF.
              </p>
            )}
            {submission.status === "approved" && (
              <p className="text-xs text-muted-foreground">
                The instructor approved the PDF. Mark the conversion as complete.
              </p>
            )}
            {submission.status === "completed" && (
              <p className="text-xs text-muted-foreground">
                Add the completed PDF to the project archive.
              </p>
            )}
          </div>

          <div className="flex shrink-0 flex-wrap items-center gap-2">
            {doc?.url && (
              <Button asChild variant="outline" className="gap-1.5">
                <a href={doc.url} target="_blank" rel="noopener noreferrer">
                  <FileText className="h-4 w-4" /> View PDF
                </a>
              </Button>
            )}

            {editable && (
              <>
                <Button
                  type="button"
                  variant="outline"
                  disabled={!doc}
                  onClick={() => startEditor(submission)}
                >
                  Open editor
                </Button>
                <Button
                  type="button"
                  className="gap-1.5"
                  disabled={!ready}
                  title={
                    ready
                      ? "Send the PDF to the instructor"
                      : "Complete all 4 parts and save the PDF first"
                  }
                  onClick={() => runAdminFinalAction(submission.submissionId, "verification")}
                >
                  <ClipboardCheck className="h-4 w-4" /> Submit for verification
                </Button>
              </>
            )}

            {submission.status === "approved" && (
              <Button
                type="button"
                className="gap-1.5 bg-emerald-600 text-white hover:bg-emerald-700"
                onClick={() => runAdminFinalAction(submission.submissionId, "complete")}
              >
                <Check className="h-4 w-4" /> Complete conversion
              </Button>
            )}

            {submission.status === "completed" && (
              <Button
                type="button"
                className="gap-1.5 bg-emerald-600 text-white hover:bg-emerald-700"
                onClick={() => runAdminFinalAction(submission.submissionId, "archive")}
              >
                <Check className="h-4 w-4" /> Add to archive
              </Button>
            )}

            {["processing", "changes_requested", "verification"].includes(submission.status) && (
              <Button
                type="button"
                variant="outline"
                className="gap-1.5 text-destructive"
                onClick={() => cancelLive(submission.submissionId)}
              >
                <Trash2 className="h-4 w-4" /> Cancel
              </Button>
            )}
          </div>
        </div>
      </article>
    );
  };

  return activeEditor ? (
    <div className="-m-4 flex min-h-0 flex-1 flex-col overflow-hidden">
      <AdminImradOnlyOffice
        {...activeEditor}
        completedParts={
          liveSubmissions?.find(
            (submission) => submission.submissionId === activeEditor.submissionId
          )?.workingDocument?.completedParts ?? []
        }
        onClose={() => setActiveEditor(null)}
      />
    </div>
  ) : (
    <div className="space-y-6 p-4 font-Poppins sm:p-6">
      <section className="rounded-2xl border border-purple-500/20 bg-linear-to-br from-purple-500/15 via-purple-500/5 to-transparent p-6 md:p-8">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-semibold text-foreground">Imrad Processing</h1>
            <p className="mt-2 max-w-2xl text-muted-foreground">
              Review instructor evaluation submissions and track projects being converted to IMRAD documents.
            </p>
          </div>
          <Button
            type="button"
            className="h-10 w-fit px-5"
            onClick={() => setUploadDialogOpen(true)}
            disabled={uploadableSubmissions.length === 0}
            title={
              uploadableSubmissions.length === 0
                ? "No project in processing is waiting for a guide PDF"
                : undefined
            }
          >
            <Upload className="mr-2 h-4 w-4" />
            Upload Imrad
          </Button>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {[
          {
            label: "Projects processing",
            value: (liveSubmissions ?? []).filter((submission) => submission.status === "processing").length,
            icon: FileText,
            tone: "bg-blue-500/10 text-blue-500",
          },
          {
            label: "Evaluation submissions",
            value: (liveSubmissions ?? []).filter((submission) => submission.status === "submitted").length,
            icon: Users,
            tone: "bg-emerald-500/10 text-emerald-500",
          },
          {
            label: "Academic years",
            value: years.length,
            icon: CalendarDays,
            tone: "bg-purple-500/10 text-purple-500",
          },
        ].map(({ label, value, icon: Icon, tone }) => (
          <article key={label} className="flex items-center gap-4 rounded-2xl border border-border bg-card p-5">
            <div className={`flex h-11 w-11 items-center justify-center rounded-full ${tone}`}>
              <Icon className="h-5 w-5" />
            </div>
            <div>
              <p className="text-2xl font-semibold text-foreground">{value}</p>
              <p className="text-sm text-muted-foreground">{label}</p>
            </div>
          </article>
        ))}
      </section>

      <section className="space-y-4 rounded-2xl border border-border bg-card p-4 md:p-5">
        <div className="flex flex-col gap-3 sm:flex-row">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search by project title or team..."
              aria-label="Search IMRAD projects"
              className="h-10 pl-9"
            />
          </div>
          <select
            value={yearFilter}
            onChange={(event) => setYearFilter(event.target.value)}
            aria-label="Filter by academic year"
            className="h-10 rounded-md border border-input bg-background px-3 text-sm text-foreground"
          >
            <option value="all">All years</option>
            {years.map((year) => (
              <option key={year} value={String(year)}>
                {year}
              </option>
            ))}
          </select>
          {(search || yearFilter !== "all") && (
            <Button
              variant="outline"
              className="h-10"
              onClick={() => {
                setSearch("");
                setYearFilter("all");
              }}
            >
              Clear filters
            </Button>
          )}
        </div>
        <p className="text-sm text-muted-foreground">
          Showing {filteredLiveProcessing.length + filteredLiveSubmissions.length} matching items
        </p>
        {backendActionError && (
          <p role="alert" className="text-sm text-destructive">
            {backendActionError}
          </p>
        )}
      </section>

      {/* Evaluation submissions waiting for the admin */}
      <section className="space-y-3">
        <div>
          <h2 className="text-xl font-semibold text-foreground">Evaluation submissions</h2>
          <p className="text-sm text-muted-foreground">
            Panel evaluations sent by instructors. Start processing, or reject with a reason.
          </p>
        </div>
        {liveSubmissions === undefined ? (
          <p className="py-4 text-center text-muted-foreground">Loading...</p>
        ) : filteredLiveSubmissions.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-card py-8 text-center text-muted-foreground">
            No evaluation submissions
          </div>
        ) : (
          <div className="space-y-3">{filteredLiveSubmissions.map(renderSubmittedCard)}</div>
        )}
      </section>

      {/* Projects being converted */}
      <section className="space-y-3">
        <div>
          <h2 className="text-xl font-semibold text-foreground">In processing</h2>
          <p className="text-sm text-muted-foreground">
            Projects being converted, verified by the instructor, and archived.
          </p>
        </div>
        {liveSubmissions === undefined ? (
          <p className="py-4 text-center text-muted-foreground">Loading...</p>
        ) : filteredLiveProcessing.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-card py-8 text-center text-muted-foreground">
            No projects in processing
          </div>
        ) : (
          <div className="space-y-3">{filteredLiveProcessing.map(renderProcessingCard)}</div>
        )}
      </section>

      <Dialog open={uploadDialogOpen} onOpenChange={closeUploadDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader className="pr-8">
            <DialogTitle className="text-lg font-semibold">Upload Imrad</DialogTitle>
            <DialogDescription>
              Choose a project in processing and attach its IMRAD PDF to that team. You can do this once per project.
            </DialogDescription>
          </DialogHeader>

          <form className="space-y-5" onSubmit={submitImradUpload}>
            <div className="space-y-2">
              <label htmlFor="imrad-project" className="text-sm font-medium text-foreground">
                Project in processing
              </label>
              <select
                id="imrad-project"
                value={selectedUploadSubmissionId}
                onChange={(event) => {
                  setSelectedUploadSubmissionId(event.target.value);
                  setUploadError("");
                }}
                required
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground"
              >
                <option value="" disabled>
                  Select a project
                </option>
                {uploadableSubmissions.map((submission) => (
                  <option key={submission.submissionId} value={submission.submissionId}>
                    {submission.teamName} — {submission.projectTitle}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <label htmlFor="imrad-pdf" className="text-sm font-medium text-foreground">
                IMRAD PDF file
              </label>
              <div className="rounded-xl border border-dashed border-border bg-muted/40 p-4">
                <Input
                  id="imrad-pdf"
                  type="file"
                  accept="application/pdf,.pdf"
                  required
                  aria-label="Select IMRAD PDF file"
                  className="h-auto cursor-pointer px-2 py-2 text-xs file:mr-2 file:rounded file:border-0 file:bg-primary file:px-2 file:py-1 file:text-primary-foreground"
                  onChange={(event) => {
                    setImradFile(event.currentTarget.files?.[0] ?? null);
                    setUploadError("");
                  }}
                />
                <p className="mt-2 truncate text-xs text-muted-foreground">
                  {imradFile?.name ?? "PDF files only"}
                </p>
              </div>
            </div>

            {uploadError && (
              <p role="alert" className="text-sm text-destructive">
                {uploadError}
              </p>
            )}

            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                disabled={uploading}
                onClick={() => closeUploadDialog(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={uploading}>
                {uploading ? "Attaching..." : "Attach IMRAD PDF"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}