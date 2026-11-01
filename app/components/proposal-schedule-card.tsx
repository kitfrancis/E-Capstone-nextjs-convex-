"use client";

import type { Doc } from "@/convex/_generated/dataModel";
import {
  CalendarDays,
  CalendarPlus,
  CheckCircle2,
  Clock,
  Info,
  MapPin,
  RotateCcw,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";

type Project = Doc<"capstoneProjects">;

const PANEL = "mt-5 rounded-2xl border p-4 sm:p-5";
const TILE = "min-w-0 rounded-xl border bg-card p-3";
const TILE_LABEL = "flex items-center gap-1.5 text-xs text-muted-foreground";

// "2026-11-12T09:00" is parsed as a local date-time
function parseSchedule(s?: string) {
  if (!s) return null;
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

function countdown(d: Date) {
  const start = new Date(d);
  start.setHours(0, 0, 0, 0);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const n = Math.round((start.getTime() - today.getTime()) / 86_400_000);
  if (n < 0) return { label: "Date has passed", cls: "bg-muted text-muted-foreground" };
  if (n === 0) return { label: "Today", cls: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300" };
  if (n === 1) return { label: "Tomorrow", cls: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300" };
  return {
    label: `In ${n} days`,
    cls: "bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300",
  };
}

// Local date-time in iCalendar format: 20261104T174600
const icsStamp = (d: Date) => {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}T${p(d.getHours())}${p(d.getMinutes())}00`;
};

function downloadIcs(project: Project, start: Date) {
  const end = new Date(start.getTime() + 60 * 60 * 1000); // assume 1 hour
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//E-Capstone//Proposal Defense//EN",
    "BEGIN:VEVENT",
    `UID:proposal-${project._id}@e-capstone`,
    `DTSTAMP:${icsStamp(new Date())}`,
    `DTSTART:${icsStamp(start)}`,
    `DTEND:${icsStamp(end)}`,
    `SUMMARY:Proposal defense: ${project.teamName}`,
    `LOCATION:${project.proposalVenue ?? ""}`,
    `DESCRIPTION:Panel: ${project.proposalPanel ?? ""}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ];
  const blob = new Blob([lines.join("\r\n")], { type: "text/calendar" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "proposal-defense.ics";
  a.click();
  URL.revokeObjectURL(url);
}

function Header({
  icon: Icon,
  wrap,
  title,
  subtitle,
  pill,
}: {
  icon: typeof CalendarDays;
  wrap: string;
  title: string;
  subtitle: string;
  pill?: { label: string; cls: string };
}) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="flex min-w-0 items-start gap-3">
        <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full ${wrap}`}>
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <h3 className="text-base font-semibold leading-tight text-foreground">{title}</h3>
          <p className="mt-0.5 text-sm text-muted-foreground">{subtitle}</p>
        </div>
      </div>
      {pill && (
        <span
          className={`inline-flex shrink-0 items-center rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap ${pill.cls}`}
        >
          {pill.label}
        </span>
      )}
    </div>
  );
}

/**
 * Student-facing card for the proposal defense.
 * Shows the schedule, a waiting note, or the result. Renders nothing otherwise.
 */
export function ProposalScheduleCard({ project }: { project: Project }) {
  /* ---------- Scheduled ---------- */
  if (project.stage === "proposal_scheduled") {
    const when = parseSchedule(project.proposalDate);
    const dateText = when
      ? when.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })
      : (project.proposalDate ?? "—");
    const timeText = when
      ? when.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })
      : "";
    const panelists = (project.proposalPanel ?? "")
      .split(",")
      .map((p) => p.trim())
      .filter(Boolean);

    return (
      <div className={`${PANEL} border-violet-200 bg-violet-50/60 dark:border-violet-900/60 dark:bg-violet-950/20`}>
        <Header
          icon={CalendarDays}
          wrap="bg-gray-100 text-violet-700 dark:bg-violet-900/50 dark:text-violet-300"
          title="Proposal defense scheduled"
          subtitle="Be ready with your Chapters 1–3 presentation."
          pill={when ? countdown(when) : undefined}
        />

        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <div className={TILE}>
            <p className={TILE_LABEL}>
              <Clock className="h-3.5 w-3.5 shrink-0" /> Date and time
            </p>
            <p className="mt-1 text-sm font-semibold text-foreground">{dateText}</p>
            {timeText && <p className="text-sm text-foreground">{timeText}</p>}
          </div>

          <div className={TILE}>
            <p className={TILE_LABEL}>
              <MapPin className="h-3.5 w-3.5 shrink-0" /> Venue
            </p>
            <p className="mt-1 text-sm font-semibold text-foreground wrap-break-words">
              {project.proposalVenue ?? "—"}
            </p>
          </div>

          <div className={TILE}>
            <p className={TILE_LABEL}>
              <Users className="h-3.5 w-3.5 shrink-0" /> Panel
            </p>
            {panelists.length === 0 ? (
              <p className="mt-1 text-sm font-semibold text-foreground">—</p>
            ) : (
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {panelists.map((p) => (
                  <span
                    key={p}
                    className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-foreground"
                  >
                    {p}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>

        {when && (
          <div className="mt-4 flex justify-end">
            <Button
              size="sm"
              variant="outline"
              className="gap-1.5 rounded-full"
              onClick={() => downloadIcs(project, when)}
            >
              <CalendarPlus className="h-3.5 w-3.5" /> Add to calendar
            </Button>
          </div>
        )}
      </div>
    );
  }

  /* ---------- Waiting for the instructor ---------- */
  if (project.stage === "proposal_endorsed") {
    const failed = project.proposalResult === "failed";
    return (
      <div className={`${PANEL} ${failed ? "border-amber-200 bg-amber-50/60 dark:border-amber-900/60 dark:bg-amber-950/20" : "bg-muted/30"}`}>
        <Header
          icon={failed ? RotateCcw : Info}
          wrap={
            failed
              ? "bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300"
              : "bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300"
          }
          title={failed ? "Proposal re-defense needed" : "Ready for proposal defense"}
          subtitle={
            failed
              ? "Your instructor will schedule a new date. Revise your proposal in the meantime."
              : "Chapters 1–3 are approved. Your instructor will set the date, venue and panel."
          }
          pill={{
            label: "Waiting for schedule",
            cls: "bg-muted text-muted-foreground",
          }}
        />
      </div>
    );
  }

  /* ---------- Proposal result (team is now working on Chapters 4–5) ---------- */
  if (
    !project.stage &&
    (project.proposalResult === "passed" || project.proposalResult === "passed_with_revisions")
  ) {
    const withRevisions = project.proposalResult === "passed_with_revisions";
    return (
      <div className={`${PANEL} border-green-200 bg-green-50/60 dark:border-green-900/60 dark:bg-green-950/20`}>
        <Header
          icon={CheckCircle2}
          wrap="bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300"
          title={withRevisions ? "Proposal passed with revisions" : "Proposal passed"}
          subtitle={
            withRevisions
              ? "Apply the panel's comments, then continue with Chapters 4–5."
              : "You can now continue with Chapters 4–5."
          }
          pill={{
            label: withRevisions ? "Passed with revisions" : "Passed",
            cls: "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300",
          }}
        />
      </div>
    );
  }

  return null;
}