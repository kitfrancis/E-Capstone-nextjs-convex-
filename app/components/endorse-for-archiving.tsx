"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { useMutation, useQuery } from "convex/react";
import { toast } from "sonner";
import { Archive, FileText } from "lucide-react";
import { api } from "@/convex/_generated/api";
import type { Doc, Id } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const IMRAD_PHASE = "IMRaD Final";

const PDFViewer = dynamic(
  () => import("@/app/components/PDFViewer").then((mod) => ({ default: mod.PDFViewer })),
  { ssr: false }
);

function ArchiveDialog({
  project,
  onClose,
}: {
  project: Doc<"capstoneProjects">;
  onClose: () => void;
}) {
  const archiveProject = useMutation(api.defense.archiveProject);
  const deliverables = useQuery(api.dashboard.getDeliverables, {
    capstoneProjectId: project._id,
  });

  // Latest IMRaD version the team submitted
  const imrad = deliverables
    ?.filter((d) => d.phase === IMRAD_PHASE)
    .sort((a, b) => b.version - a.version)[0];
  const imradUrl = useQuery(
    api.dashboard.getFileUrl,
    imrad?.storageId ? { storageId: imrad.storageId as Id<"_storage"> } : "skip"
  );

  const [viewingPdf, setViewingPdf] = useState(false);
  const [abstract, setAbstract] = useState("");
  const [keywordsText, setKeywordsText] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const keywords = keywordsText
    .split(",")
    .map((k) => k.trim())
    .filter(Boolean);

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!abstract.trim()) {
      setError("Enter the project abstract.");
      return;
    }
    if (keywords.length < 3) {
      setError("Enter at least 3 keywords, separated by commas.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      await archiveProject({ projectId: project._id, abstract, keywords });
      toast.success(`${project.teamName} was added to the archive.`);
      onClose();
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : "Couldn't archive the project.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader className="pr-8">
          <DialogTitle>Verify and archive</DialogTitle>
          <DialogDescription>
            {project.teamName} — {project.projectTitle}
          </DialogDescription>
        </DialogHeader>

        <form className="space-y-5" onSubmit={submit}>
          <div className="rounded-xl border bg-muted/40 p-3 text-sm">
            {deliverables === undefined ? (
              <p className="text-muted-foreground">Loading the IMRaD file...</p>
            ) : !imrad ? (
              <p className="text-amber-600 dark:text-amber-400">
                No IMRaD file found for this team.
              </p>
            ) : (
              <div className="flex items-center justify-between gap-3">
                <span className="flex min-w-0 items-center gap-2">
                  <FileText className="h-4 w-4 shrink-0" />
                  <span className="truncate">{imrad.fileName}</span>
                </span>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="shrink-0"
                  disabled={!imradUrl}
                  onClick={() => setViewingPdf(true)}
                >
                  View PDF
                </Button>
              </div>
            )}
          </div>

          <div className="space-y-2">
            <label htmlFor="archive-abstract" className="text-sm font-medium">
              Abstract
            </label>
            <Textarea
              id="archive-abstract"
              rows={5}
              value={abstract}
              onChange={(e) => {
                setAbstract(e.target.value);
                setError("");
              }}
              placeholder="Paste the abstract from the final manuscript."
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="archive-keywords" className="text-sm font-medium">
              Keywords
            </label>
            <Input
              id="archive-keywords"
              value={keywordsText}
              onChange={(e) => {
                setKeywordsText(e.target.value);
                setError("");
              }}
              placeholder="e.g. capstone, document management, workflow"
            />
            <p className="text-xs text-muted-foreground">
              Separate with commas. At least 3 ({keywords.length} so far).
            </p>
          </div>

          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" disabled={saving} onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving || !imrad}>
              {saving ? "Archiving..." : "Archive project"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>

    <PDFViewer
      open={viewingPdf && typeof imradUrl === "string" && imradUrl.startsWith("http")}
      fileUrl={imradUrl ?? ""}
      fileName={imrad?.fileName ?? ""}
      deliverableId={imrad?._id}
      onClose={() => setViewingPdf(false)}
    />
    </>
  );
}

export default function EndorsedForArchiving() {
  const projects = useQuery(api.defense.endorsedForArchiving);
  const [selected, setSelected] = useState<Doc<"capstoneProjects"> | null>(null);

  return (
    <section className="space-y-3 rounded-2xl border bg-card p-4 sm:p-5">
      <div>
        <h2 className="text-xl font-semibold text-foreground">Endorsed for archiving</h2>
        <p className="text-sm text-muted-foreground">
          Projects your instructors verified. Check the IMRaD, add the abstract and keywords, then archive.
        </p>
      </div>

      {projects === undefined ? (
        <p className="py-4 text-center text-muted-foreground">Loading...</p>
      ) : projects.length === 0 ? (
        <div className="rounded-2xl border border-dashed py-8 text-center text-muted-foreground">
          No projects are waiting for final verification
        </div>
      ) : (
        <div className="space-y-3">
          {projects.map((project) => (
            <div
              key={project._id}
              className="flex flex-col gap-3 rounded-2xl border p-4 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0">
                <h3 className="truncate text-base font-semibold text-foreground">
                  {project.teamName}
                </h3>
                <p className="truncate text-sm text-muted-foreground">{project.projectTitle}</p>
              </div>
              <Button
                type="button"
                className="gap-2 self-start sm:self-auto"
                onClick={() => setSelected(project)}
              >
                <Archive className="h-4 w-4" /> Verify and archive
              </Button>
            </div>
          ))}
        </div>
      )}

      {selected && <ArchiveDialog project={selected} onClose={() => setSelected(null)} />}
    </section>
  );
}