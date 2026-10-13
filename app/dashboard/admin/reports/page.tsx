"use client";

import { useState } from "react";
import { useConvex, useQuery } from "convex/react";
import { toast } from "sonner";
import {
  Archive,
  Download,
  FileSpreadsheet,
  FolderKanban,
  Loader2,
  Users,
} from "lucide-react";
import { api } from "@/convex/_generated/api";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

type ReportKey = "overview" | "activity" | "projects" | "archive";

const DOWNLOADS: { key: ReportKey; label: string; file: string }[] = [
  { key: "overview", label: "System overview", file: "system-overview" },
  { key: "activity", label: "User activity", file: "user-activity" },
  { key: "projects", label: "Project status", file: "project-status" },
  { key: "archive", label: "Archive summary", file: "archive-summary" },
];

function toCsv(rows: Record<string, string | number>[]) {
  if (rows.length === 0) return "";
  const cols = Object.keys(rows[0]);
  const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  return [
    cols.map(esc).join(","),
    ...rows.map((r) => cols.map((c) => esc(r[c])).join(",")),
  ].join("\n");
}

function downloadCsv(name: string, csv: string) {
  // BOM so Excel reads UTF-8 names correctly
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${name}-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function StatCard({
  label,
  value,
  note,
  icon: Icon,
  tone,
}: {
  label: string;
  value: number | undefined;
  note?: string;
  icon: React.ComponentType<{ className?: string }>;
  tone: string;
}) {
  return (
    <Card>
      <CardContent className="flex items-center gap-4 p-5">
        <div className={`rounded-xl p-3 ${tone}`}>
          <Icon className="size-6" />
        </div>
        <div>
          <p className="text-sm text-muted-foreground">{label}</p>
          <p className="text-3xl font-bold leading-tight">{value ?? "—"}</p>
          {note && <p className="text-xs text-muted-foreground">{note}</p>}
        </div>
      </CardContent>
    </Card>
  );
}

function Donut({
  segments,
  total,
}: {
  segments: { label: string; value: number; color: string }[];
  total: number;
}) {
  const r = 52;
  const c = 2 * Math.PI * r;
  let offset = 0;

  return (
    <div className="relative size-40 shrink-0">
      <svg
        viewBox="0 0 140 140"
        className="size-full -rotate-90"
        role="img"
        aria-label={`Project status: ${segments
          .map((s) => `${s.value} ${s.label}`)
          .join(", ")}`}
      >
        <circle
          cx="70"
          cy="70"
          r={r}
          fill="none"
          strokeWidth="16"
          className="stroke-muted"
        />
        {segments.map((s) => {
          const len = total ? (s.value / total) * c : 0;
          const el = (
            <circle
              key={s.label}
              cx="70"
              cy="70"
              r={r}
              fill="none"
              stroke={s.color}
              strokeWidth="16"
              strokeDasharray={`${len} ${c - len}`}
              strokeDashoffset={-offset}
            />
          );
          offset += len;
          return el;
        })}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-3xl font-bold">{total}</span>
        <span className="text-xs text-muted-foreground">Total teams</span>
      </div>
    </div>
  );
}

export default function ReportsPage() {
  const convex = useConvex();
  const data = useQuery(api.adminReports.overview);
  const [busy, setBusy] = useState<ReportKey | null>(null);

  async function download(key: ReportKey, file: string) {
    setBusy(key);
    try {
      const rows = await convex.query(api.adminReports.exportRows, {
        report: key,
      });
      if (rows.length === 0) {
        toast.info("There is no data for this report yet.");
        return;
      }
      downloadCsv(file, toCsv(rows));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not download");
    } finally {
      setBusy(null);
    }
  }

  const status = data?.projectStatus;
  const segments = [
    { label: "Completed", value: status?.completed ?? 0, color: "#22c55e" },
    { label: "In progress", value: status?.inProgress ?? 0, color: "#3b82f6" },
    { label: "Not started", value: status?.notStarted ?? 0, color: "#f59e0b" },
  ];
  const maxCount = Math.max(1, ...(data?.submissionsByProgram ?? []).map((p) => p.count));

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Reports</h1>
        <p className="text-sm text-muted-foreground">
          View and download system reports and analytics.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Total users"
          value={data?.totalUsers}
          note={
            data && data.pendingUsers > 0
              ? `${data.pendingUsers} awaiting approval`
              : undefined
          }
          icon={Users}
          tone="bg-blue-500/15 text-blue-400"
        />
        <StatCard
          label="Capstone teams"
          value={data?.teams}
          icon={FolderKanban}
          tone="bg-emerald-500/15 text-emerald-400"
        />
        <StatCard
          label="Submissions"
          value={data?.submissions}
          icon={FileSpreadsheet}
          tone="bg-violet-500/15 text-violet-400"
        />
        <StatCard
          label="Archived projects"
          value={data?.archived}
          icon={Archive}
          tone="bg-orange-500/15 text-orange-400"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Project progress</CardTitle>
            <CardDescription>
              Completed is 100% progress; not started is 0%.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col items-center gap-6 sm:flex-row">
            <Donut
              segments={segments}
              total={segments.reduce((n, s) => n + s.value, 0)}
            />
            <ul className="w-full space-y-2 text-sm">
              {segments.map((s) => (
                <li key={s.label} className="flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <span
                      className="size-2.5 rounded-full"
                      style={{ backgroundColor: s.color }}
                    />
                    {s.label}
                  </span>
                  <span className="font-medium">{s.value}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Submissions by program</CardTitle>
            <CardDescription>
              Deliverables uploaded, grouped by the team’s program.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {data && data.submissionsByProgram.length === 0 && (
              <p className="text-sm text-muted-foreground">
                No submissions yet. They’ll appear here once teams upload
                deliverables.
              </p>
            )}
            {data?.submissionsByProgram.map((p) => (
              <div key={p.program} className="flex items-center gap-3 text-sm">
                <span className="w-20 shrink-0 truncate">{p.program}</span>
                <div className="h-3 flex-1 rounded-full bg-muted">
                  <div
                    className="h-3 rounded-full bg-blue-500"
                    style={{ width: `${(p.count / maxCount) * 100}%` }}
                  />
                </div>
                <span className="w-8 text-right font-medium">{p.count}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Download reports</CardTitle>
          <CardDescription>
            Each report downloads as a CSV file you can open in Excel.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {DOWNLOADS.map((d) => (
            <Button
              key={d.key}
              variant="outline"
              className="h-auto justify-start gap-3 py-4"
              disabled={busy !== null}
              onClick={() => download(d.key, d.file)}
            >
              {busy === d.key ? (
                <Loader2 className="size-5 animate-spin" />
              ) : (
                <Download className="size-5" />
              )}
              {d.label}
            </Button>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}