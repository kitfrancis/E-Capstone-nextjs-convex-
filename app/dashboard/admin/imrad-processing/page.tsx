"use client";

import { useMemo, useState } from "react";
import {
  BookOpen,
  CalendarDays,
  Check,
  ClipboardCheck,
  FileText,
  Search,
  Upload,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type EvaluationSubmission = {
  id: string;
  team: string;
  project: string;
  year: number;
  instructor: string;
  description: string;
  evaluations: string[];
};

type ProcessingProject = {
  id: string;
  team: string;
  project: string;
  year: number;
  documents: string[];
  uploadedImradFiles?: string[];
  sourceSubmission?: EvaluationSubmission;
};

const SAMPLE_PROCESSING_PROJECTS: ProcessingProject[] = [
  {
    id: "processing-innovators",
    team: "Team Innovators",
    project: "Health Clinic Management Information System with Treatment Demand Forecasting",
    year: 2026,
    sourceSubmission: {
      id: "submission-innovators",
      team: "Team Innovators",
      project: "Health Clinic Management Information System with Treatment Demand Forecasting",
      year: 2026,
      instructor: "Maria Santos",
      description:
        "All three panel evaluations are complete. The team has submitted the final manuscript for IMRAD processing.",
      evaluations: [
        "Panel 1 - Final Evaluation.pdf",
        "Panel 2 - Final Evaluation.pdf",
        "Panel 3 - Final Evaluation.pdf",
      ],
    },
    documents: [
      "IMRAD - Introduction.pdf",
      "IMRAD - Methodology.pdf",
      "IMRAD - Results and Discussion.pdf",
      "IMRAD - Conclusion and Recommendations.pdf",
    ],
  },
];

const SAMPLE_EVALUATION_SUBMISSIONS: EvaluationSubmission[] = [
  {
    id: "submission-code-avengers",
    team: "Team Code Avengers",
    project: "University of Antique RFID-Based Vehicle Entry System",
    year: 2026,
    instructor: "Maria Santos",
    description:
      "All three panel evaluations are complete. The team has submitted the final manuscript for IMRAD processing.",
    evaluations: [
      "Panel 1 - Final Evaluation.pdf",
      "Panel 2 - Final Evaluation.pdf",
      "Panel 3 - Final Evaluation.pdf",
    ],
  },
  {
    id: "submission-tech-pioneers",
    team: "Team Tech Pioneers",
    project: "Smart Campus Resource Reservation System",
    year: 2025,
    instructor: "Daniel Reyes",
    description:
      "Final defense evaluations submitted for review. Please process the project documents into the IMRAD format.",
    evaluations: [
      "Panel 1 - Final Evaluation.pdf",
      "Panel 2 - Final Evaluation.pdf",
      "Panel 3 - Final Evaluation.pdf",
    ],
  },
];

export default function AdminImradProcessingPage() {
  const [search, setSearch] = useState("");
  const [yearFilter, setYearFilter] = useState("all");
  const [processingProjects, setProcessingProjects] = useState<ProcessingProject[]>(
    SAMPLE_PROCESSING_PROJECTS
  );
  const [evaluationSubmissions, setEvaluationSubmissions] = useState<EvaluationSubmission[]>(
    SAMPLE_EVALUATION_SUBMISSIONS
  );
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [selectedUploadProjectId, setSelectedUploadProjectId] = useState("");
  const [imradFile, setImradFile] = useState<File | null>(null);
  const [uploadError, setUploadError] = useState("");

  const years = useMemo(
    () =>
      [
        ...new Set([
          ...processingProjects.map((project) => project.year),
          ...evaluationSubmissions.map((submission) => submission.year),
        ]),
      ].sort((a, b) => b - a),
    [evaluationSubmissions, processingProjects]
  );
  const matchesFilters = (item: { project: string; team: string; year: number }) => {
    const term = search.trim().toLowerCase();
    const matchesYear = yearFilter === "all" || String(item.year) === yearFilter;
    const matchesSearch =
      !term || item.project.toLowerCase().includes(term) || item.team.toLowerCase().includes(term);
    return matchesYear && matchesSearch;
  };
  const filteredProcessingProjects = processingProjects.filter(matchesFilters);
  const filteredSubmissions = evaluationSubmissions.filter(matchesFilters);

  const processSubmission = (submission: EvaluationSubmission) => {
    setEvaluationSubmissions((current) =>
      current.filter((item) => item.id !== submission.id)
    );
    setProcessingProjects((current) => [
      {
        id: `processing-${submission.id}`,
        team: submission.team,
        project: submission.project,
        year: submission.year,
        sourceSubmission: submission,
        documents: [
          "IMRAD - Introduction.pdf",
          "IMRAD - Methodology.pdf",
          "IMRAD - Results and Discussion.pdf",
          "IMRAD - Conclusion and Recommendations.pdf",
        ],
      },
      ...current,
    ]);
  };

  const cancelProcess = (project: ProcessingProject) => {
    const submission = project.sourceSubmission ?? {
      id: project.id.replace(/^processing-/, "submission-"),
      team: project.team,
      project: project.project,
      year: project.year,
      instructor: "Instructor",
      description:
        "Final defense evaluations submitted for review. Please process the project documents into the IMRAD format.",
      evaluations: [
        "Panel 1 - Final Evaluation.pdf",
        "Panel 2 - Final Evaluation.pdf",
        "Panel 3 - Final Evaluation.pdf",
      ],
    };

    setProcessingProjects((current) => current.filter((item) => item.id !== project.id));
    setEvaluationSubmissions((current) =>
      current.some((item) => item.id === submission.id)
        ? current
        : [submission, ...current]
    );
  };

  const submitImradUpload = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedUploadProjectId || !imradFile) {
      setUploadError("Select a project and choose an IMRAD PDF.");
      return;
    }
    if (imradFile.type !== "application/pdf" && !imradFile.name.toLowerCase().endsWith(".pdf")) {
      setUploadError("Choose a PDF file.");
      return;
    }

    setProcessingProjects((current) =>
      current.map((project) =>
        project.id === selectedUploadProjectId
          ? { ...project, uploadedImradFiles: [...(project.uploadedImradFiles ?? []), imradFile.name] }
          : project
      )
    );
    setUploadDialogOpen(false);
    setImradFile(null);
    setSelectedUploadProjectId("");
    setUploadError("");
  };

  const closeUploadDialog = (open: boolean) => {
    setUploadDialogOpen(open);
    if (!open) {
      setImradFile(null);
      setSelectedUploadProjectId("");
      setUploadError("");
    }
  };

  return (
    <div className="space-y-6 p-4 font-Poppins sm:p-6">
      <section className="rounded-2xl border border-purple-500/20 bg-linear-to-br from-purple-500/15 via-purple-500/5 to-transparent p-6 md:p-8">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-semibold text-foreground">Imrad Processing</h1>
            <p className="mt-2 max-w-2xl text-muted-foreground">
              Review instructor evaluation submissions and track projects being converted to IMRAD documents.
            </p>
          </div>
          <Button
            type="button"
            className="h-10 w-fit px-5"
            onClick={() => setUploadDialogOpen(true)}
            disabled={processingProjects.length === 0}
          >
            <Upload className="mr-2 h-4 w-4" />
            Upload Imrad
          </Button>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {[
          {
            label: "Projects processing",
            value: processingProjects.length,
            icon: FileText,
            tone: "bg-blue-500/10 text-blue-500",
          },
          {
            label: "Evaluation submissions",
            value: evaluationSubmissions.length,
            icon: Users,
            tone: "bg-emerald-500/10 text-emerald-500",
          },
          {
            label: "Academic years",
            value: years.length,
            icon: CalendarDays,
            tone: "bg-purple-500/10 text-purple-500",
          },
        ].map(({ label, value, icon: Icon, tone }) => (
          <article key={label} className="flex items-center gap-4 rounded-2xl border border-border bg-card p-5">
            <div className={`flex h-11 w-11 items-center justify-center rounded-full ${tone}`}>
              <Icon className="h-5 w-5" />
            </div>
            <div>
              <p className="text-2xl font-semibold text-foreground">{value}</p>
              <p className="text-sm text-muted-foreground">{label}</p>
            </div>
          </article>
        ))}
      </section>

      <section className="space-y-4 rounded-2xl border border-border bg-card p-4 md:p-5">
        <div className="flex flex-col gap-3 sm:flex-row">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search by project title or team..."
              aria-label="Search IMRAD projects"
              className="h-10 pl-9"
            />
          </div>
          <select
            value={yearFilter}
            onChange={(event) => setYearFilter(event.target.value)}
            aria-label="Filter by academic year"
            className="h-10 rounded-md border border-input bg-background px-3 text-sm text-foreground"
          >
            <option value="all">All years</option>
            {years.map((year) => (
              <option key={year} value={String(year)}>
                {year}
              </option>
            ))}
          </select>
          {(search || yearFilter !== "all") && (
            <Button
              variant="outline"
              className="h-10"
              onClick={() => {
                setSearch("");
                setYearFilter("all");
              }}
            >
              Clear filters
            </Button>
          )}
        </div>
        <p className="text-sm text-muted-foreground">
          Showing {filteredProcessingProjects.length + filteredSubmissions.length} matching items
        </p>
      </section>

      <section className="space-y-3">
        <div>
          <h2 className="text-xl font-semibold text-foreground">Projects in Processing</h2>
          <p className="text-sm text-muted-foreground">
            Projects that have been accepted for IMRAD processing and their documents.
          </p>
        </div>

        {filteredProcessingProjects.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border px-6 py-8 text-center text-sm text-muted-foreground">
            No projects are in processing.
          </div>
        ) : (
          filteredProcessingProjects.map((project) => (
            <article key={project.id} className="space-y-4 rounded-2xl border border-border bg-card p-5">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex min-w-0 items-start gap-4">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-purple-500/15 text-purple-500">
                    <BookOpen className="h-5 w-5" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-semibold text-foreground">{project.project}</h3>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {project.team} • {project.year}
                    </p>
                  </div>
                </div>
                <span className="inline-flex w-fit shrink-0 items-center gap-1.5 rounded-full border border-amber-500/25 bg-amber-500/10 px-3 py-1 text-xs font-medium text-amber-700 dark:text-amber-400">
                  <ClipboardCheck className="h-3.5 w-3.5" />
                  Processing
                </span>
              </div>

              <div className="flex justify-end">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => cancelProcess(project)}
                >
                  Cancel Process
                </Button>
              </div>

              <div className="border-t border-border pt-4">
                <h4 className="mb-3 text-sm font-medium text-foreground">IMRAD processing documents</h4>
                <ul className="grid gap-2 sm:grid-cols-2">
                  {project.documents.map((document) => (
                    <li
                      key={document}
                      className="flex items-center gap-2 rounded-lg bg-muted/50 px-3 py-2 text-sm text-muted-foreground"
                    >
                      <FileText className="h-4 w-4 shrink-0 text-purple-500" />
                      <span className="truncate">{document}</span>
                    </li>
                  ))}
                  {project.uploadedImradFiles?.map((document, index) => (
                    <li
                      key={`${document}-${index}`}
                      className="flex items-center gap-2 rounded-lg border border-purple-500/20 bg-purple-500/5 px-3 py-2 text-sm text-foreground"
                    >
                      <FileText className="h-4 w-4 shrink-0 text-purple-500" />
                      <span className="min-w-0 truncate">{document}</span>
                      <span className="ml-auto shrink-0 text-xs text-muted-foreground">
                        Uploaded IMRAD
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            </article>
          ))
        )}
      </section>

      <section className="space-y-3">
        <div>
          <h2 className="text-xl font-semibold text-foreground">Instructor Evaluation Submissions</h2>
          <p className="text-sm text-muted-foreground">
            Review the submitted panel evaluations and details, then process a project into the list above.
          </p>
        </div>

        {filteredSubmissions.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border px-6 py-8 text-center text-sm text-muted-foreground">
            No instructor evaluation submissions match your search.
          </div>
        ) : (
          filteredSubmissions.map((submission) => (
            <article
              key={submission.id}
              className="space-y-4 rounded-2xl border border-border bg-card p-5"
            >
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex min-w-0 items-start gap-4">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-600">
                    <ClipboardCheck className="h-5 w-5" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-semibold text-foreground">{submission.project}</h3>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {submission.team} • {submission.year} • Submitted by {submission.instructor}
                    </p>
                  </div>
                </div>
                <Button onClick={() => processSubmission(submission)}>
                  <Check className="mr-2 h-4 w-4" />
                  Process
                </Button>
              </div>

              <p className="text-sm leading-relaxed text-muted-foreground">{submission.description}</p>

              <div className="border-t border-border pt-4">
                <h4 className="mb-3 text-sm font-medium text-foreground">Submitted panel evaluations</h4>
                <ul className="grid gap-2 sm:grid-cols-3">
                  {submission.evaluations.map((document) => (
                    <li
                      key={document}
                      className="flex items-center gap-2 rounded-lg bg-muted/50 px-3 py-2 text-sm text-muted-foreground"
                    >
                      <FileText className="h-4 w-4 shrink-0 text-blue-500" />
                      <span className="truncate">{document}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </article>
          ))
        )}
      </section>

      <Dialog open={uploadDialogOpen} onOpenChange={closeUploadDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader className="pr-8">
            <DialogTitle className="text-lg font-semibold">Upload Imrad</DialogTitle>
            <DialogDescription>
              Choose a project in processing and attach its IMRAD PDF to that team.
            </DialogDescription>
          </DialogHeader>

          <form className="space-y-5" onSubmit={submitImradUpload}>
            <div className="space-y-2">
              <label htmlFor="imrad-project" className="text-sm font-medium text-foreground">
                Project in processing
              </label>
              <select
                id="imrad-project"
                value={selectedUploadProjectId}
                onChange={(event) => {
                  setSelectedUploadProjectId(event.target.value);
                  setUploadError("");
                }}
                required
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground"
              >
                <option value="" disabled>
                  Select a project
                </option>
                {processingProjects.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.team} — {project.project}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <label htmlFor="imrad-pdf" className="text-sm font-medium text-foreground">
                IMRAD PDF file
              </label>
              <div className="rounded-xl border border-dashed border-border bg-muted/40 p-4">
                <Input
                  id="imrad-pdf"
                  type="file"
                  accept="application/pdf,.pdf"
                  required
                  aria-label="Select IMRAD PDF file"
                  className="h-auto cursor-pointer px-2 py-2 text-xs file:mr-2 file:rounded file:border-0 file:bg-primary file:px-2 file:py-1 file:text-primary-foreground"
                  onChange={(event) => {
                    setImradFile(event.currentTarget.files?.[0] ?? null);
                    setUploadError("");
                  }}
                />
                <p className="mt-2 truncate text-xs text-muted-foreground">
                  {imradFile?.name ?? "PDF files only"}
                </p>
              </div>
            </div>

            {uploadError && (
              <p role="alert" className="text-sm text-destructive">
                {uploadError}
              </p>
            )}

            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => closeUploadDialog(false)}>
                Cancel
              </Button>
              <Button type="submit">Attach IMRAD PDF</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
