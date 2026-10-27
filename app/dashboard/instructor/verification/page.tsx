"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { CheckCircle2, FileText, RotateCcw, XCircle } from "lucide-react";

const PDFViewer = dynamic(
  () => import("@/app/components/PDFViewer").then((module) => ({ default: module.PDFViewer })),
  { ssr: false }
);

export default function InstructorVerificationPage() {
  const submissions = useQuery(api.imrad.myVerificationSubmissions);
  const review = useMutation(api.imrad.reviewFinalVerification);
  const cancelProcessing = useMutation(api.imrad.cancelProcessing);
  const [activePreview, setActivePreview] = useState<{
    url: string;
    name: string;
  } | null>(null);
  const [activeSubmissionId, setActiveSubmissionId] =
    useState<Id<"imradSubmissions"> | null>(null);
  const [comment, setComment] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [cancelingSubmissionId, setCancelingSubmissionId] =
    useState<Id<"imradSubmissions"> | null>(null);
  const [cancelError, setCancelError] = useState("");

  const cancelVerification = async (
    submissionId: Id<"imradSubmissions">,
    teamName: string
  ) => {
    if (
      !window.confirm(
        `Cancel final verification for "${teamName}"? This permanently deletes the IMRaD PDF, its progress, the panel evaluation PDFs, and the submission record. The accepted team remains so the instructor can submit again.`
      )
    ) {
      return;
    }

    setCancelError("");
    setCancelingSubmissionId(submissionId);
    try {
      await cancelProcessing({ submissionId });
      setActiveSubmissionId(null);
      setActivePreview(null);
      setComment("");
    } catch (cancelError) {
      console.error("Failed to cancel final IMRaD verification:", cancelError);
      setCancelError(
        cancelError instanceof Error
          ? cancelError.message
          : "Couldn't cancel final verification."
      );
    } finally {
      setCancelingSubmissionId(null);
    }
  };

  const submitReview = async (decision: "approve" | "request_changes") => {
    if (!activeSubmissionId) return;
    if (decision === "request_changes" && !comment.trim()) {
      setError("Enter a comment explaining the changes needed.");
      return;
    }

    setBusy(true);
    setError("");
    try {
      await review({
        submissionId: activeSubmissionId,
        decision,
        comment: decision === "request_changes" ? comment : undefined,
      });
      setActiveSubmissionId(null);
      setComment("");
    } catch (reviewError) {
      setError(
        reviewError instanceof Error
          ? reviewError.message
          : "Couldn't save your verification decision."
      );
    } finally {
      setBusy(false);
    }
  };

  const activeSubmission = submissions?.find(
    (submission) => submission.submissionId === activeSubmissionId
  );

  return (
    <div className="space-y-6 p-4 font-Poppins sm:p-6">
      <section className="rounded-2xl border border-blue-500/20 bg-linear-to-br from-blue-500/15 via-blue-500/5 to-transparent p-6 md:p-8">
        <h1 className="text-3xl font-semibold text-foreground">Final Verification</h1>
        <p className="mt-2 text-muted-foreground">
          Review the completed IMRaD PDF. Approve it or return it to the admin with a comment.
        </p>
      </section>

      {submissions === undefined ? (
        <p className="py-8 text-center text-sm text-muted-foreground">
          Loading documents awaiting verification...
        </p>
      ) : submissions.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border px-6 py-10 text-center text-sm text-muted-foreground">
          No IMRaD documents are waiting for verification.
        </div>
      ) : (
        <div className="space-y-3">
          {cancelError && (
            <p role="alert" className="text-sm text-destructive">
              {cancelError}
            </p>
          )}
          {submissions.map((submission) => (
            <article
              key={submission.submissionId}
              className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-5 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="flex min-w-0 items-center gap-3">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-blue-500/10 text-blue-600">
                  <FileText className="h-5 w-5" />
                </span>
                <div className="min-w-0">
                  <h2 className="truncate font-semibold text-foreground">{submission.teamName}</h2>
                  <p className="truncate text-sm text-muted-foreground">{submission.projectTitle}</p>
                  <p className="mt-1 truncate text-xs text-muted-foreground">{submission.fileName}</p>
                </div>
              </div>
              <div className="flex shrink-0 flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  disabled={!submission.fileUrl}
                  onClick={() => {
                    if (!submission.fileUrl) return;
                    setActiveSubmissionId(submission.submissionId);
                    setComment("");
                    setError("");
                  }}
                >
                  Review PDF
                </Button>
                <Button
                  type="button"
                  variant="destructive"
                  disabled={cancelingSubmissionId === submission.submissionId}
                  onClick={() =>
                    cancelVerification(submission.submissionId, submission.teamName)
                  }
                >
                  <XCircle className="mr-2 h-4 w-4" />
                  {cancelingSubmissionId === submission.submissionId
                    ? "Canceling..."
                    : "Cancel"}
                </Button>
              </div>
            </article>
          ))}
        </div>
      )}

      <Dialog
        open={!!activeSubmission}
        onOpenChange={(open) => {
          if (!open && !busy) setActiveSubmissionId(null);
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Verify {activeSubmission?.teamName}&apos;s IMRaD PDF</DialogTitle>
            <DialogDescription>
              Preview the final file before approving. If it needs changes, leave a clear comment for the admin.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={!activeSubmission?.fileUrl}
              onClick={() =>
                activeSubmission?.fileUrl &&
                setActivePreview({
                  url: activeSubmission.fileUrl,
                  name: activeSubmission.fileName,
                })
              }
            >
              <FileText className="mr-2 h-4 w-4" />
              Preview final PDF
            </Button>
          </div>
          <div className="space-y-2">
            <label htmlFor="verification-comment" className="text-sm font-medium">
              Comment (required when requesting changes)
            </label>
            <Textarea
              id="verification-comment"
              value={comment}
              onChange={(event) => setComment(event.target.value)}
              placeholder="Explain any changes the admin should make..."
              rows={4}
            />
          </div>
          {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant="outline"
              disabled={busy || !comment.trim()}
              onClick={() => submitReview("request_changes")}
            >
              <RotateCcw className="mr-2 h-4 w-4" />
              Request Changes
            </Button>
            <Button type="button" disabled={busy} onClick={() => submitReview("approve")}>
              <CheckCircle2 className="mr-2 h-4 w-4" />
              {busy ? "Saving..." : "Approve"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {activePreview && (
        <PDFViewer
          open
          fileUrl={activePreview.url}
          fileName={activePreview.name}
          onClose={() => {
            setActivePreview(null);
          }}
        />
      )}
    </div>
  );
}
