"use client";
import { useEffect, useMemo, useState } from "react";
import { useMutation, usePaginatedQuery, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import dynamic from "next/dynamic";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "@/components/ui/combobox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import {
  BookOpen,
  CalendarDays,
  Check,
  CheckCircle2,
  Download,
  File,
  FileText,
  Filter,
  GraduationCap,
  Upload,
  Search,
  SearchX,
  Tag,
  User,
  Users,
  X,
} from "lucide-react";

const PDFViewer = dynamic(
  () => import("@/app/components/PDFViewer").then((mod) => ({ default: mod.PDFViewer })),
  { ssr: false }
);

type Project = FunctionReturnType<typeof api.archive.getAll>[number];

const ALL_YEARS = "All Years";
const ALL_DEPARTMENTS = "All Departments";
const IMRAD_PARTS = ["Introduction", "Methodology", "Results", "Discussion"] as const;

// Same tinted-card language as the instructor dashboard (blue / amber / purple / rose).
const TONES = {
  blue: { card: "bg-blue-500/10 border-blue-500/20", icon: "bg-blue-500/15 text-blue-500" },
  green: { card: "bg-emerald-500/10 border-emerald-500/20", icon: "bg-emerald-500/15 text-emerald-500" },
  purple: { card: "bg-purple-500/10 border-purple-500/20", icon: "bg-purple-500/15 text-purple-500" },
  orange: { card: "bg-orange-500/10 border-orange-500/20", icon: "bg-orange-500/15 text-orange-500" },
} as const;

// Each department keeps the same icon color everywhere it appears.
const COURSE_ICON_TONES = [
  "bg-blue-500/15 text-blue-500",
  "bg-purple-500/15 text-purple-500",
  "bg-emerald-500/15 text-emerald-500",
  "bg-orange-500/15 text-orange-500",
  "bg-rose-500/15 text-rose-500",
];

const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((n) => n[0]?.toUpperCase())
    .join("");

const projectKey = (p: Project) => String((p as any).storageId ?? p.title);

function StatCard({
  icon,
  value,
  label,
  tone,
}: {
  icon: React.ReactNode;
  value: number;
  label: string;
  tone: keyof typeof TONES;
}) {
  return (
    <div className={`flex items-center gap-4 rounded-2xl border p-5 ${TONES[tone].card}`}>
      <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full ${TONES[tone].icon}`}>
        {icon}
      </div>
      <div>
        <p className="text-3xl font-semibold leading-none text-foreground">{value}</p>
        <p className="mt-1.5 text-sm text-muted-foreground">{label}</p>
      </div>
    </div>
  );
}

function ArchiveSkeleton() {
  return (
    <div className="animate-pulse space-y-6 mt-10 px-1">
      <div className="h-36 rounded-2xl bg-muted" />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-24 rounded-2xl bg-muted" />
        ))}
      </div>
      <div className="h-40 rounded-2xl bg-muted" />
      <div className="h-32 rounded-2xl bg-muted" />
      <div className="h-32 rounded-2xl bg-muted" />
    </div>
  );
}

export default function Archive() {
  const me = useQuery(api.users.getMe);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [detailOpen, setDetailOpen] = useState(false); // modal, mobile + tablet only
  const [submitDetailsOpen, setSubmitDetailsOpen] = useState(false);
  const [submissionSuccessOpen, setSubmissionSuccessOpen] = useState(false);
  const [panelEvaluations, setPanelEvaluations] = useState<(File | null)[]>([null, null, null]);
  const [confirmedPanelEvaluations, setConfirmedPanelEvaluations] = useState([false, false, false]);
  const [previewingPanel, setPreviewingPanel] = useState<{
    index: number;
    fileUrl: string;
    fileName: string;
  } | null>(null);
  const [submissionDescription, setSubmissionDescription] = useState("");
  const [submissionNotice, setSubmissionNotice] = useState("");
  const [selectedImradProjectId, setSelectedImradProjectId] = useState("");
  const [submittingImradDetails, setSubmittingImradDetails] = useState(false);
  const [viewingFile, setViewingFile] = useState<{ storageId: string; fileName: string } | null>(null);

  useEffect(() => {
    return () => {
      if (previewingPanel) URL.revokeObjectURL(previewingPanel.fileUrl);
    };
  }, [previewingPanel]);

  const [query, setQuery] = useState("");
  const [year, setYear] = useState<string>(ALL_YEARS);
  const [department, setDepartment] = useState<string>(ALL_DEPARTMENTS);

  const archiveFileUrl = useQuery(
    api.archive.getFileUrl,
    viewingFile ? { storageId: viewingFile.storageId as Id<"_storage"> } : "skip"
  );
  const projectsData = useQuery(api.archive.getAll);
  const { results: imradReadyProjects, status: imradReadyStatus, loadMore: loadMoreImradReady } =
    usePaginatedQuery(api.defense.myImradReadyProjects, {}, { initialNumItems: 50 });
  const imradSubmissions = useQuery(api.imrad.myInstructorSubmissions);
  const generateEvaluationUploadUrl = useMutation(api.imrad.generateEvaluationUploadUrl);
  const submitPanelEvaluations = useMutation(api.imrad.submitPanelEvaluations);
  const allPanelEvaluationsConfirmed = panelEvaluations.every(
    (file, index) => file !== null && confirmedPanelEvaluations[index]
  );

  const projects = useMemo(() => projectsData ?? [], [projectsData]);
  const isInstructor = me?.role === "instructor";
  const imradSubmissionByProject = new Map(
    (imradSubmissions ?? []).map((submission) => [submission.projectId, submission])
  );
  const availableImradProjects = imradReadyProjects.filter(
    (project) => {
      const submission = imradSubmissionByProject.get(project.projectId);
      return !submission || submission.status === "rejected";
    }
  );

  const uniqueCourses = useMemo(() => [...new Set(projects.map((p) => p.course))], [projects]);
  const uniqueYears = useMemo(() => [...new Set(projects.map((p) => String(p.year)))].sort().reverse(), [projects]);
  const uniqueKeywords = useMemo(() => [...new Set(projects.flatMap((p) => p.keywords))], [projects]);

  const yearOptions = useMemo(() => [ALL_YEARS, ...uniqueYears], [uniqueYears]);
  const departmentOptions = useMemo(() => [ALL_DEPARTMENTS, ...uniqueCourses], [uniqueCourses]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return projects.filter((p) => {
      if (year !== ALL_YEARS && String(p.year) !== year) return false;
      if (department !== ALL_DEPARTMENTS && p.course !== department) return false;
      if (!q) return true;
      return [p.title, p.team, p.abstract, p.adviser, ...p.keywords, ...p.members].some((field) =>
        String(field).toLowerCase().includes(q)
      );
    });
  }, [projects, query, year, department]);

  const hasFilters = query.trim() !== "" || year !== ALL_YEARS || department !== ALL_DEPARTMENTS;
  const clearFilters = () => {
    setQuery("");
    setYear(ALL_YEARS);
    setDepartment(ALL_DEPARTMENTS);
  };

  const handleSubmitDetails = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const projectId = selectedImradProjectId as Id<"capstoneProjects">;
    if (!imradReadyProjects.some((project) => project.projectId === projectId)) {
      setSubmissionNotice("Select an accepted team that is ready for IMRAD processing.");
      return;
    }
    if (panelEvaluations.some((file) => !file)) {
      setSubmissionNotice("Please choose a PDF for each panel.");
      return;
    }
    if (!allPanelEvaluationsConfirmed) {
      setSubmissionNotice("Preview and confirm all three panel evaluation PDFs before submitting.");
      return;
    }
    if (panelEvaluations.some((file) => file && file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf"))) {
      setSubmissionNotice("Each panel evaluation must be a PDF file.");
      return;
    }
    if (!submissionDescription.trim()) {
      setSubmissionNotice("Add details about the final evaluations.");
      return;
    }

    setSubmittingImradDetails(true);
    setSubmissionNotice("");
    try {
      const evaluationFiles: { storageId: Id<"_storage">; fileName: string }[] = [];
      for (const file of panelEvaluations) {
        if (!file) continue;
        const uploadUrl = await generateEvaluationUploadUrl();
        const response = await fetch(uploadUrl, {
          method: "POST",
          headers: { "Content-Type": file.type || "application/pdf" },
          body: file,
        });
        if (!response.ok) throw new Error(`Couldn't upload ${file.name}.`);
        const result = (await response.json()) as { storageId: Id<"_storage"> };
        evaluationFiles.push({ storageId: result.storageId, fileName: file.name });
      }

      await submitPanelEvaluations({
        projectId,
        evaluationFiles,
        description: submissionDescription,
      });
      setPanelEvaluations([null, null, null]);
      setConfirmedPanelEvaluations([false, false, false]);
      setSubmissionDescription("");
      setSelectedImradProjectId("");
      setSubmissionNotice("Panel evaluations submitted to the admin for IMRAD processing.");
      setSubmitDetailsOpen(false);
      setSubmissionSuccessOpen(true);
    } catch (error) {
      console.error("Failed to submit IMRAD evaluation details:", error);
      setSubmissionNotice(
        error instanceof Error ? error.message : "Couldn't submit the evaluation details."
      );
    } finally {
      setSubmittingImradDetails(false);
    }
  };

  if (projectsData === undefined) return <ArchiveSkeleton />;

  const courseTone = (course: string) =>
    COURSE_ICON_TONES[Math.max(0, uniqueCourses.indexOf(course)) % COURSE_ICON_TONES.length];

  // lg (1024px+) shows the side detail panel; below that (mobile + tablet) we open the modal.
  const openProject = (project: Project) => {
    setSelectedProject(project);
    const isDesktop = window.matchMedia("(min-width: 1024px)").matches;
    if (!isDesktop) setDetailOpen(true);
  };

  const handleDownload = (project: Project) => {
    const line = "=".repeat(60);
    const content = `
PROJECT ARCHIVE - ${project.title}
${line}

TEAM: ${project.team}
YEAR: ${project.year}
COURSE: ${project.course}
ADVISER: ${project.adviser}
GRADE: ${project.grade}
ARCHIVED DATE: ${project.archivedDate}

${line}
ABSTRACT
${line}
${project.abstract}

${line}
KEYWORDS
${line}
${project.keywords.join(", ")}

${line}
TEAM MEMBERS
${line}
${project.members.map((m: string, i: number) => `${i + 1}. ${m}`).join("\n")}
  `.trim();

    const blob = new Blob([content], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${project.title.replace(/\s+/g, "_")}_Archive.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Detail content shared by the desktop side panel and the mobile/tablet modal.
  const detailBody = selectedProject && (
    <div className="mt-5 space-y-6 pb-2">
      {/* Quick facts */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {[
          { icon: GraduationCap, label: "Course", value: selectedProject.course },
          { icon: User, label: "Adviser", value: selectedProject.adviser },
          { icon: CalendarDays, label: "Archived", value: selectedProject.archivedDate },
        ].map(({ icon: Icon, label, value }) => (
          <div key={label} className="rounded-xl bg-muted p-3">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Icon className="h-3.5 w-3.5" />
              {label}
            </div>
            <p className="mt-1 text-sm font-medium text-foreground">{value}</p>
          </div>
        ))}
      </div>

      <section>
        <h2 className="mb-2 text-sm font-semibold text-foreground">Abstract</h2>
        <p className="text-sm leading-relaxed text-muted-foreground">{selectedProject.abstract}</p>
      </section>

      <section>
        <h2 className="mb-2 text-sm font-semibold text-foreground">Keywords</h2>
        <div className="flex flex-wrap gap-2">
          {selectedProject.keywords.map((keyword: string, i: number) => (
            <button
              key={i}
              type="button"
              onClick={() => {
                setQuery(keyword);
                setDetailOpen(false);
              }}
              className="rounded-full bg-muted px-3 py-1 text-xs font-medium text-foreground transition-colors hover:bg-primary hover:text-primary-foreground"
              title={`Search for "${keyword}"`}
            >
              {keyword}
            </button>
          ))}
        </div>
      </section>

      <section>
        <h2 className="mb-2 text-sm font-semibold text-foreground">
          Team members <span className="font-normal text-muted-foreground">({selectedProject.members.length})</span>
        </h2>
        <ul className="space-y-2">
          {selectedProject.members.map((member: string, i: number) => (
            <li key={i} className="flex items-center gap-3">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/15 text-xs font-semibold text-primary">
                {initials(member)}
              </span>
              <span className="text-sm text-foreground">{member}</span>
            </li>
          ))}
        </ul>
      </section>

      <div className="flex flex-col gap-2 border-t border-border pt-5">
        <Button
          className="w-full"
          onClick={() => {
            setDetailOpen(false); // close the modal first so it doesn't fight the PDF viewer for focus
            setViewingFile({
              storageId: (selectedProject as any).storageId,
              fileName: selectedProject.title,
            });
          }}
        >
          <File className="mr-2 h-4 w-4" />
          View project files
        </Button>
        <Button variant="outline" className="w-full" onClick={() => handleDownload(selectedProject)}>
          <Download className="mr-2 h-4 w-4" />
          Download summary
        </Button>
      </div>
    </div>
  );

  return (
    <>
      <div className="scroll-smooth font-Poppins">
        <div className="lg:ml-1 space-y-6 pb-10">
          {/* Hero */}
          <div className="mt-6 rounded-2xl border border-blue-500/20 bg-linear-to-br from-blue-500/15 via-blue-500/5 to-transparent p-6 md:p-8">
            <h1 className="text-3xl font-semibold text-foreground">Project Archive</h1>
            <p className="mt-2 max-w-xl text-muted-foreground">
              Browse completed thesis and capstone projects. Search by title, keyword, adviser, or team member.
            </p>
          </div>

          {/* Imrad Processing is available only in the instructor archive. */}
          {isInstructor && (
            <section className="space-y-6">
              <div className="flex flex-col gap-4 rounded-2xl border border-purple-500/20 bg-linear-to-br from-purple-500/15 via-purple-500/5 to-transparent p-6 sm:flex-row sm:items-center sm:justify-between md:p-8">
                <div>
                  <h2 className="text-3xl font-semibold text-foreground">Imrad Processing</h2>
                  <p className="mt-2 text-muted-foreground">
                    Teams accepted after defense are ready for IMRAD processing.
                  </p>
                </div>
                <Button type="button" onClick={() => setSubmitDetailsOpen(true)}>
                  Submit Details
                </Button>
              </div>

              {imradReadyStatus === "LoadingFirstPage" ? (
                <p className="py-6 text-center text-sm text-muted-foreground">Loading accepted teams...</p>
              ) : imradReadyProjects.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-border px-6 py-10 text-center text-sm text-muted-foreground">
                  No teams have been accepted for IMRAD processing yet.
                </div>
              ) : (
                <div className="space-y-3">
                {imradReadyProjects.map((item) => {
                  const submissionStatus = imradSubmissionByProject.get(item.projectId);
                  const completedParts = submissionStatus?.completedParts ?? [];
                  const completedPartCount = completedParts.length;
                  return (
                  <article
                    key={item.projectId}
                    className={`rounded-2xl border border-border bg-card p-5 ${
                      submissionStatus?.status === "processing" ? "space-y-5" : ""
                    }`}
                  >
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                      <div className="flex min-w-0 items-start gap-4">
                        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-purple-500/15 text-purple-500">
                          <BookOpen className="h-5 w-5" />
                        </div>
                        <div className="min-w-0">
                          <h3 className="font-semibold text-foreground">{item.projectTitle}</h3>
                          <p className="mt-1 text-sm text-muted-foreground">
                            {item.teamName} • {new Date(item.acceptedAt).getFullYear()}
                          </p>
                          {submissionStatus?.status === "processing" && (
                            <p className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
                              <FileText className="h-4 w-4 shrink-0" />
                              <span className="truncate">
                                {submissionStatus.workingDocumentFileName ??
                                  `${item.teamName} - IMRAD Conversion Guide.pdf`}
                              </span>
                            </p>
                          )}
                        </div>
                      </div>
                      <span className={`inline-flex w-fit shrink-0 items-center rounded-full px-3 py-1 text-xs font-medium ${
                        submissionStatus?.status === "rejected"
                          ? "border border-red-500/25 bg-red-500/10 text-red-600 dark:text-red-400"
                          : submissionStatus
                            ? "border border-emerald-500/25 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                            : "border border-blue-500/25 bg-blue-500/10 text-blue-600 dark:text-blue-400"
                      }`}>
                        {submissionStatus?.status === "processing"
                          ? "Processing"
                          : submissionStatus?.status === "submitted"
                            ? "Submitted to admin"
                            : submissionStatus?.status === "rejected"
                              ? "Rejected — resubmission required"
                              : "Accepted"}
                      </span>
                    </div>
                    {submissionStatus?.status === "processing" && (
                      <div
                        className="space-y-3"
                        role="group"
                        aria-label={`IMRAD progress for ${item.teamName}: Part ${completedPartCount} of 4`}
                      >
                        <div className="flex items-end justify-between gap-3">
                          <p className="text-sm text-muted-foreground">
                            {completedPartCount} of 4 parts completed
                          </p>
                          <p
                            role="progressbar"
                            aria-label="IMRAD parts completed"
                            aria-valuemin={0}
                            aria-valuemax={4}
                            aria-valuenow={completedPartCount}
                            aria-valuetext={`Part ${completedPartCount} of 4`}
                            className="text-2xl font-bold leading-none text-foreground"
                          >
                            Part {completedPartCount}/4
                          </p>
                        </div>
                        <div
                          className="mt-4 gap-1.5"
                          style={{
                            display: "grid",
                            gridTemplateColumns: `repeat(${IMRAD_PARTS.length}, minmax(0, 1fr))`,
                          }}
                          aria-hidden="true"
                        >
                          {IMRAD_PARTS.map((part, index) => (
                            <div
                              key={part}
                              className="h-2.5 rounded-full bg-muted transition-colors"
                              style={{
                                backgroundColor: completedParts.includes(index + 1)
                                  ? "#10b981"
                                  : undefined,
                              }}
                            />
                          ))}
                        </div>
                        <ol
                          className="mt-4 list-none p-0"
                          style={{
                            display: "grid",
                            gridTemplateColumns: `repeat(${IMRAD_PARTS.length}, minmax(0, 1fr))`,
                          }}
                        >
                          {IMRAD_PARTS.map((part, index) => {
                            const isComplete = completedParts.includes(index + 1);
                            return (
                              <li
                                key={part}
                                className="flex min-w-0 flex-col items-center gap-1.5 text-center"
                              >
                                <span
                                  className={`flex h-8 w-8 items-center justify-center rounded-full ${
                                    isComplete ? "text-white" : "bg-muted text-muted-foreground"
                                  }`}
                                  style={{
                                    backgroundColor: isComplete ? "#059669" : undefined,
                                  }}
                                >
                                  {isComplete && <Check className="h-5 w-5" aria-hidden="true" />}
                                </span>
                                <span
                                  className="text-sm font-medium leading-tight text-muted-foreground"
                                  style={{
                                    color: isComplete ? "#10b981" : undefined,
                                  }}
                                >
                                  {part}
                                </span>
                                <span className="text-xs text-muted-foreground">
                                  Part {index + 1}
                                </span>
                              </li>
                            );
                          })}
                        </ol>
                      </div>
                    )}
                    {submissionStatus?.status === "rejected" && submissionStatus.rejectionMessage && (
                      <p className="mt-2 text-sm text-destructive">
                        Admin feedback: {submissionStatus.rejectionMessage}
                      </p>
                    )}
                    {submissionStatus?.status === "rejected" && (
                      <Button
                        type="button"
                        variant="outline"
                        className="mt-3"
                        onClick={() => {
                          setSelectedImradProjectId(item.projectId);
                          setSubmitDetailsOpen(true);
                        }}
                      >
                        Resubmit Details
                      </Button>
                    )}
                  </article>
                );
                })}
                {imradReadyStatus === "CanLoadMore" && (
                  <div className="flex justify-center">
                    <Button type="button" variant="outline" onClick={() => loadMoreImradReady(50)}>
                      Load more accepted teams
                    </Button>
                  </div>
                )}
                </div>
              )}
            </section>
          )}

          {/* Stats */}
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <StatCard tone="blue" value={projects.length} label="Total projects" icon={<FileText className="h-5 w-5" />} />
            <StatCard tone="green" value={uniqueYears.length} label="Academic years" icon={<CalendarDays className="h-5 w-5" />} />
            <StatCard tone="purple" value={uniqueKeywords.length} label="Unique keywords" icon={<Tag className="h-5 w-5" />} />
            <StatCard tone="orange" value={uniqueCourses.length} label="Departments" icon={<Users className="h-5 w-5" />} />
          </div>

          {/* Search & Filter */}
          <div className="rounded-2xl border border-border bg-card p-4 md:p-5">
            <div className="flex flex-col gap-3 md:flex-row md:items-end">
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search by title, keyword, abstract, or team name..."
                  className="h-10 pl-9 pr-9"
                  aria-label="Search projects"
                />
                {query && (
                  <button
                    type="button"
                    onClick={() => setQuery("")}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    aria-label="Clear search"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:flex md:w-auto">
                <Combobox items={yearOptions} value={year} onValueChange={(v) => setYear(v ?? ALL_YEARS)}>
                  <ComboboxInput placeholder="Year" aria-label="Filter by year" />
                  <ComboboxContent>
                    <ComboboxEmpty>No items found.</ComboboxEmpty>
                    <ComboboxList>
                      {(item) => (
                        <ComboboxItem key={item} value={item}>
                          {item}
                        </ComboboxItem>
                      )}
                    </ComboboxList>
                  </ComboboxContent>
                </Combobox>

                <Combobox
                  items={departmentOptions}
                  value={department}
                  onValueChange={(v) => setDepartment(v ?? ALL_DEPARTMENTS)}
                >
                  <ComboboxInput placeholder="Department" aria-label="Filter by department" />
                  <ComboboxContent>
                    <ComboboxEmpty>No items found.</ComboboxEmpty>
                    <ComboboxList>
                      {(item) => (
                        <ComboboxItem key={item} value={item}>
                          {item}
                        </ComboboxItem>
                      )}
                    </ComboboxList>
                  </ComboboxContent>
                </Combobox>
              </div>

              <Button variant="outline" className="h-10" onClick={clearFilters} disabled={!hasFilters}>
                <Filter className="mr-2 h-4 w-4" />
                Clear filters
              </Button>
            </div>

            <p className="mt-3 text-sm text-muted-foreground">
              Showing {filtered.length} of {projects.length} projects
            </p>
          </div>

          {/* Projects + Detail */}
          <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-2">
            <div>
              <h2 className="mb-1 text-xl font-semibold text-foreground">Projects</h2>
              <p className="mb-4 text-sm text-muted-foreground">Select a project to see its full details.</p>

              <div className="space-y-3">
                {filtered.length === 0 ? (
                  <div className="flex flex-col items-center rounded-2xl border border-dashed border-border px-6 py-12 text-center">
                    <SearchX className="mb-3 h-10 w-10 text-muted-foreground" />
                    <p className="font-medium text-foreground">No projects match your search</p>
                    <p className="mt-1 text-sm text-muted-foreground">Try a different keyword or clear the filters.</p>
                    {hasFilters && (
                      <Button variant="outline" size="sm" className="mt-4" onClick={clearFilters}>
                        Clear filters
                      </Button>
                    )}
                  </div>
                ) : (
                  filtered.map((project) => {
                    const isSelected = !!selectedProject && projectKey(selectedProject) === projectKey(project);
                    return (
                      <div
                        key={projectKey(project)}
                        role="button"
                        tabIndex={0}
                        onClick={() => openProject(project)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            openProject(project);
                          }
                        }}
                        className={`cursor-pointer rounded-2xl border bg-card p-4 transition-colors hover:border-blue-500/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:p-5 ${
                          isSelected ? "border-blue-500 bg-blue-500/5" : "border-border"
                        }`}
                      >
                        <div className="flex items-start gap-4">
                          <div
                            className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full ${courseTone(project.course)}`}
                          >
                            <BookOpen className="h-5 w-5" />
                          </div>

                          <div className="min-w-0 flex-1">
                            <div className="flex items-start justify-between gap-3">
                              <h3 className="text-base font-semibold text-foreground">{project.title}</h3>
                              <span className="inline-flex h-6 shrink-0 items-center rounded-md border border-border px-2 text-xs font-medium text-foreground">
                                {project.grade}
                              </span>
                            </div>
                            <p className="mt-0.5 text-sm text-muted-foreground">
                              {project.team} • {project.year}
                            </p>

                            <p className="mt-3 line-clamp-2 text-sm text-muted-foreground">{project.abstract}</p>

                            <div className="mt-3 flex flex-wrap gap-1.5">
                              {project.keywords.slice(0, 4).map((keyword: string, i: number) => (
                                <span
                                  key={i}
                                  className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-foreground"
                                >
                                  {keyword}
                                </span>
                              ))}
                              {project.keywords.length > 4 && (
                                <span className="px-1 py-0.5 text-xs text-muted-foreground">
                                  +{project.keywords.length - 4} more
                                </span>
                              )}
                            </div>

                            <p className="mt-3 text-xs text-muted-foreground">
                              {project.course} • Archived {project.archivedDate}
                            </p>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Detail panel (desktop only: hidden below lg, where the modal is used instead) */}
            <div className="hidden lg:block lg:sticky lg:top-24 min-w-0">
              <div className="max-h-[calc(100vh-7rem)] overflow-y-auto rounded-2xl border border-border bg-card p-6">
                {selectedProject ? (
                  <>
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <h2 className="text-lg font-semibold text-foreground">{selectedProject.title}</h2>
                        <p className="mt-0.5 text-sm text-muted-foreground">
                          {selectedProject.team} • {selectedProject.year}
                        </p>
                      </div>
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary text-sm font-semibold text-primary-foreground">
                        {selectedProject.grade}
                      </span>
                    </div>
                    {detailBody}
                  </>
                ) : (
                  <div className="flex flex-col items-center py-12 text-center">
                    <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-muted">
                      <FileText className="h-7 w-7 text-muted-foreground" />
                    </div>
                    <p className="font-medium text-foreground">No project selected</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Choose a project from the list to read its abstract and open its files.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      <Dialog open={detailOpen && !!selectedProject} onOpenChange={setDetailOpen}>
        <DialogContent className="max-h-[95vh] overflow-y-auto lg:hidden">
          {selectedProject && (
            <>
              <DialogHeader className="pr-6 text-left">
                <DialogTitle className="text-lg font-semibold">{selectedProject.title}</DialogTitle>
                <DialogDescription>
                  {selectedProject.team} • {selectedProject.year} • Grade {selectedProject.grade}
                </DialogDescription>
              </DialogHeader>
              {detailBody}
            </>
          )}
        </DialogContent>
      </Dialog>

      <Dialog
        open={isInstructor && submitDetailsOpen}
        onOpenChange={(open) => {
          setSubmitDetailsOpen(open);
          if (!open) setSubmissionNotice("");
        }}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
          <DialogHeader className="pr-8">
            <DialogTitle className="text-lg font-semibold">Submit Details</DialogTitle>
            <DialogDescription>
              Upload the final evaluation PDF from each of the three defense panelists, then add a description.
            </DialogDescription>
          </DialogHeader>

          <form className="space-y-5" onSubmit={handleSubmitDetails}>
            <div className="space-y-2">
              <label htmlFor="imrad-ready-project" className="text-sm font-medium text-foreground">
                Accepted team ready for IMRAD
              </label>
              <select
                id="imrad-ready-project"
                required
                value={selectedImradProjectId}
                onChange={(event) => {
                  setSelectedImradProjectId(event.target.value);
                  setSubmissionNotice("");
                }}
                disabled={availableImradProjects.length === 0}
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground disabled:opacity-60"
              >
                <option value="" disabled>
                  {availableImradProjects.length > 0
                    ? "Select an accepted team"
                    : "No unsubmitted accepted teams"}
                </option>
                {availableImradProjects.map((project) => (
                  <option key={project.projectId} value={project.projectId}>
                    {project.teamName} — {project.projectTitle}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              {panelEvaluations.map((file, index) => (
                <div key={index} className="space-y-2">
                  <label htmlFor={`panel-evaluation-${index}`} className="text-sm font-medium text-foreground">
                    Panel {index + 1} final evaluation
                  </label>
                  <div className="rounded-xl border border-dashed border-border bg-muted/40 p-4">
                    <Upload className="mb-2 h-5 w-5 text-muted-foreground" />
                    <p className="mb-3 truncate text-xs text-muted-foreground">
                      {file?.name ?? "Choose a PDF file"}
                    </p>
                    <Input
                      id={`panel-evaluation-${index}`}
                      type="file"
                      accept="application/pdf,.pdf"
                      aria-label={`Upload panel ${index + 1} final evaluation PDF`}
                      className="h-auto cursor-pointer px-2 py-2 text-xs file:mr-2 file:rounded file:border-0 file:bg-primary file:px-2 file:py-1 file:text-primary-foreground"
                      onChange={(event) => {
                        const selectedFile = event.currentTarget.files?.[0] ?? null;
                        if (!selectedFile) return;
                        setPanelEvaluations((current) =>
                          current.map((currentFile, fileIndex) => fileIndex === index ? selectedFile : currentFile)
                        );
                        setConfirmedPanelEvaluations((current) =>
                          current.map((confirmed, fileIndex) =>
                            fileIndex === index ? false : confirmed
                          )
                        );
                        setSubmissionNotice("");
                      }}
                    />
                    {file && (
                      <p className="mt-2 text-xs text-muted-foreground">
                        Choose another PDF above to replace this panel&apos;s file.
                      </p>
                    )}
                    {file && (
                      <div className="mt-3 space-y-2">
                        <Button
                          type="button"
                          variant="outline"
                          className="w-full"
                          disabled={
                            file.type !== "application/pdf" &&
                            !file.name.toLowerCase().endsWith(".pdf")
                          }
                          onClick={() => {
                            setPreviewingPanel({
                              index,
                              fileUrl: URL.createObjectURL(file),
                              fileName: file.name,
                            });
                          }}
                        >
                          Preview Panel {index + 1} PDF
                        </Button>
                        <p
                          className={`flex items-center gap-1 text-xs ${
                            confirmedPanelEvaluations[index]
                              ? "text-emerald-600 dark:text-emerald-400"
                              : "text-muted-foreground"
                          }`}
                        >
                          {confirmedPanelEvaluations[index] ? (
                            <>
                              <CheckCircle2 className="h-3.5 w-3.5" />
                              Preview confirmed
                            </>
                          ) : (
                            "Preview and confirm this PDF before submitting."
                          )}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <div className="space-y-2">
              <label htmlFor="imrad-description" className="text-sm font-medium text-foreground">
                Description
              </label>
              <Textarea
                id="imrad-description"
                value={submissionDescription}
                onChange={(event) => {
                  setSubmissionDescription(event.target.value);
                  setSubmissionNotice("");
                }}
                placeholder="Add details about the final evaluations..."
                rows={4}
                required
              />
            </div>

            {submissionNotice && (
              <p role="status" className="text-sm text-muted-foreground">
                {submissionNotice}
              </p>
            )}

            <div className="flex justify-end">
              <Button
                type="submit"
                disabled={
                  submittingImradDetails ||
                  availableImradProjects.length === 0 ||
                  !allPanelEvaluationsConfirmed
                }
              >
                {submittingImradDetails ? "Submitting..." : "Submit"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={isInstructor && submissionSuccessOpen}
        onOpenChange={setSubmissionSuccessOpen}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader className="items-center text-center">
            <div className="mb-2 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="h-8 w-8" />
            </div>
            <DialogTitle className="text-xl font-semibold">
              Congratulations!
            </DialogTitle>
            <DialogDescription>
              Your panel evaluation files were submitted successfully. Here&apos;s what happens during IMRaD conversion.
            </DialogDescription>
          </DialogHeader>

          <ol className="space-y-3">
            {[
              {
                title: "Submission received",
                  description: "Your three panel evaluation PDFs and details have been received.",
              },
              {
                title: "Admin begins the conversion",
                description: "The admin prepares the team's working copy and starts organizing the manuscript using the IMRaD guide.",
              },
              ...IMRAD_PARTS.map((part, index) => ({
                title: `Part ${index + 1}: ${part}`,
                description: `The admin works through the ${part.toLowerCase()} section and marks it complete when finished.`,
              })),
              {
                title: "Follow progress",
                description: "Your submission is sent to the admin. Your IMRaD Processing list shows completed parts, and you receive a notification as each part is marked done.",
              },
            ].map((step, index) => (
              <li key={step.title} className="flex gap-3 rounded-xl border border-border bg-muted/30 p-3">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                  {index + 1}
                </span>
                <div>
                  <p className="text-sm font-medium text-foreground">{step.title}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{step.description}</p>
                </div>
              </li>
            ))}
          </ol>

          <div className="space-y-2 rounded-lg bg-amber-500/10 px-3 py-3 text-xs text-muted-foreground">
            <p>
              <span className="font-semibold text-foreground">Unofficial planning estimate: 4–8 weeks.</span>{" "}
              This is not a research-proven deadline or guarantee for this admin-led conversion. Actual timing may vary with the manuscript, review, and workload. Follow updates in your IMRaD Processing list.
            </p>
            <p>
              Related guidance discusses converting dissertations into journal articles, but does not measure this workflow&apos;s duration:{" "}
              <a
                href="https://www.editage.com/blog/convert-dissertation-journal-article/"
                target="_blank"
                rel="noreferrer"
                className="underline underline-offset-2 hover:text-foreground"
              >
                Editage conversion guide
              </a>
              {" · "}
              <a
                href="https://doi.org/10.1155/2012/862135"
                target="_blank"
                rel="noreferrer"
                className="underline underline-offset-2 hover:text-foreground"
              >
                Thomas &amp; Skinner (2012)
              </a>
            </p>
          </div>

          <div className="flex justify-end">
            <Button type="button" onClick={() => setSubmissionSuccessOpen(false)}>
              Got it
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {previewingPanel && (
        <PDFViewer
          open
          fileUrl={previewingPanel.fileUrl}
          fileName={previewingPanel.fileName}
          onClose={() => setPreviewingPanel(null)}
          onConfirm={() => {
            setConfirmedPanelEvaluations((current) =>
              current.map((confirmed, index) =>
                index === previewingPanel.index ? true : confirmed
              )
            );
            setSubmissionNotice("");
            setPreviewingPanel(null);
          }}
        />
      )}

      <PDFViewer
        open={!!viewingFile && !!archiveFileUrl}
        fileUrl={archiveFileUrl ?? ""}
        fileName={viewingFile?.fileName ?? ""}
        onClose={() => setViewingFile(null)}
      />
    </>
  );
}