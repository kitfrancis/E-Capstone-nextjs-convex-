"use client";

import Link from "next/link";
import { Archive, ArrowRight, Calendar, Check, CheckCircle2 } from "lucide-react";
import type { Doc } from "@/convex/_generated/dataModel";

type Project = Doc<"capstoneProjects">;

const STEPS = ["Chapters approved", "Ready for defense", "Defense", "Final revisions", "Archived"];

const BADGE = "rounded-full px-2.5 py-0.5 text-xs font-medium";
const BLUE = "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300";
const AMBER = "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300";
const GREEN = "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300";
const VIOLET = "bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300";

// Which step (1-5) is current; 6 means everything is done
function currentStep(p: Project, progress: number) {
  switch (p.stage) {
    case "endorsed":
      return 2;
    case "defense_scheduled":
      return 3;
    case "final_revisions":
    case "chapter_revisions":
      return 4;
    case "ready_to_archive":
      return 5;
    case "archived":
      return 6;
  }
  return progress >= 100 ? 2 : 1;
}

export function DefenseBadge({ project, progress }: { project: Project; progress: number }) {
  let label: string = project.phase;
  let cls = BLUE;
  if (project.stage === "endorsed" || project.stage === "defense_scheduled") {
    label = project.defenseResult === "failed" ? "Re-defense needed" : "Ready for defense";
    if (project.defenseResult === "failed") cls = AMBER;
  } else if (project.stage === "final_revisions") {
    label = (project.evaluationForms?.length ?? 0) < 3 ? "Awaiting evaluation forms" : "Final revisions";
    cls = AMBER;
  } else if (project.stage === "chapter_revisions") {
    label = "Chapter review";
    cls = AMBER;
  } else if (project.stage === "ready_to_archive") {
    label = project.archiveEndorsedAt ? "Awaiting admin verification" : "IMRaD stage";
    cls = project.archiveEndorsedAt ? VIOLET : GREEN;
  } else if (project.stage === "archived") {
    label = "Archived";
    cls = "bg-muted text-muted-foreground";
  } else if (progress >= 100) {
    label = "Ready for defense";
  }
  return <span className={`${BADGE} ${cls}`}>{label}</span>;
}

function formatDefense(s?: string) {
  if (!s) return "—";
  const d = new Date(s);
  if (isNaN(d.getTime())) return s;
  const date = d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  const time = d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  return `${date} · ${time}`;
}

const RESULT_LABEL = {
  passed: "Passed",
  passed_with_revisions: "Passed with revisions",
  failed: "Failed",
} as const;

export function DefenseStatusCard({ project, progress }: { project: Project; progress: number }) {
  const step = currentStep(project, progress);
  const showResult =
    project.defenseResult &&
    project.defenseResult !== "failed" &&
    (project.stage === "final_revisions" ||
      project.stage === "chapter_revisions" ||
      project.stage === "ready_to_archive" ||
      project.stage === "archived");

  let label = "Next step";
  let title = "Keep going";
  let text = "Get every chapter approved. Your project becomes ready for defense automatically.";
  let extra: React.ReactNode = null;

  if (project.stage === "archived") {
    label = "All done";
    title = "Project archived. Congratulations!";
    text = "Your capstone is now part of the project archive. This workspace is read-only.";
    extra = (
      <Link
        href="/components/Archive"
        className="mt-3 inline-flex items-center gap-2 rounded-full bg-blue-600 px-4 py-2 text-xs font-medium text-white hover:bg-blue-700"
      >
        <Archive className="h-3.5 w-3.5" /> View in archive
      </Link>
    );
  } else if (project.stage === "ready_to_archive") {
    if (project.archiveEndorsedAt) {
      title = "Endorsed for archiving.";
      text = "Your instructor forwarded your record and documents to the Super Admin for final verification.";
    } else {
      title = "Final revisions approved.";
      text = "Your instructor will unlock the shared IMRaD process. Start it from My Manuscript when it is available.";
    }
  } else if (project.stage === "final_revisions") {
    if ((project.evaluationForms?.length ?? 0) < 3) {
      title = "Passed with revisions.";
      text = "Your instructor will upload the 3 panel evaluation forms. You'll see them here before you start revising.";
    } else {
      title = "Revise your chapters.";
      text = "Read the panel evaluation forms, then resubmit every chapter. Your instructor will check each one.";
    }
  } else if (project.stage === "chapter_revisions") {
    title = "Updated chapters are under review.";
    text = "Your instructor must approve the latest version of every chapter again before IMRaD submission is unlocked.";
  } else if (project.stage === "defense_scheduled") {
    title = "Your defense is scheduled.";
    text = "Prepare your presentation and bring a copy of the manuscript for every panel member.";
  } else if (project.stage === "endorsed" && project.defenseResult === "failed") {
    title = "Re-defense needed.";
    text = "Your instructor will schedule a new defense date.";
  } else if (project.stage === "endorsed" || progress >= 100) {
    title = "All chapters approved. You're ready for defense!";
    text = "Your instructor will set the defense date, venue and panel.";
  }

  return (
    <div className="mt-4 space-y-3">
      {/* Stepper */}
      <div className="grid grid-cols-5 gap-1.5">
        {STEPS.map((name, i) => {
          const n = i + 1;
          const done = n < step;
          const current = n === step;
          return (
            <div key={name} className="flex flex-col items-center gap-1.5 text-center">
              <div
                className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold ${
                  done
                    ? "bg-green-600 text-white"
                    : current
                      ? "border-2 border-blue-600 text-blue-600"
                      : "bg-muted text-muted-foreground"
                }`}
              >
                {done ? <Check className="h-4 w-4" /> : n}
              </div>
              <p className={`text-[11px] leading-tight ${done || current ? "text-foreground" : "text-muted-foreground"}`}>
                {name}
              </p>
            </div>
          );
        })}
      </div>

      {/* Next step */}
      <div
        className={`rounded-xl border p-4 ${
          project.stage === "archived"
            ? "border-green-200 bg-green-50 dark:border-green-900/50 dark:bg-green-950/30"
            : "bg-muted/30"
        }`}
      >
        <div className="flex items-start gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-100 text-blue-600 dark:bg-blue-900/50 dark:text-blue-300">
            {project.stage === "archived" ? <CheckCircle2 className="h-4 w-4" /> : <ArrowRight className="h-4 w-4" />}
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-blue-600 dark:text-blue-300">{label}</p>
            <p className="text-sm font-semibold text-foreground">{title}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{text}</p>
            {extra}
          </div>
        </div>
      </div>

      {/* Defense details */}
      {project.stage === "defense_scheduled" && (
        <div className="rounded-xl border p-4">
          <p className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <Calendar className="h-4 w-4 text-blue-600" /> Defense details
          </p>
          <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
            {[
              ["Date and time", formatDefense(project.defenseDate)],
              ["Venue", project.defenseVenue ?? "—"],
              ["Panel", project.defensePanel ?? "—"],
            ].map(([k, v]) => (
              <div key={k} className="rounded-lg bg-muted/40 p-3">
                <p className="text-[11px] text-muted-foreground">{k}</p>
                <p className="text-xs font-medium text-foreground">{v}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Result (status only, no grade) */}
      {showResult && project.defenseResult && (
        <div className="rounded-xl border p-4">
          <p className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <CheckCircle2 className="h-4 w-4 text-green-600" /> Defense result
          </p>
          <p className="mt-1 text-xs text-muted-foreground">{RESULT_LABEL[project.defenseResult]}</p>
        </div>
      )}
    </div>
  );
}