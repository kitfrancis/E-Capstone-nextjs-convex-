"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { ClipboardList, Clock } from "lucide-react";

export function FinalRevisionsCard({ projectId }: { projectId: Id<"capstoneProjects"> }) {
  const info = useQuery(api.defense.finalRevisionInfo, { projectId });
  if (!info) return null;

  const revising = info.stage === "final_revisions";
  const reviewingChapterEdits = info.stage === "chapter_revisions";
  if (!revising && !reviewingChapterEdits) return null;

  const allRevised = info.total > 0 && info.revised === info.total;
  const underReview =
    (revising && allRevised && info.approved < info.total) ||
    (reviewingChapterEdits && info.approved < info.total);

  return (
    <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-900 dark:bg-amber-950/30">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-amber-600 text-white">
            <ClipboardList className="h-5 w-5" />
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground">
              {reviewingChapterEdits ? "Chapter Review" : "Final Revisions"}
            </p>
            <p className="text-xs text-muted-foreground">
              {reviewingChapterEdits
                ? "A chapter was updated after approval. Your instructor must approve the latest versions before IMRaD is unlocked."
                : "Resubmit every chapter with your revisions. Your instructor will check each one."}
            </p>
          </div>
        </div>
        {reviewingChapterEdits ? (
          <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">
            <Clock className="h-3.5 w-3.5" />
            {info.approved}/{info.total} chapters approved
          </span>
        ) : revising ? (
          <span
            className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${
              underReview
                ? "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300"
                : "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300"
            }`}
          >
            <Clock className="h-3.5 w-3.5" />
            {underReview
              ? "Under Review"
              : `${info.revised}/${info.total} chapters resubmitted`}
          </span>
        ) : null}
      </div>
    </div>
  );
}