"use client";
import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";

export type EditableProject = {
  _id: Id<"projects">;
  title: string;
  course: string;
  year: number;
  team: string;
  adviser: string;
};

function EditForm({
  project,
  onClose,
}: {
  project: EditableProject;
  onClose: () => void;
}) {
  const updateProject = useMutation(api.archive.updateProject);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    title: project.title,
    course: project.course,
    year: String(project.year),
    team: project.team,
    adviser: project.adviser,
  });

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    const year = Number(form.year);
    if (!Number.isInteger(year) || year < 2000 || year > 2100) {
      toast.error("Enter a valid year.");
      return;
    }
    setSaving(true);
    try {
      await updateProject({
        projectId: project._id,
        title: form.title,
        course: form.course,
        year,
        team: form.team,
        adviser: form.adviser,
      });
      toast.success("Archive details updated.");
      onClose();
    } catch (err) {
      console.error(err);
      toast.error(err instanceof Error ? err.message : "Couldn't save changes.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={save} className="space-y-4">
      <DialogHeader>
        <DialogTitle>Edit archive details</DialogTitle>
        <DialogDescription>
          The file and archived date can't be changed here.
        </DialogDescription>
      </DialogHeader>

      {(
        [
          ["title", "Title"],
          ["course", "Program"],
          ["year", "Year"],
          ["team", "Team"],
          ["adviser", "Adviser"],
        ] as const
      ).map(([k, label]) => (
        <div key={k} className="space-y-2">
          <Label htmlFor={`edit-${k}`}>{label}</Label>
          <Input id={`edit-${k}`} required value={form[k]} onChange={set(k)} />
        </div>
      ))}

      <DialogFooter>
        <Button type="button" variant="outline" disabled={saving} onClick={onClose}>
          Cancel
        </Button>
        <Button type="submit" disabled={saving}>
          {saving ? "Saving…" : "Save changes"}
        </Button>
      </DialogFooter>
    </form>
  );
}

export function EditArchiveDialog({
  project,
  onClose,
}: {
  project: EditableProject | null;
  onClose: () => void;
}) {
  return (
    <Dialog open={!!project} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-lg">
        {project && <EditForm key={project._id} project={project} onClose={onClose} />}
      </DialogContent>
    </Dialog>
  );
}