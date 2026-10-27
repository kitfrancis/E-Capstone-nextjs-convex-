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

export default function AdminImradProcessingPage() {
  const liveSubmissions = useQuery(api.imrad.adminSubmissions);
  const processLiveSubmission = useMutation(api.imrad.processSubmission);
  const cancelLiveProcessing = useMutation(api.imrad.cancelProcessing);
  const deleteInvalidSubmission = useMutation(api.imrad.deleteInvalidSubmission);
  const rejectLiveSubmission = useMutation(api.imrad.rejectSubmission);
  const submitFinalVerification = useMutation(api.imrad.submitFinalVerification);
  const completeImradConversion = useMutation(api.imrad.completeConversion);
  const archiveImradConversion = useMutation(api.imrad.archiveCompletedConversion);
  const [search, setSearch] = useState("");
  const [yearFilter, setYearFilter] = useState("all");
  const [backendActionError, setBackendActionError] = useState("");
  const [rejectingSubmissionId, setRejectingSubmissionId] =
    useState<Id<"imradSubmissions"> | null>(null);
  const [rejectionMessage, setRejectionMessage] = useState("");
  const [uploadedImradFiles, setUploadedImradFiles] = useState<Record<string, string[]>>({});
  const [activeEditor, setActiveEditor] = useState<{
    teamName: string;
    projectTitle: string;
    submissionId: Id<"imradSubmissions">;
    fileId: Id<"_storage"> | null;
    fileName: string | null;
    fileUrl: string | null;
  } | null>(null);
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [selectedUploadProjectId, setSelectedUploadProjectId] = useState("");
  const [imradFile, setImradFile] = useState<File | null>(null);
  const [uploadError, setUploadError] = useState("");

  const startEditor = (
    submission: NonNullable<typeof liveSubmissions>[number]
  ) => {
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

  const deleteInvalidLive = async (
    submission: NonNullable<typeof liveSubmissions>[number]
  ) => {
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

  const submitImradUpload = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedUploadProjectId || !imradFile) {
      setUploadError("Select a project and choose an IMRAD PDF.");
      return;
    }
    if (imradFile.type !== "application/pdf" && !imradFile.name.toLowerCase().endsWith(".pdf")) {
      setUploadError("Choose a PDF file.");
      return;
    }

    setUploadedImradFiles((current) => ({
      ...current,
      [selectedUploadProjectId]: [
        ...(current[selectedUploadProjectId] ?? []),
        imradFile.name,
      ],
    }));
    setUploadDialogOpen(false);
    setImradFile(null);
    setSelectedUploadProjectId("");
    setUploadError("");
  };

  const closeUploadDialog = (open: boolean) => {
    setUploadDialogOpen(open);
    if (!open) {
      setImradFile(null);
      setSelectedUploadProjectId("");
      setUploadError("");
    }
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
            disabled={liveProcessingSubmissions.length === 0}
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

      <div className="flex flex-col-reverse gap-6">
      <section className="space-y-3">
        <div>
          <h2 className="text-xl font-semibold text-foreground">Projects in Processing</h2>
          <p className="text-sm text-muted-foreground">
            Projects that have been accepted for IMRAD processing and their documents.
          </p>
        </div>

        {liveSubmissions === undefined ? (
          <div className="rounded-2xl border border-dashed border-border px-6 py-8 text-center text-sm text-muted-foreground">
            Loading IMRAD projects...
          </div>
        ) : filteredLiveProcessing.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border px-6 py-8 text-center text-sm text-muted-foreground">
            No projects are in processing.
          </div>
        ) : (
          <>
          {filteredLiveProcessing.map((submission) => {
            const workingDocumentName =
              submission.workingDocument?.fileName ??
              `${submission.teamName} - IMRAD Conversion Guide.pdf`;
            const completedParts =
              submission.workingDocument?.completedParts ?? [];
            const completedPartCount = completedParts.length;
            const statusLabel =
              submission.status === "verification"
                ? "Final verification"
                : submission.status === "changes_requested"
                ? "Changes requested"
                : submission.status === "approved"
                  ? "Instructor approved"
                  : submission.status === "completed"
                    ? "Ready to archive"
                    : "Processing";
            const canSubmitVerification =
              completedPartCount === IMRAD_PARTS.length &&
              Boolean(submission.workingDocument?.savedAt) &&
              (submission.workingDocument?.revision ?? 0) >=
                submission.requiredSaveRevision;
            const isEditableStatus =
              submission.status === "processing" ||
              submission.status === "changes_requested";
            return (
            <article
              key={submission.submissionId}
              className="space-y-6 rounded-2xl border border-border bg-card p-5"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-semibold text-foreground">{submission.teamName}</h3>
                    <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ${
                      submission.status === "changes_requested"
                        ? "bg-amber-500/15 text-amber-700 dark:text-amber-400"
                        : submission.status === "approved" || submission.status === "completed"
                          ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                          : "bg-blue-500/15 text-blue-600 dark:text-blue-400"
                    }`}>
                      <ClipboardCheck className="h-3.5 w-3.5" />
                      {statusLabel}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {submission.projectTitle} · {submission.year}
                  </p>
                  <p className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
                    <FileText className="h-4 w-4 shrink-0" />
                    <span className="truncate" title={workingDocumentName}>
                      {workingDocumentName}
                    </span>
                    {!submission.workingDocument && (
                      <span className="shrink-0 text-xs">Created on Start</span>
                    )}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {isEditableStatus && (
                    <>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => startEditor(submission)}
                      >
                        <Play className="mr-2 h-4 w-4" />
                        Open editor
                      </Button>
                      {submission.status === "processing" && (
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => cancelLive(submission.submissionId)}
                        >
                          Cancel Process
                        </Button>
                      )}
                    </>
                  )}
                  {submission.status === "verification" && (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => cancelLive(submission.submissionId)}
                    >
                      Cancel Process
                    </Button>
                  )}
                  {(submission.status === "processing" ||
                    submission.status === "changes_requested") && (
                    <Button
                      type="button"
                      disabled={!canSubmitVerification}
                      onClick={() =>
                        runAdminFinalAction(submission.submissionId, "verification")
                      }
                    >
                      {submission.status === "changes_requested"
                        ? "Resubmit for Final Verification"
                        : "Submit Final Verification"}
                    </Button>
                  )}
                  {submission.status === "approved" && (
                    <Button
                      type="button"
                      onClick={() =>
                        runAdminFinalAction(submission.submissionId, "complete")
                      }
                    >
                      Complete Conversion
                    </Button>
                  )}
                  {submission.status === "completed" && (
                    <Button
                      type="button"
                      onClick={() =>
                        runAdminFinalAction(submission.submissionId, "archive")
                      }
                    >
                      Archive Project
                    </Button>
                  )}
                </div>
              </div>
              {submission.status === "changes_requested" &&
                submission.verificationComment && (
                  <p className="rounded-lg border border-amber-500/20 bg-amber-500/5 px-4 py-3 text-sm text-foreground">
                    <span className="font-semibold">Instructor feedback:</span>{" "}
                    {submission.verificationComment}
                  </p>
                )}
              {(submission.status === "processing" ||
                submission.status === "changes_requested") && (
              <div
                className="space-y-1.5"
                role="group"
                aria-label={`IMRAD progress for ${submission.teamName}: Part ${completedPartCount} of ${IMRAD_PARTS.length}`}
              >
                <div className="flex items-end justify-between gap-3">
                  <p className="text-sm text-muted-foreground">
                    {completedPartCount} of {IMRAD_PARTS.length} parts completed
                  </p>
                  <p
                    role="progressbar"
                    aria-label="IMRAD parts completed"
                    aria-valuemin={0}
                    aria-valuemax={IMRAD_PARTS.length}
                    aria-valuenow={completedPartCount}
                    aria-valuetext={`Part ${completedPartCount} of ${IMRAD_PARTS.length}`}
                    className="text-2xl font-bold leading-none text-foreground"
                  >
                    Part {completedPartCount}/{IMRAD_PARTS.length}
                  </p>
                </div>
                <div
                  className="mt-4 gap-1.5"
                  style={{ display: "grid", gridTemplateColumns: `repeat(${IMRAD_PARTS.length}, minmax(0, 1fr))` }}
                  aria-hidden="true"
                >
                  {IMRAD_PARTS.map((part, index) => (
                    <div
                      key={part}
                      className="h-2.5 min-w-0 rounded-full bg-muted transition-colors"
                      style={{
                        backgroundColor: completedParts.includes(index + 1)
                          ? "#10b981"
                          : undefined,
                      }}
                    />
                  ))}
                </div>
                <ol
                  className="mt-4 list-none p-0"
                  style={{ display: "grid", gridTemplateColumns: `repeat(${IMRAD_PARTS.length}, minmax(0, 1fr))` }}
                >
                  {IMRAD_PARTS.map((part, index) => (
                    <li key={part} className="flex min-w-0 flex-col items-center gap-1.5 text-center">
                      <span
                        className={`flex h-8 w-8 items-center justify-center rounded-full ${
                          completedParts.includes(index + 1)
                            ? "text-white"
                            : "bg-muted text-muted-foreground"
                        }`}
                        style={{
                          backgroundColor: completedParts.includes(index + 1)
                            ? "#059669"
                            : undefined,
                        }}
                      >
                        {completedParts.includes(index + 1) && (
                          <Check className="h-5 w-5" aria-hidden="true" />
                        )}
                      </span>
                      <span
                        className="text-base font-medium leading-tight text-muted-foreground"
                        style={{
                          color: completedParts.includes(index + 1)
                            ? "#10b981"
                            : undefined,
                        }}
                      >
                        {part}
                      </span>
                      <span className="text-sm text-muted-foreground">Part {index + 1}</span>
                    </li>
                  ))}
                </ol>
              </div>
              )}
              {uploadedImradFiles[submission.submissionId]?.length ? (
                <ul className="grid gap-2 border-t border-border pt-4 sm:grid-cols-2">
                  {uploadedImradFiles[submission.submissionId].map((fileName, index) => (
                    <li
                      key={`${submission.submissionId}-${index}`}
                      className="flex items-center gap-2 rounded-lg border border-purple-500/20 bg-purple-500/5 px-3 py-2 text-sm text-foreground"
                    >
                      <FileText className="h-4 w-4 shrink-0 text-purple-500" />
                      <span className="min-w-0 truncate">{fileName}</span>
                      <span className="ml-auto shrink-0 text-xs text-muted-foreground">Uploaded IMRAD</span>
                    </li>
                  ))}
                </ul>
              ) : null}
            </article>
            );
          })}
          </>
        )}
      </section>

      <section className="space-y-3">
        <div>
          <h2 className="text-xl font-semibold text-foreground">Instructor Evaluation Submissions</h2>
          <p className="text-sm text-muted-foreground">
            Review the submitted panel evaluations and details, then process a project into the list above.
          </p>
        </div>

        {liveSubmissions === undefined ? (
          <div className="rounded-2xl border border-dashed border-border px-6 py-8 text-center text-sm text-muted-foreground">
            Loading instructor submissions...
          </div>
        ) : filteredLiveSubmissions.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border px-6 py-8 text-center text-sm text-muted-foreground">
            No instructor evaluation submissions match your search.
          </div>
        ) : (
          <>
          {filteredLiveSubmissions.map((submission) => (
            <article
              key={submission.submissionId}
              className="space-y-4 rounded-2xl border border-border bg-card p-5"
            >
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex min-w-0 items-start gap-4">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-600">
                    <ClipboardCheck className="h-5 w-5" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-semibold text-foreground">{submission.projectTitle}</h3>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {submission.teamName} • {submission.year} • Submitted by {submission.instructorName}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="destructive"
                    onClick={() => {
                      setRejectingSubmissionId(submission.submissionId);
                      setRejectionMessage("");
                      setBackendActionError("");
                    }}
                  >
                    <X className="mr-2 h-4 w-4" />
                    Reject
                  </Button>
                  {submission.evaluationFiles.length !== 3 && (
                    <Button
                      type="button"
                      variant="destructive"
                      onClick={() => deleteInvalidLive(submission)}
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      Delete invalid submission
                    </Button>
                  )}
                  <Button
                    type="button"
                    onClick={() => processLive(submission.submissionId)}
                    disabled={submission.evaluationFiles.length !== 3}
                  >
                    <Check className="mr-2 h-4 w-4" />
                    Process
                  </Button>
                </div>
              </div>
              <p className="text-sm leading-relaxed text-muted-foreground">{submission.description}</p>
              {rejectingSubmissionId === submission.submissionId && (
                <div className="space-y-3 rounded-lg border border-destructive/30 bg-destructive/5 p-4">
                  <label
                    htmlFor={`rejection-message-${submission.submissionId}`}
                    className="text-sm font-medium text-foreground"
                  >
                    Message to instructor
                  </label>
                  <Textarea
                    id={`rejection-message-${submission.submissionId}`}
                    value={rejectionMessage}
                    onChange={(event) => setRejectionMessage(event.target.value)}
                    placeholder="Explain what needs to be corrected before resubmitting..."
                    rows={3}
                  />
                  <div className="flex justify-end gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        setRejectingSubmissionId(null);
                        setRejectionMessage("");
                        setBackendActionError("");
                      }}
                    >
                      Cancel
                    </Button>
                    <Button
                      type="button"
                      variant="destructive"
                      onClick={() => rejectLive(submission.submissionId)}
                    >
                      Send rejection
                    </Button>
                  </div>
                </div>
              )}
              {submission.evaluationFiles.length !== 3 && (
                <p role="alert" className="text-sm text-destructive">
                  This submission has {submission.evaluationFiles.length} panel evaluation files; exactly 3 are required.
                </p>
              )}
              <div className="border-t border-border pt-4">
                <h4 className="mb-3 text-sm font-medium text-foreground">Submitted panel evaluations</h4>
                <ul className="grid gap-2 sm:grid-cols-3">
                  {submission.evaluationFiles.map((file, index) => (
                    <li key={`${submission.submissionId}-${index}`} className="min-w-0">
                      {file.url ? (
                        <a
                          href={file.url}
                          target="_blank"
                          rel="noreferrer"
                          className="flex items-center gap-2 rounded-lg bg-muted/50 px-3 py-2 text-sm text-foreground hover:underline"
                        >
                          <FileText className="h-4 w-4 shrink-0 text-blue-500" />
                          <span className="min-w-0 truncate">
                            <span className="block font-medium">Panel {index + 1}</span>
                            <span className="block text-xs text-muted-foreground">{file.fileName}</span>
                          </span>
                        </a>
                      ) : (
                        <span className="flex items-center gap-2 rounded-lg bg-muted/50 px-3 py-2 text-sm text-muted-foreground">
                          <FileText className="h-4 w-4 shrink-0" />
                          <span className="min-w-0 truncate">
                            <span className="block font-medium">Panel {index + 1}</span>
                            <span className="block text-xs">{file.fileName} (unavailable)</span>
                          </span>
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            </article>
          ))}
          </>
        )}
      </section>
      </div>

      <Dialog open={uploadDialogOpen} onOpenChange={closeUploadDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader className="pr-8">
            <DialogTitle className="text-lg font-semibold">Upload Imrad</DialogTitle>
            <DialogDescription>
              Choose a project in processing and attach its IMRAD PDF to that team.
            </DialogDescription>
          </DialogHeader>

          <form className="space-y-5" onSubmit={submitImradUpload}>
            <div className="space-y-2">
              <label htmlFor="imrad-project" className="text-sm font-medium text-foreground">
                Project in processing
              </label>
              <select
                id="imrad-project"
                value={selectedUploadProjectId}
                onChange={(event) => {
                  setSelectedUploadProjectId(event.target.value);
                  setUploadError("");
                }}
                required
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground"
              >
                <option value="" disabled>
                  Select a project
                </option>
                {liveProcessingSubmissions.map((submission) => (
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
              <Button type="button" variant="outline" onClick={() => closeUploadDialog(false)}>
                Cancel
              </Button>
              <Button type="submit">Attach IMRAD PDF</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
