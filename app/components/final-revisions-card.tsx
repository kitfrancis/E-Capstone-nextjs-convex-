"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { ClipboardList, Clock, FileText } from "lucide-react";

export function FinalRevisionsCard({ projectId }: { projectId: Id<"capstoneProjects"> }) {
  const info = useQuery(api.defense.finalRevisionInfo, { projectId });
  if (!info) return null;

  const revising = info.stage === "final_revisions";
  if (!revising && info.forms.length === 0) return null;

  const allRevised = info.total > 0 && info.revised === info.total;
  const underReview = revising && allRevised && info.approved < info.total;

  return (
    <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-900 dark:bg-amber-950/30">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-amber-600 text-white">
            <ClipboardList className="h-5 w-5" />
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground">Final Revisions</p>
            <p className="text-xs text-muted-foreground">
              {info.forms.length === 0
                ? "Waiting for your instructor to upload the panel evaluation forms."
                : "Read the evaluation forms, then resubmit every chapter with your revisions."}
            </p>
          </div>
        </div>
        {revising && info.forms.length > 0 && (
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
        )}
      </div>

      {info.forms.length > 0 && (
        <ul className="mt-3 grid gap-2 sm:grid-cols-3">
          {info.forms.map((f, i) => (
            <li key={i}>
              <a
                href={f.url ?? "#"}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 rounded-lg border bg-card px-3 py-2 text-xs font-medium text-foreground hover:bg-muted/50"
              >
                <FileText className="h-4 w-4 shrink-0 text-blue-600" />
                <span className="truncate">Panel {i + 1}: {f.fileName}</span>
              </a>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}