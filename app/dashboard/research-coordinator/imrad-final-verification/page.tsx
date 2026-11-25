"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { getConvexErrorMessage } from "@/lib/convex-errors";

export default function FinalVerificationPage() {
  const router = useRouter();
  const me = useQuery(api.users.getMe);
  const hasAccess = me?.role === "coordinator";
  const queue = useQuery(
    api.researchCoordinator.listFinalVerificationQueue,
    hasAccess ? {} : "skip"
  );
  const review = useMutation(api.imrad.reviewFinalVerification);

  const [comments, setComments] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (me !== undefined && (!me || me.role !== "coordinator")) {
      router.replace("/unauthorized");
    }
  }, [me, router]);

  const submitDecision = async (
    submissionId: Id<"imradSubmissions">,
    decision: "approve" | "request_changes"
  ) => {
    const comment = comments[submissionId] ?? "";
    if (decision === "request_changes" && !comment.trim()) {
      setError("Enter a comment before requesting changes.");
      return;
    }

    setError(null);
    setBusyId(submissionId);
    try {
      await review({
        submissionId,
        decision,
        ...(decision === "request_changes" ? { comment } : {}),
      });
      setComments((current) => ({ ...current, [submissionId]: "" }));
    } catch (err) {
      setError(getConvexErrorMessage(err, "Could not update this submission."));
    } finally {
      setBusyId(null);
    }
  };

  if (!me || queue === undefined) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-b-2 border-rose-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4 font-Poppins sm:p-6">
      <header>
        <Link
          href="/dashboard/research-coordinator"
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          Back to coordinator dashboard
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-foreground">
          IMRaD Final Verification
        </h1>
        <p className="text-sm text-muted-foreground">
          Review each final PDF, then approve it or return it to the instructor
          with a comment. Showing up to 100 newest submissions.
        </p>
      </header>

      {error && (
        <p
          role="alert"
          className="rounded-md border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300"
        >
          {error}
        </p>
      )}

      {queue.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-card p-10 text-center">
          <h2 className="font-semibold text-foreground">
            No submissions awaiting verification
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            New final IMRaD submissions will appear here.
          </p>
        </div>
      ) : (
        <section className="space-y-4">
          {queue.map((submission) => {
            const busy = busyId === submission.submissionId;
            const ready =
              submission.documentUrl !== null &&
              submission.completedParts.length === 4;

            return (
              <article
                key={submission.submissionId}
                className="space-y-4 rounded-xl border border-border bg-card p-4 sm:p-5"
              >
                <div className="flex flex-col justify-between gap-2 sm:flex-row">
                  <div>
                    <h2 className="font-semibold text-foreground">
                      {submission.teamName}
                    </h2>
                    <p className="text-sm text-muted-foreground">
                      {submission.projectTitle}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Instructor: {submission.instructorName}
                    </p>
                  </div>
                  <time className="text-xs text-muted-foreground">
                    Submitted{" "}
                    {new Date(submission.submittedAt).toLocaleDateString(
                      "en-PH",
                      { dateStyle: "medium" }
                    )}
                  </time>
                </div>

                <div className="flex flex-wrap items-center gap-3 text-sm">
                  <span className="text-muted-foreground">
                    IMRaD parts completed: {submission.completedParts.length}/4
                  </span>
                  {submission.documentUrl ? (
                    <a
                      href={submission.documentUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-medium text-blue-700 underline dark:text-blue-300"
                    >
                      Open final PDF
                    </a>
                  ) : (
                    <span className="text-amber-700 dark:text-amber-300">
                      Final PDF is unavailable
                    </span>
                  )}
                </div>

                {!ready && (
                  <p className="text-sm text-amber-700 dark:text-amber-300">
                    The PDF must be available and all four parts complete before
                    this submission can be reviewed.
                  </p>
                )}

                <Textarea
                  value={comments[submission.submissionId] ?? ""}
                  onChange={(event) =>
                    setComments((current) => ({
                      ...current,
                      [submission.submissionId]: event.target.value,
                    }))
                  }
                  placeholder="Explain the changes needed (required only when requesting changes)"
                  rows={3}
                />

                <div className="flex flex-wrap justify-end gap-2">
                  <Button
                    variant="outline"
                    disabled={busy || !ready}
                    onClick={() =>
                      submitDecision(
                        submission.submissionId,
                        "request_changes"
                      )
                    }
                  >
                    {busy ? "Saving..." : "Request changes"}
                  </Button>
                  <Button
                    disabled={busy || !ready}
                    onClick={() =>
                      submitDecision(submission.submissionId, "approve")
                    }
                  >
                    {busy ? "Saving..." : "Approve"}
                  </Button>
                </div>
              </article>
            );
          })}
        </section>
      )}
    </div>
  );
}