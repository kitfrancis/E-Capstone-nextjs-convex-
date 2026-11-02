"use client";

import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Doc } from "@/convex/_generated/dataModel";
import { toast } from "sonner";
import { CalendarDays, ClipboardCheck, Loader2 } from "lucide-react";
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

type Project = Doc<"capstoneProjects">;
type Result = "passed" | "passed_with_revisions" | "failed";

const BLUE = "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300";
const AMBER = "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300";
const VIOLET = "bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300";

export function isProposalStage(p: Project) {
  return p.stage === "proposal_endorsed" || p.stage === "proposal_scheduled";
}

/** Badge for the team row while the project is in the proposal-defense stages. */
export function proposalStatus(p: Project): { label: string; cls: string } | null {
  if (p.stage === "proposal_endorsed") {
    return p.proposalResult === "failed"
      ? { label: "Proposal re-defense", cls: AMBER }
      : { label: "Proposal defense", cls: BLUE };
  }
  if (p.stage === "proposal_scheduled") {
    return { label: "Proposal scheduled", cls: VIOLET };
  }
  return null;
}

const RESULT_OPTIONS: { value: Result; label: string; hint: string }[] = [
  { value: "passed", label: "Passed", hint: "The team moves on to Chapters 4–5." },
  {
    value: "passed_with_revisions",
    label: "Passed with revisions",
    hint: "The team moves on and applies the panel's comments.",
  },
  {
    value: "failed",
    label: "Failed",
    hint: "The team goes back to “ready for proposal defense” so you can schedule a re-defense.",
  },
];

function formatSchedule(s?: string) {
  if (!s) return "—";
  const d = new Date(s);
  if (isNaN(d.getTime())) return s;
  const date = d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  const time = d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  return `${date} · ${time}`;
}

const FIELD_LABEL = "text-sm font-medium text-foreground";

export function ProposalDefenseButton({ project }: { project: Project }) {
  const scheduleDefense = useMutation(api.defense.scheduleProposalDefense);
  const recordResult = useMutation(api.defense.recordProposalResult);

  const [mode, setMode] = useState<"schedule" | "result" | null>(null);
  const [date, setDate] = useState("");
  const [venue, setVenue] = useState("");
  const [panel, setPanel] = useState("");
  const [result, setResult] = useState<Result | null>(null);
  const [busy, setBusy] = useState(false);

  const scheduled = project.stage === "proposal_scheduled";

  const openSchedule = () => {
    setDate(project.proposalDate ?? "");
    setVenue(project.proposalVenue ?? "");
    setPanel(project.proposalPanel ?? "");
    setMode("schedule");
  };

  const openResult = () => {
    setResult(null);
    setMode("result");
  };

  const close = () => {
    if (!busy) setMode(null);
  };

  const submitSchedule = async () => {
    if (!date || !venue.trim() || !panel.trim()) {
      toast.error("Date, venue and panel are required.");
      return;
    }
    setBusy(true);
    try {
      await scheduleDefense({ projectId: project._id, date, venue, panel });
      toast.success("Proposal defense scheduled.");
      setMode(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't schedule the defense.");
    } finally {
      setBusy(false);
    }
  };

  const submitResult = async () => {
    if (!result) {
      toast.error("Choose a result first.");
      return;
    }
    setBusy(true);
    try {
      await recordResult({ projectId: project._id, result });
      toast.success(
        result === "failed"
          ? "Result recorded. You can schedule a re-defense."
          : "Result recorded. The team can continue with Chapters 4–5."
      );
      setMode(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't record the result.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <div className="flex min-w-0 flex-1 items-center gap-1 sm:flex-none">
        {scheduled ? (
          <>
            <Button
              size="sm"
              variant="outline"
              onClick={openSchedule}
              title={`${formatSchedule(project.proposalDate)} · ${project.proposalVenue ?? ""}`}
              className="flex-1 rounded-full px-3 sm:flex-none"
            >
              <CalendarDays className="h-3.5 w-3.5" /> Reschedule
            </Button>
            <Button
              size="sm"
              onClick={openResult}
              className="flex-1 rounded-full bg-blue-600 px-4 text-white hover:bg-blue-700 sm:flex-none"
            >
              <ClipboardCheck className="h-3.5 w-3.5" /> Record Result
            </Button>
          </>
        ) : (
          <Button
            size="sm"
            onClick={openSchedule}
            className="flex-1 rounded-full bg-blue-600 px-4 text-white hover:bg-blue-700 sm:flex-none"
          >
            <CalendarDays className="h-3.5 w-3.5" />
            {project.proposalResult === "failed" ? "Schedule Re-defense" : "Schedule Proposal"}
          </Button>
        )}
      </div>

      <Dialog open={mode !== null} onOpenChange={(open) => !open && close()}>
        <DialogContent className="sm:max-w-md">
          {mode === "schedule" && (
            <>
              <DialogHeader>
                <DialogTitle>
                  {scheduled
                    ? "Reschedule proposal defense"
                    : project.proposalResult === "failed"
                      ? "Schedule proposal re-defense"
                      : "Schedule proposal defense"}
                </DialogTitle>
                <DialogDescription>
                  {project.teamName} finished Chapters 1–3. Set the date, venue and panel.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4">
                <div className="space-y-1.5">
                  <label htmlFor="proposal-date" className={FIELD_LABEL}>
                    Date and time
                  </label>
                  <Input
                    id="proposal-date"
                    type="datetime-local"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <label htmlFor="proposal-venue" className={FIELD_LABEL}>
                    Venue
                  </label>
                  <Input
                    id="proposal-venue"
                    placeholder="e.g. Room 302"
                    value={venue}
                    onChange={(e) => setVenue(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <label htmlFor="proposal-panel" className={FIELD_LABEL}>
                    Panel
                  </label>
                  <Input
                    id="proposal-panel"
                    placeholder="e.g. Prof. Santos, Prof. Reyes, Prof. Cruz"
                    value={panel}
                    onChange={(e) => setPanel(e.target.value)}
                  />
                </div>
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={close} disabled={busy} className="rounded-full">
                  Cancel
                </Button>
                <Button
                  onClick={submitSchedule}
                  disabled={busy}
                  className="rounded-full bg-blue-600 text-white hover:bg-blue-700"
                >
                  {busy && <Loader2 className="h-4 w-4 animate-spin" />}
                  {scheduled ? "Save schedule" : "Schedule"}
                </Button>
              </DialogFooter>
            </>
          )}

          {mode === "result" && (
            <>
              <DialogHeader>
                <DialogTitle>Record proposal defense result</DialogTitle>
                <DialogDescription>
                  {project.teamName} · {formatSchedule(project.proposalDate)}
                  {project.proposalVenue ? ` · ${project.proposalVenue}` : ""}
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-2" role="radiogroup" aria-label="Defense result">
                {RESULT_OPTIONS.map((o) => (
                  <button
                    key={o.value}
                    type="button"
                    role="radio"
                    aria-checked={result === o.value}
                    onClick={() => setResult(o.value)}
                    className={`w-full rounded-xl border p-3 text-left transition-colors ${
                      result === o.value
                        ? "border-blue-600 bg-blue-50 dark:bg-blue-950/30"
                        : "hover:bg-muted/50"
                    }`}
                  >
                    <p className="text-sm font-medium text-foreground">{o.label}</p>
                    <p className="text-xs text-muted-foreground">{o.hint}</p>
                  </button>
                ))}
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={close} disabled={busy} className="rounded-full">
                  Cancel
                </Button>
                <Button
                  onClick={submitResult}
                  disabled={busy || !result}
                  className="rounded-full bg-blue-600 text-white hover:bg-blue-700"
                >
                  {busy && <Loader2 className="h-4 w-4 animate-spin" />}
                  Save result
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}