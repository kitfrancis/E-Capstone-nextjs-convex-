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
import { CheckCircle2, FileText, RotateCcw } from "lucide-react";
import { ImradProgressSummary } from "@/app/components/imrad-progress-summary";

const PDFViewer = dynamic(
  () => import("@/app/components/PDFViewer").then((module) => ({ default: module.PDFViewer })),
  { ssr: false }
);

export default function AdminImradProcessingPage() {
  const submissions = useQuery(api.imrad.adminSubmissions);
  const review = useMutation(api.imrad.reviewAdminImrad);
  const [activeSubmissionId, setActiveSubmissionId] =
    useState<Id<"imradSubmissions"> | null>(null);
  const [comment, setComment] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [activePreview, setActivePreview] = useState<{
    url: string;
    name: string;
  } | null>(null);

  const finalReviewQueue = (submissions ?? []).filter(
    (submission) =>
      submission.status === "admin_review" ||
      (submission.status === "student_editing" &&
        submission.revisionTarget === "admin")
  );
  const activeSubmission = finalReviewQueue.find(
    (submission) => submission.submissionId === activeSubmissionId
  );

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
          : "Couldn't save the final verification decision."
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6 p-4 font-Poppins sm:p-6">
      <section className="rounded-2xl border border-blue-500/20 bg-linear-to-br from-blue-500/15 via-blue-500/5 to-transparent p-6 md:p-8">
        <h1 className="text-3xl font-semibold text-foreground">IMRaD Final Verification</h1>
        <p className="mt-2 text-muted-foreground">
          Review documents approved by the instructor. Approval completes and archives the team&apos;s IMRaD.
        </p>
      </section>

      {submissions === undefined ? (
        <p className="py-8 text-center text-sm text-muted-foreground">
          Loading IMRaD documents...
        </p>
      ) : finalReviewQueue.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border px-6 py-10 text-center text-sm text-muted-foreground">
          No IMRaD documents are waiting for final verification.
        </div>
      ) : (
        <div className="space-y-3">
          {finalReviewQueue.map((submission) => {
            const awaitingStudent =
              submission.status === "student_editing" &&
              submission.revisionTarget === "admin";
            return (
              <article
                key={submission.submissionId}
                className="space-y-4 rounded-2xl border border-border bg-card p-5"
              >
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-blue-500/10 text-blue-600">
                      <FileText className="h-5 w-5" />
                    </span>
                    <div className="min-w-0">
                      <h2 className="truncate font-semibold text-foreground">{submission.teamName}</h2>
                      <p className="truncate text-sm text-muted-foreground">{submission.projectTitle}</p>
                      <p className="mt-1 truncate text-xs text-muted-foreground">
                        {submission.workingDocument?.fileName ?? "IMRaD PDF unavailable"}
                      </p>
                    </div>
                  </div>
                  <div className="flex shrink-0 flex-wrap gap-2">
                    <span className="inline-flex items-center rounded-full bg-muted px-3 py-1 text-xs font-medium text-muted-foreground">
                      {awaitingStudent ? "Changes requested — waiting for team" : "Awaiting final verification"}
                    </span>
                    {!awaitingStudent && (
                      <Button
                        type="button"
                        variant="outline"
                        disabled={!submission.workingDocument?.url}
                        onClick={() =>
                          submission.workingDocument?.url &&
                          setActivePreview({
                            url: submission.workingDocument.url,
                            name: submission.workingDocument.fileName,
                          })
                        }
                      >
                        Preview PDF
                      </Button>
                    )}
                    {!awaitingStudent && (
                      <Button
                        type="button"
                        disabled={!submission.workingDocument?.url}
                        onClick={() => {
                          setActiveSubmissionId(submission.submissionId);
                          setComment("");
                          setError("");
                        }}
                      >
                        Review
                      </Button>
                    )}
                  </div>
                </div>
                <ImradProgressSummary
                  completedParts={submission.workingDocument?.completedParts ?? []}
                />
                {submission.verificationComment && (
                  <p className="rounded-lg bg-orange-500/10 px-3 py-2 text-sm text-orange-700 dark:text-orange-300">
                    Latest review comment: {submission.verificationComment}
                  </p>
                )}
              </article>
            );
          })}
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
            <DialogTitle>Final review: {activeSubmission?.teamName}&apos;s IMRaD</DialogTitle>
            <DialogDescription>
              Preview the instructor-approved PDF. Approval completes and archives it; requested changes return directly to the student team.
            </DialogDescription>
          </DialogHeader>
          <Button
            type="button"
            variant="outline"
            disabled={!activeSubmission?.workingDocument?.url}
            onClick={() =>
              activeSubmission?.workingDocument?.url &&
              setActivePreview({
                url: activeSubmission.workingDocument.url,
                name: activeSubmission.workingDocument.fileName,
              })
            }
          >
            <FileText className="mr-2 h-4 w-4" />
            Preview IMRaD PDF
          </Button>
          <div className="space-y-2">
            <label htmlFor="admin-imrad-comment" className="text-sm font-medium">
              Comment (required when requesting changes)
            </label>
            <Textarea
              id="admin-imrad-comment"
              value={comment}
              onChange={(event) => setComment(event.target.value)}
              placeholder="Explain any changes the student team should make..."
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
              {busy ? "Saving..." : "Approve & Archive"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {activePreview && (
        <PDFViewer
          open
          fileUrl={activePreview.url}
          fileName={activePreview.name}
          onClose={() => setActivePreview(null)}
        />
      )}
    </div>
  );
}
