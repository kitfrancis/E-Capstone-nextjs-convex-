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

const PDFViewer = dynamic(
  () => import("@/app/components/PDFViewer").then((module) => ({ default: module.PDFViewer })),
  { ssr: false }
);

export default function InstructorVerificationPage() {
  const submissions = useQuery(api.imrad.myInstructorReviewSubmissions);
  const review = useMutation(api.imrad.reviewInstructorSubmission);
  const [activePreview, setActivePreview] = useState<{
    url: string;
    name: string;
  } | null>(null);
  const [activeSubmissionId, setActiveSubmissionId] =
    useState<Id<"imradSubmissions"> | null>(null);
  const [comment, setComment] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
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
        <h1 className="text-3xl font-semibold text-foreground">IMRaD Instructor Review</h1>
        <p className="mt-2 text-muted-foreground">
          Review the team&apos;s completed IMRaD PDF. Approve it for final admin verification or request changes from the students.
        </p>
      </section>

      {submissions === undefined ? (
        <p className="py-8 text-center text-sm text-muted-foreground">
          Loading IMRaD documents awaiting review...
        </p>
      ) : submissions.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border px-6 py-10 text-center text-sm text-muted-foreground">
          No IMRaD documents are waiting for instructor review.
        </div>
      ) : (
        <div className="space-y-3">
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
            <DialogTitle>Review {activeSubmission?.teamName}&apos;s IMRaD PDF</DialogTitle>
            <DialogDescription>
              Preview the file. Approving sends it to the admin for final verification; requested changes go back to the students.
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
              Preview IMRaD PDF
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
              placeholder="Explain the changes the students should make..."
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
              {busy ? "Saving..." : "Approve and Send to Admin"}
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
