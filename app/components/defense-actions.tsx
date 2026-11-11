"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Doc, Id } from "@/convex/_generated/dataModel";
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
import { Archive, CalendarDays, CheckCircle2, ClipboardCheck, Circle, FileUp, Loader2 } from "lucide-react";


type Project = Doc<"capstoneProjects">;
type DialogProps = { project: Project; open: boolean; onOpenChange: (o: boolean) => void };

const FIELD =
  "w-full rounded-md border bg-transparent px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40";
const LABEL = "text-xs font-medium text-foreground";
const BLUE = "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300";
const GREEN = "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300";
const AMBER = "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300";
const VIOLET = "bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300";

const formCount = (project: Project) => project.evaluationForms?.length ?? 0;

// "endorse" is gone: the project becomes "Ready for defense" automatically
// (see syncDefenseReadiness in convex/defense.ts):
//   Chapters 1-3 approved -> proposal defense, then every chapter approved -> final defense.
export type DefenseActionKind =
  | "proposal_schedule"
  | "proposal_result"
  | "schedule"
  | "result"
  | "evaluation_forms"
  | "endorse_archive"
  | "archive";

// Which button (if any) this team needs right now
export function defenseActionKind(project: Project, progress: number): DefenseActionKind | null {
  if (project.stage === "proposal_endorsed") return "proposal_schedule";
  if (project.stage === "proposal_scheduled") return "proposal_result";
  if (project.stage === "endorsed") return "schedule";
  if (project.stage === "defense_scheduled") return "result";
  if (project.stage === "final_revisions" && formCount(project) < 3) return "evaluation_forms";
  if (project.stage === "ready_to_archive") {
    return project.archiveEndorsedAt ? "archive" : "endorse_archive";
  }
  return null;
}

// Badge for teams in the defense pipeline. Returns null for teams still in chapters
// so the row can keep showing the normal phase badge.
export function defenseStatus(project: Project, progress: number): { label: string; cls: string } | null {
  switch (project.stage) {
    case "proposal_endorsed":
      return project.proposalResult === "failed"
        ? { label: "Proposal re-defense", cls: AMBER }
        : { label: "Proposal defense", cls: BLUE };
    case "proposal_scheduled":
      return { label: "Proposal scheduled", cls: VIOLET };
    case "endorsed":
      return project.defenseResult === "failed"
        ? { label: "Re-defense needed", cls: AMBER }
        : { label: "Ready for defense", cls: BLUE };
    case "defense_scheduled":
      return { label: "Defense scheduled", cls: BLUE };
    case "final_revisions":
      return formCount(project) < 3
        ? { label: "Awaiting evaluation forms", cls: AMBER }
        : { label: "Final revisions", cls: AMBER };
    case "chapter_revisions":
      return { label: "Chapter review", cls: AMBER };
    case "ready_to_archive":
      return project.archiveEndorsedAt
        ? { label: "Awaiting admin verification", cls: VIOLET }
        : { label: "Ready to archive", cls: GREEN };
    case "archived":
      return { label: "Archived", cls: "bg-muted text-muted-foreground" };
  }
  // 100% but the stage hasn't synced yet: already show it as ready
  if (progress >= 100) return { label: "Ready for defense", cls: BLUE };
  return null;
}

/* ------------------------------ Dialogs ------------------------------ */

// Used for both the proposal defense and the final defense
function ScheduleDialog({
  project,
  open,
  onOpenChange,
  proposal = false,
}: DialogProps & { proposal?: boolean }) {
  const scheduleFinal = useMutation(api.defense.scheduleDefense);
  const scheduleProposal = useMutation(api.defense.scheduleProposalDefense);
  const schedule = proposal ? scheduleProposal : scheduleFinal;

  const current = proposal
    ? { date: project.proposalDate, venue: project.proposalVenue, panel: project.proposalPanel }
    : { date: project.defenseDate, venue: project.defenseVenue, panel: project.defensePanel };

  const [date, setDate] = useState(current.date?.slice(0, 10) ?? "");
  const [time, setTime] = useState(current.date?.slice(11, 16) ?? "");
  const [venue, setVenue] = useState(current.venue ?? "");
  const [panel, setPanel] = useState(current.panel ?? "");
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
          <DialogTitle>{proposal ? "Schedule proposal defense" : "Schedule defense"}</DialogTitle>
          <DialogDescription>
            {proposal
              ? `${project.teamName} finished Chapters 1–3. They will see the date, venue and panel.`
              : `${project.teamName} will see the date, venue and panel.`}
          </DialogDescription>
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
  { value: "passed", title: "Passed", sub: "No changes needed. IMRaD upload opens right away." },
  { value: "passed_with_revisions", title: "Passed with revisions", sub: "Upload the 3 evaluation forms next. The team then submits final revisions." },
  { value: "failed", title: "Failed", sub: "A re-defense will be needed." },
] as const;

const PROPOSAL_RESULTS = [
  { value: "passed", title: "Passed", sub: "The team continues with Chapters 4–5." },
  { value: "passed_with_revisions", title: "Passed with revisions", sub: "The team continues and applies the panel's comments." },
  { value: "failed", title: "Failed", sub: "A proposal re-defense will be needed." },
] as const;

// Used for both the proposal defense and the final defense (status only, no grade)
function ResultDialog({
  project,
  open,
  onOpenChange,
  proposal = false,
}: DialogProps & { proposal?: boolean }) {
  const recordFinal = useMutation(api.defense.recordDefenseResult);
  const recordProposal = useMutation(api.defense.recordProposalResult);
  const [result, setResult] = useState<(typeof RESULTS)[number]["value"]>("passed");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const options = proposal ? PROPOSAL_RESULTS : RESULTS;

  const save = async () => {
    setBusy(true);
    setError("");
    try {
      if (proposal) {
        await recordProposal({ projectId: project._id, result });
      } else {
        await recordFinal({ projectId: project._id, result });
      }
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
          <DialogTitle>{proposal ? "Record proposal defense result" : "Record defense result"}</DialogTitle>
          <DialogDescription>Save the panel&apos;s decision for {project.teamName}.</DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          {options.map((r) => (
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
          {error && <p className="text-xs text-red-500">{error}</p>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={save} disabled={busy} className="gap-2 bg-blue-600 text-white hover:bg-blue-700">
            {busy && <Loader2 className="h-4 w-4 animate-spin" />} Save result
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Instructor uploads the 3 panel evaluation forms
function EvaluationFormsDialog({ project, open, onOpenChange }: DialogProps) {
  const generateUrl = useMutation(api.defense.generateUploadUrl);
  const saveForms = useMutation(api.defense.uploadEvaluationForms);
  const [files, setFiles] = useState<(File | null)[]>([null, null, null]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const valid = files.every(Boolean);

  const setFile = (i: number, f: File | null) =>
    setFiles((prev) => prev.map((p, idx) => (idx === i ? f : p)));

  const save = async () => {
    setBusy(true);
    setError("");
    try {
      const uploaded: { storageId: Id<"_storage">; fileName: string }[] = [];
      for (const file of files) {
        if (!file) continue;
        const url = await generateUrl();
        const res = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": file.type || "application/pdf" },
          body: file,
        });
        if (!res.ok) throw new Error("upload failed");
        uploaded.push({ storageId: (await res.json()).storageId, fileName: file.name });
      }
      await saveForms({ projectId: project._id, files: uploaded });
      onOpenChange(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't upload the forms. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Upload evaluation forms</DialogTitle>
          <DialogDescription>
            Upload the 3 panel evaluation forms. {project.teamName} will see them before starting their final revisions.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="space-y-1.5">
              <label className={LABEL}>Panel member {i + 1}</label>
              <Input
                type="file"
                accept=".pdf,.doc,.docx"
                onChange={(e) => setFile(i, e.target.files?.[0] ?? null)}
              />
            </div>
          ))}
          {error && <p className="text-xs text-red-500">{error}</p>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={save} disabled={!valid || busy} className="gap-2 bg-blue-600 text-white hover:bg-blue-700">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileUp className="h-4 w-4" />} Upload forms
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ArchiveDialog({ project, open, onOpenChange }: DialogProps) {
  const generateUrl = useMutation(api.defense.generateUploadUrl);
  const archive = useMutation(api.defense.archiveProject);
  const [abstract, setAbstract] = useState("");
  const [keywords, setKeywords] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const keywordList = keywords.split(",").map((k) => k.trim()).filter(Boolean);
  const checks = [
    { label: "Abstract", ok: abstract.trim().length > 0 },
    { label: "Keywords (at least 3)", ok: keywordList.length >= 3 },
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
      await archive({ projectId: project._id, abstract, keywords: keywordList, fileId });
      onOpenChange(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't archive the project. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Verify &amp; archive project</DialogTitle>
          <DialogDescription>
            Fill in what the archive needs. {project.teamName} becomes read-only once archived.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <label className={LABEL}>Abstract</label>
            <textarea rows={4} value={abstract} onChange={(e) => setAbstract(e.target.value)} className={FIELD} />
          </div>
          <div className="space-y-1.5">
            <label className={LABEL}>Keywords (comma separated)</label>
            <Input value={keywords} onChange={(e) => setKeywords(e.target.value)} placeholder="thesis, capstone, web" />
          </div>
          <div className="space-y-1.5">
            <label className={LABEL}>Final PDF (optional, uses the approved IMRaD file by default)</label>
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

function EndorseDialog({ project, open, onOpenChange }: DialogProps) {
  const endorse = useMutation(api.defense.endorseForArchiving);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const save = async () => {
    setBusy(true);
    setError("");
    try {
      await endorse({ projectId: project._id });
      onOpenChange(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't endorse this project.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Endorse for archiving</DialogTitle>
          <DialogDescription>
            {project.teamName}&apos;s record and documents will be sent to the Super Admin for final verification.
          </DialogDescription>
        </DialogHeader>
        {error && <p className="text-xs text-red-500">{error}</p>}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={save} disabled={busy} className="gap-2 bg-blue-600 text-white hover:bg-blue-700">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Archive className="h-4 w-4" />}
            Endorse
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ------------------------------- Button ------------------------------- */

type DialogKind = DefenseActionKind;

// The one button a team row shows for its current step. Renders nothing when
// the team has no action (still in chapters, waiting on the student, or archived).
export function DefenseActionButton({ project, progress }: { project: Project; progress: number }) {
  const kind = defenseActionKind(project, progress);
  const [dialog, setDialog] = useState<DialogKind | null>(null);
  const me = useQuery(api.users.getMe);
  const imradStatus = useQuery(
    api.defense.imradStatus,
    project.stage === "ready_to_archive" ? { projectId: project._id } : "skip"
  );
  const syncFinal = useMutation(api.defense.syncFinalRevisions);

  // Final revisions: once every chapter is back at 100%, the server checks that all of them
  // were resubmitted and approved, then unlocks the IMRaD upload.
  useEffect(() => {
    if (project.stage === "final_revisions" && progress >= 100) {
      syncFinal({ projectId: project._id }).catch(() => {});
    }
  }, [project._id, project.stage, progress, syncFinal]);

  if (!kind) return null;
  // Only the instructor endorses (once the IMRaD file is approved); only the admin archives
  if (kind === "endorse_archive" && (me?.role !== "instructor" || imradStatus !== "approved")) return null;
  if (kind === "archive" && me?.role !== "admin") return null;

  const cls = "rounded-full bg-blue-600 px-4 gap-1.5 text-white hover:bg-blue-700";
  const close = (o: boolean) => !o && setDialog(null);

  return (
    <>
      {kind === "proposal_schedule" && (
        <Button size="sm" onClick={() => setDialog("proposal_schedule")} className={cls}>
          <CalendarDays className="h-3.5 w-3.5" />
          {project.proposalResult === "failed" ? "Schedule re-defense" : "Schedule proposal"}
        </Button>
      )}
      {kind === "proposal_result" && (
        <Button size="sm" onClick={() => setDialog("proposal_result")} className={cls}>
          <ClipboardCheck className="h-3.5 w-3.5" /> Record proposal result
        </Button>
      )}
      {kind === "schedule" && (
        <Button size="sm" onClick={() => setDialog("schedule")} className={cls}>
          <CalendarDays className="h-3.5 w-3.5" /> Schedule defense
        </Button>
      )}
      {kind === "result" && (
        <Button size="sm" onClick={() => setDialog("result")} className={cls}>
          <ClipboardCheck className="h-3.5 w-3.5" /> Record result
        </Button>
      )}
      {kind === "evaluation_forms" && (
        <Button size="sm" onClick={() => setDialog("evaluation_forms")} className={cls}>
          <FileUp className="h-3.5 w-3.5" /> Upload evaluation forms
        </Button>
      )}
      {kind === "endorse_archive" && (
        <Button size="sm" onClick={() => setDialog("endorse_archive")} className={cls}>
          <Archive className="h-3.5 w-3.5" /> Endorse for Archiving
        </Button>
      )}
      {kind === "archive" && (
        <Button size="sm" onClick={() => setDialog("archive")} className={cls}>
          <Archive className="h-3.5 w-3.5" /> Verify &amp; Archive
        </Button>
      )}

      {dialog === "proposal_schedule" && <ScheduleDialog project={project} open onOpenChange={close} proposal />}
      {dialog === "proposal_result" && <ResultDialog project={project} open onOpenChange={close} proposal />}
      {dialog === "schedule" && <ScheduleDialog project={project} open onOpenChange={close} />}
      {dialog === "result" && <ResultDialog project={project} open onOpenChange={close} />}
      {dialog === "evaluation_forms" && <EvaluationFormsDialog project={project} open onOpenChange={close} />}
      {dialog === "endorse_archive" && <EndorseDialog project={project} open onOpenChange={close} />}
      {dialog === "archive" && <ArchiveDialog project={project} open onOpenChange={close} />}
    </>
  );
}