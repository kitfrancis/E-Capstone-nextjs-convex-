"use client";

import { useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Eye, Trash2, Upload } from "lucide-react";

const PDFViewer = dynamic(
  () =>
    import("@/app/components/PDFViewer").then((mod) => ({
      default: mod.PDFViewer,
    })),
  { ssr: false }
);

const COURSES = ["Information Technology", "Computer Science", "BLIS"];

const emptyForm = {
  title: "",
  team: "",
  year: String(new Date().getFullYear()),
  course: COURSES[0],
  grade: "",
  adviser: "",
  members: "",
  keywords: "",
  abstract: "",
};

const splitList = (s: string) =>
  s
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);

export default function AdminArchivePage() {
  const projects = useQuery(api.archive.getAll);
  const generateUploadUrl = useMutation(api.archive.generateUploadUrl);
  const addProject = useMutation(api.archive.addProject);
  const deleteProject = useMutation(api.archive.deleteProject);

  const [search, setSearch] = useState("");
  const [courseFilter, setCourseFilter] = useState("all");
  const [yearFilter, setYearFilter] = useState("all");

  const [showUpload, setShowUpload] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");

  const [viewing, setViewing] = useState<{
    storageId: Id<"_storage">;
    fileName: string;
  } | null>(null);
  const fileUrl = useQuery(
    api.archive.getFileUrl,
    viewing ? { storageId: viewing.storageId } : "skip"
  );

  const years = useMemo(
    () =>
      [...new Set((projects ?? []).map((p) => p.year))].sort((a, b) => b - a),
    [projects]
  );
  const courses = useMemo(
    () => [...new Set((projects ?? []).map((p) => p.course))],
    [projects]
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (projects ?? []).filter((p) => {
      const matchesCourse = courseFilter === "all" || p.course === courseFilter;
      const matchesYear = yearFilter === "all" || String(p.year) === yearFilter;
      const matchesSearch =
        !q ||
        p.title.toLowerCase().includes(q) ||
        p.team.toLowerCase().includes(q) ||
        p.adviser.toLowerCase().includes(q) ||
        p.keywords.some((k) => k.toLowerCase().includes(q));
      return matchesCourse && matchesYear && matchesSearch;
    });
  }, [projects, search, courseFilter, yearFilter]);

  const resetUpload = () => {
    setForm(emptyForm);
    setFile(null);
    setError("");
  };

  const handleOpenChange = (open: boolean) => {
    if (uploading) return;
    setShowUpload(open);
    if (!open) resetUpload();
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) {
      setError("Please choose a PDF file.");
      return;
    }
    setError("");
    setUploading(true);

    try {
      const uploadUrl = await generateUploadUrl();
      const res = await fetch(uploadUrl, {
        method: "POST",
        headers: { "Content-Type": file.type },
        body: file,
      });
      if (!res.ok) throw new Error("File upload failed.");
      const { storageId } = await res.json();

      await addProject({
        title: form.title.trim(),
        team: form.team.trim(),
        year: Number(form.year),
        course: form.course,
        grade: form.grade.trim(),
        adviser: form.adviser.trim(),
        members: splitList(form.members),
        keywords: splitList(form.keywords),
        abstract: form.abstract.trim(),
        storageId,
      });
      setShowUpload(false);
      resetUpload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (id: Id<"projects">, title: string) => {
    if (!window.confirm(`Delete "${title}" and its file? This can't be undone.`))
      return;
    try {
      await deleteProject({ projectId: id });
    } catch (err) {
      alert(err instanceof Error ? err.message : "Delete failed.");
    }
  };

  const setField = (key: keyof typeof emptyForm, value: string) =>
    setForm((f) => ({ ...f, [key]: value }));

  return (
    <div className="space-y-6 p-4 font-Poppins sm:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">
            Archive Management
          </h1>
          <p className="text-sm text-muted-foreground">
            Manage finished capstone and thesis projects in the archive.
          </p>
        </div>
        <Button onClick={() => setShowUpload(true)}>
          <Upload className="mr-2 h-4 w-4" />
          Upload to Archive
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-3 sm:flex-row">
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by title, team, adviser, or keyword"
          className="sm:max-w-sm"
        />
        <Select value={courseFilter} onValueChange={setCourseFilter}>
          <SelectTrigger className="w-full sm:w-52">
            <SelectValue placeholder="All programs" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All programs</SelectItem>
            {courses.map((c) => (
              <SelectItem key={c} value={c}>
                {c}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={yearFilter} onValueChange={setYearFilter}>
          <SelectTrigger className="w-full sm:w-36">
            <SelectValue placeholder="All years" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All years</SelectItem>
            {years.map((y) => (
              <SelectItem key={y} value={String(y)}>
                {y}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <section className="overflow-x-auto rounded-xl border border-border bg-card">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-border text-muted-foreground">
            <tr>
              <th className="px-4 py-3 font-medium">Title</th>
              <th className="px-4 py-3 font-medium">Program</th>
              <th className="px-4 py-3 font-medium">Team</th>
              <th className="px-4 py-3 font-medium">Year</th>
              <th className="px-4 py-3 font-medium">Archived</th>
              <th className="px-4 py-3 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {projects === undefined && (
              <tr>
                <td
                  colSpan={6}
                  className="px-4 py-8 text-center text-muted-foreground"
                >
                  Loading…
                </td>
              </tr>
            )}
            {projects && filtered.length === 0 && (
              <tr>
                <td
                  colSpan={6}
                  className="px-4 py-8 text-center text-muted-foreground"
                >
                  No projects found.
                </td>
              </tr>
            )}
            {filtered.map((p) => (
              <tr key={p._id} className="border-b border-border last:border-0">
                <td className="max-w-xs px-4 py-3 text-foreground">
                  <span className="line-clamp-2">{p.title}</span>
                </td>
                <td className="px-4 py-3 text-muted-foreground">{p.course}</td>
                <td className="px-4 py-3 text-muted-foreground">{p.team}</td>
                <td className="px-4 py-3 text-muted-foreground">{p.year}</td>
                <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">
                  {p.archivedDate}
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      title="View file"
                      disabled={!p.storageId}
                      onClick={() =>
                        p.storageId &&
                        setViewing({ storageId: p.storageId, fileName: p.title })
                      }
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      title="Delete"
                      className="text-red-500 hover:text-red-600"
                      onClick={() => handleDelete(p._id, p.title)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <p className="text-xs text-muted-foreground">
        Showing {filtered.length} of {projects?.length ?? 0} projects
      </p>

      {/* Upload dialog */}
      <Dialog open={showUpload} onOpenChange={handleOpenChange}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <form onSubmit={handleUpload} className="space-y-4">
            <DialogHeader>
              <DialogTitle>Upload to Archive</DialogTitle>
              <DialogDescription>
                Upload a finished capstone or thesis project to the archive.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-2">
              <Label htmlFor="title">Title</Label>
              <Input
                id="title"
                required
                value={form.title}
                onChange={(e) => setField("title", e.target.value)}
                placeholder="Project title"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Program</Label>
                <Select
                  value={form.course}
                  onValueChange={(v) => setField("course", v)}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select program" />
                  </SelectTrigger>
                  <SelectContent>
                    {COURSES.map((c) => (
                      <SelectItem key={c} value={c}>
                        {c}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="year">Academic year</Label>
                <Input
                  id="year"
                  required
                  type="number"
                  value={form.year}
                  onChange={(e) => setField("year", e.target.value)}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="team">Team name</Label>
                <Input
                  id="team"
                  required
                  value={form.team}
                  onChange={(e) => setField("team", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="grade">Grade</Label>
                <Input
                  id="grade"
                  required
                  value={form.grade}
                  onChange={(e) => setField("grade", e.target.value)}
                  placeholder="e.g. A"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="adviser">Adviser</Label>
              <Input
                id="adviser"
                required
                value={form.adviser}
                onChange={(e) => setField("adviser", e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="members">Members (comma-separated)</Label>
              <Input
                id="members"
                required
                value={form.members}
                onChange={(e) => setField("members", e.target.value)}
                placeholder="Juan Dela Cruz, Maria Santos"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="keywords">Keywords (comma-separated)</Label>
              <Input
                id="keywords"
                value={form.keywords}
                onChange={(e) => setField("keywords", e.target.value)}
                placeholder="RFID, Access Control"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="abstract">Abstract</Label>
              <Textarea
                id="abstract"
                required
                rows={4}
                value={form.abstract}
                onChange={(e) => setField("abstract", e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="file">File (PDF)</Label>
              <Input
                id="file"
                type="file"
                accept="application/pdf"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
            </div>

            {error && <p className="text-sm text-red-500">{error}</p>}

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                disabled={uploading}
                onClick={() => handleOpenChange(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={uploading}>
                {uploading ? "Uploading…" : "Upload"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <PDFViewer
        open={!!viewing && !!fileUrl}
        fileUrl={fileUrl ?? ""}
        fileName={viewing?.fileName ?? ""}
        onClose={() => setViewing(null)}
      />
    </div>
  );
}