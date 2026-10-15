"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Doc, Id } from "@/convex/_generated/dataModel";
import { computeProgress } from "@/lib/progress";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Archive, ArrowRight, CheckCircle2, Circle, Loader2 } from "lucide-react";

type Project = Doc<"capstoneProjects">;
type DialogProps = { project: Project; open: boolean; onOpenChange: (o: boolean) => void };

const BADGE = "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap";
const FIELD =
  "w-full rounded-md border bg-transparent px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40";
const LABEL = "text-xs font-medium text-foreground";
const BLUE = "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300";
const GREEN = "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300";
const AMBER = "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300";

function statusOf(p: Project, progress: number) {
  switch (p.stage) {
    case "endorsed":
      return p.defenseResult === "failed"
        ? { label: "Re-defense needed", cls: AMBER }
        : { label: "Ready for defense", cls: BLUE };
    case "defense_scheduled":
      return { label: "Defense scheduled", cls: BLUE };
    case "final_revisions":
      return { label: "Final revisions", cls: AMBER };
    case "ready_to_archive":
      return { label: "Ready to archive", cls: GREEN };
    case "archived":
      return { label: "Archived", cls: "bg-muted text-muted-foreground" };
  }
  // 100% but the stage hasn't synced yet: already show it as ready
  if (progress >= 100) return { label: "Ready for defense", cls: BLUE };
  if (progress > 0) return { label: "In Progress", cls: BLUE };
  return { label: "Not Started", cls: "bg-muted text-muted-foreground" };
}

/* ------------------------------ Dialogs ------------------------------ */

function ScheduleDialog({ project, open, onOpenChange }: DialogProps) {
  const schedule = useMutation(api.defense.scheduleDefense);
  const [date, setDate] = useState(project.defenseDate?.slice(0, 10) ?? "");
  const [time, setTime] = useState(project.defenseDate?.slice(11, 16) ?? "");
  const [venue, setVenue] = useState(project.defenseVenue ?? "");
  const [panel, setPanel] = useState(project.defensePanel ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const valid = date && time && venue.trim() && panel.trim();

  const save = async () => {
    setBusy(true);
    setError("");
    try {
      await schedule({ projectId: project._id, date: `${date}T${time}`, venue, panel });
      onOpenChange(false);
    } catch {
      setError("Couldn't save the schedule. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Schedule defense</DialogTitle>
          <DialogDescription>{project.teamName} will see the date, venue and panel.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className={LABEL}>Date</label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <label className={LABEL}>Time</label>
              <Input type="time" value={time} onChange={(e) => setTime(e.target.value)} />
            </div>
          </div>
          <div className="space-y-1.5">
            <label className={LABEL}>Venue</label>
            <Input value={venue} onChange={(e) => setVenue(e.target.value)} placeholder="e.g. CICT Conference Room" />
          </div>
          <div className="space-y-1.5">
            <label className={LABEL}>Panel members</label>
            <Input value={panel} onChange={(e) => setPanel(e.target.value)} placeholder="Dr. Reyes, Prof. Santos, Engr. Lim" />
          </div>
          {error && <p className="text-xs text-red-500">{error}</p>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={save} disabled={!valid || busy} className="gap-2 bg-blue-600 text-white hover:bg-blue-700">
            {busy && <Loader2 className="h-4 w-4 animate-spin" />} Save schedule
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

const RESULTS = [
  { value: "passed", title: "Passed", sub: "No changes needed. Goes straight to archive." },
  { value: "passed_with_revisions", title: "Passed with revisions", sub: "Team must submit final revisions first." },
  { value: "failed", title: "Failed", sub: "A re-defense will be needed." },
] as const;

function ResultDialog({ project, open, onOpenChange }: DialogProps) {
  const record = useMutation(api.defense.recordDefenseResult);
  const [result, setResult] = useState<(typeof RESULTS)[number]["value"]>("passed");
  const [grade, setGrade] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const valid = result === "failed" || grade.trim().length > 0;

  const save = async () => {
    setBusy(true);
    setError("");
    try {
      await record({ projectId: project._id, result, grade: result === "failed" ? undefined : grade });
      onOpenChange(false);
    } catch {
      setError("Couldn't save the result. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Record defense result</DialogTitle>
          <DialogDescription>Save the panel&apos;s decision for {project.teamName}.</DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          {RESULTS.map((r) => (
            <button
              key={r.value}
              type="button"
              onClick={() => setResult(r.value)}
              className={`w-full rounded-lg border p-3 text-left transition-colors ${
                result === r.value ? "border-blue-500 bg-blue-50 dark:bg-blue-950/30" : "hover:bg-muted/50"
              }`}
            >
              <p className="text-sm font-medium text-foreground">{r.title}</p>
              <p className="text-xs text-muted-foreground">{r.sub}</p>
            </button>
          ))}
          {result !== "failed" && (
            <div className="space-y-1.5 pt-1">
              <label className={LABEL}>Final grade</label>
              <Input value={grade} onChange={(e) => setGrade(e.target.value)} placeholder="e.g. A or 1.25" />
            </div>
          )}
          {error && <p className="text-xs text-red-500">{error}</p>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={save} disabled={!valid || busy} className="gap-2 bg-blue-600 text-white hover:bg-blue-700">
            {busy && <Loader2 className="h-4 w-4 animate-spin" />} Save result
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ArchiveDialog({ project, open, onOpenChange }: DialogProps) {
  const generateUrl = useMutation(api.defense.generateUploadUrl);
  const archive = useMutation(api.defense.archiveProject);
  const [grade, setGrade] = useState(project.finalGrade ?? "");
  const [abstract, setAbstract] = useState("");
  const [keywords, setKeywords] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const keywordList = keywords.split(",").map((k) => k.trim()).filter(Boolean);
  const checks = [
    { label: "Grade", ok: grade.trim().length > 0 },
    { label: "Abstract", ok: abstract.trim().length > 0 },
    { label: "Keywords (at least 3)", ok: keywordList.length >= 3 },
    { label: "Final file", ok: !!file || !!project.finalFileId },
  ];
  const valid = checks.every((c) => c.ok);

  const save = async () => {
    setBusy(true);
    setError("");
    try {
      let fileId: Id<"_storage"> | undefined;
      if (file) {
        const url = await generateUrl();
        const res = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": file.type || "application/pdf" },
          body: file,
        });
        if (!res.ok) throw new Error("upload failed");
        fileId = (await res.json()).storageId;
      }
      await archive({ projectId: project._id, grade, abstract, keywords: keywordList, fileId });
      onOpenChange(false);
    } catch {
      setError("Couldn't archive the project. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Archive project</DialogTitle>
          <DialogDescription>
            Fill in what the archive needs. {project.teamName} becomes read-only once archived.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <label className={LABEL}>Grade</label>
            <Input value={grade} onChange={(e) => setGrade(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <label className={LABEL}>Abstract</label>
            <textarea rows={4} value={abstract} onChange={(e) => setAbstract(e.target.value)} className={FIELD} />
          </div>
          <div className="space-y-1.5">
            <label className={LABEL}>Keywords (comma separated)</label>
            <Input value={keywords} onChange={(e) => setKeywords(e.target.value)} placeholder="thesis, capstone, web" />
          </div>
          <div className="space-y-1.5">
            <label className={LABEL}>
              Final manuscript (PDF){project.finalFileId ? " (student already submitted one)" : ""}
            </label>
            <Input type="file" accept="application/pdf" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
          </div>
          <div className="grid grid-cols-2 gap-2 rounded-lg border p-3">
            {checks.map((c) => (
              <p key={c.label} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                {c.ok ? <CheckCircle2 className="h-3.5 w-3.5 text-green-600" /> : <Circle className="h-3.5 w-3.5" />}
                {c.label}
              </p>
            ))}
          </div>
          {error && <p className="text-xs text-red-500">{error}</p>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={save} disabled={!valid || busy} className="gap-2 bg-blue-600 text-white hover:bg-blue-700">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Archive className="h-4 w-4" />} Archive project
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* -------------------------------- Rows -------------------------------- */

function PipelineRow({ project, onViewTeam }: { project: Project; onViewTeam: () => void }) {
  const deliverables = useQuery(api.dashboard.getDeliverables, { capstoneProjectId: project._id });
  const syncReadiness = useMutation(api.defense.syncDefenseReadiness);
  const progress = computeProgress(deliverables ?? []).total;
  const status = statusOf(project, progress);

  const [dialog, setDialog] = useState<"schedule" | "result" | "archive" | null>(null);

  // At 100% the project becomes "Ready for defense" on its own
  useEffect(() => {
    if (!project.stage && progress >= 100) {
      syncReadiness({ projectId: project._id }).catch(() => {});
    }
  }, [project._id, project.stage, progress, syncReadiness]);

  const primary = "rounded-full px-4 gap-1.5 bg-blue-600 text-white hover:bg-blue-700";

  let action;
  if (project.stage === "endorsed") {
    action = <Button size="sm" onClick={() => setDialog("schedule")} className={primary}>Schedule defense</Button>;
  } else if (project.stage === "defense_scheduled") {
    action = <Button size="sm" onClick={() => setDialog("result")} className={primary}>Record result</Button>;
  } else if (project.stage === "ready_to_archive") {
    action = (
      <Button size="sm" onClick={() => setDialog("archive")} className={primary}>
        <Archive className="h-3.5 w-3.5" /> Archive project
      </Button>
    );
  } else if (project.stage === "final_revisions") {
    action = <span className="text-xs text-muted-foreground">Waiting for final manuscript</span>;
  } else if (project.stage === "archived") {
    action = <span className="text-xs text-muted-foreground">Read-only</span>;
  } else if (progress >= 100) {
    // Stage is syncing; the Schedule button appears as soon as it lands
    action = (
      <Button size="sm" disabled className={primary}>
        <Loader2 className="h-3.5 w-3.5 animate-spin" /> Getting ready...
      </Button>
    );
  } else {
    action = (
      <Button size="sm" variant="outline" onClick={onViewTeam} className="rounded-full px-4 gap-1.5">
        View Team <ArrowRight className="h-3.5 w-3.5" />
      </Button>
    );
  }

  return (
    <div className="rounded-2xl border bg-card p-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:gap-5">
        <div className="min-w-0 lg:flex-2">
          <h3 className="truncate text-sm font-semibold text-foreground lg:text-base">{project.teamName}</h3>
          <p className="truncate text-xs text-muted-foreground">{project.projectTitle}</p>
        </div>
        <span className={`${BADGE} ${status.cls} self-start`}>{status.label}</span>
        <div className="flex items-center gap-2 lg:flex-[1.5]">
          <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
            <div
              className={`h-2 rounded-full transition-all duration-500 ${progress >= 100 ? "bg-green-600" : "bg-blue-600"}`}
              style={{ width: `${progress}%` }}
            />
          </div>
          <span className="w-9 text-right text-xs font-semibold text-foreground">{progress}%</span>
        </div>
        <div className="flex justify-end">{action}</div>
      </div>

      {dialog === "schedule" && <ScheduleDialog project={project} open onOpenChange={(o) => !o && setDialog(null)} />}
      {dialog === "result" && <ResultDialog project={project} open onOpenChange={(o) => !o && setDialog(null)} />}
      {dialog === "archive" && <ArchiveDialog project={project} open onOpenChange={(o) => !o && setDialog(null)} />}
    </div>
  );
}

export function DefensePipeline({ onViewTeam }: { onViewTeam: () => void }) {
  const projects = useQuery(api.defense.myInstructorProjects);

  return (
    <div>
      <div className="mb-4">
        <h2 className="text-xl font-semibold text-foreground">Defense pipeline</h2>
        <p className="text-sm text-muted-foreground">Schedule, grade and archive your teams. Teams become ready for defense automatically at 100%.</p>
      </div>
      {projects === undefined ? (
        <p className="text-sm text-muted-foreground animate-pulse">Loading teams...</p>
      ) : projects.length === 0 ? (
        <div className="rounded-2xl border border-dashed bg-card py-8 text-center text-sm text-muted-foreground">
          No teams yet. Create one to get started.
        </div>
      ) : (
        <div className="space-y-3">
          {projects.map((p) => (
            <PipelineRow key={p._id} project={p} onViewTeam={onViewTeam} />
          ))}
        </div>
      )}
    </div>
  );
}