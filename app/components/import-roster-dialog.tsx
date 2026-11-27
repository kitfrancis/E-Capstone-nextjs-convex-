"use client";

import { useEffect, useRef, useState } from "react";
import {
  useAction,
  useConvex,
  useConvexAuth,
  useMutation,
  useQuery,
} from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { getConvexErrorMessage } from "@/lib/convex-errors";
import { MAX_TEAM_MEMBERS } from "@/lib/team-members";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Download, FileSpreadsheet, RefreshCw, Upload, Trash } from "lucide-react";

const MAX_ROWS = 200;
const MAX_FILE_BYTES = 2 * 1024 * 1024;

const COLUMNS = [
  "team_name",
  "project_title",
  "member_name",
  "member_email",
  "student_no",
  "program",
  "section",
  "adviser_email",
];
const REQUIRED = ["team_name", "member_name", "member_email", "adviser_email"];
const EXAMPLE =
  "Team Alpha,Library Management System,Juan Dela Cruz,juan.delacruz@antiquespride.edu.ph,2023-0001-A,BSIT,3A,adviser@antiquespride.edu.ph";

type RosterRow = {
  teamName: string;
  projectTitle: string;
  memberName: string;
  memberEmail: string;
  studentNo?: string;
  program?: string;
  section?: string;
  adviserEmail: string;
};
type Preview = FunctionReturnType<typeof api.roster.previewRoster>;

const BADGE =
  "inline-flex items-center justify-center rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap";
const GREEN = "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300";
const BLUE = "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300";
const AMBER = "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300";
const ORANGE = "bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300";
type StatusFilter = "all" | "attention" | "sending" | "active";
const RED = "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300";

// ---------------------------------------------------------------------------
// File reading (runs in the browser; the server re-validates everything)
// ---------------------------------------------------------------------------

const norm = (s: unknown) =>
  String(s ?? "").trim().toLowerCase().replace(/[\s-]+/g, "_");

const cell = (v: unknown) =>
  v instanceof Date ? v.toISOString().slice(0, 10) : String(v ?? "").trim();

async function readTable(
  file: File
): Promise<{ table: unknown[][] } | { error: string }> {
  const name = file.name.toLowerCase();
  if (file.size > MAX_FILE_BYTES) {
    return { error: "File is too large (2 MB max)." };
  }
  try {
    if (name.endsWith(".xlsx")) {
      // read-excel-file 7+ no longer has a default "read-excel-file" import:
      // the browser build lives at "read-excel-file/browser".
      // 8+ names the function `readSheet` (returns the first sheet's rows).
      // The fallback keeps 7.x working (its default export returns the rows).
      const mod: any = await import("read-excel-file/browser");
      const read = mod.readSheet ?? mod.default;
      const result = await read(file);

      // If a version returns every sheet ([{ sheet, data }]), use the first one.
      const table =
        Array.isArray(result) &&
        result[0] &&
        !Array.isArray(result[0]) &&
        Array.isArray(result[0].data)
          ? result[0].data
          : result;
      return { table: table as unknown[][] };
    }
    if (name.endsWith(".csv")) {
      const { default: Papa } = await import("papaparse");
      const text = (await file.text()).replace(/^\uFEFF/, "");
      return {
        table: Papa.parse<string[]>(text, { skipEmptyLines: false }).data,
      };
    }
  } catch (err) {
    console.error("Couldn't read roster file:", err);
    return {
      error: "Couldn't read that file. Make sure it's a valid .xlsx or .csv.",
    };
  }
  return { error: "Upload an .xlsx or .csv file." };
}

function parseTable(
  table: unknown[][]
): { rows: RosterRow[] } | { error: string } {
  if (table.length < 2) {
    return {
      error: "No student rows found. The first row must be the column headers.",
    };
  }
  const header = table[0].map(norm);
  const missing = REQUIRED.filter((c) => !header.includes(c));
  if (missing.length > 0) {
    return { error: `Missing column(s): ${missing.join(", ")}.` };
  }

  const col = (r: unknown[], name: string) => {
    const i = header.indexOf(name);
    return i === -1 ? "" : cell(r[i]);
  };

  const body = table.slice(1);
  while (
    body.length > 0 &&
    body[body.length - 1].every((c) => cell(c) === "")
  ) {
    body.pop();
  }
  if (body.length === 0) return { error: "No student rows found." };
  if (body.length > MAX_ROWS) {
    return { error: `Upload at most ${MAX_ROWS} students at a time.` };
  }

  return {
    rows: body.map((r) => ({
      teamName: col(r, "team_name"),
      projectTitle: col(r, "project_title"),
      memberName: col(r, "member_name"),
      memberEmail: col(r, "member_email"),
      studentNo: col(r, "student_no") || undefined,
      program: col(r, "program") || undefined,
      section: col(r, "section") || undefined,
      adviserEmail: col(r, "adviser_email"),
    })),
  };
}

function downloadTemplate() {
  const csv = "\uFEFF" + COLUMNS.join(",") + "\n" + EXAMPLE + "\n";
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "roster-template.csv";
  a.click();
  URL.revokeObjectURL(url);
}

// ---------------------------------------------------------------------------
// Status of imported students (live)
// ---------------------------------------------------------------------------

function RosterStatus() {
  const { isAuthenticated } = useConvexAuth();
  const entries = useQuery(
    api.roster.myRosterEntries,
    isAuthenticated ? {} : "skip"
  );
  const retryEntries = useMutation(api.roster.retryEntries);
  const removeEntries = useAction(api.roster.removeEntries);
  const checkDelivery = useAction(api.roster.checkDelivery);
  const [busy, setBusy] = useState(false);
  const [checkingId, setCheckingId] = useState<Id<"rosterEntries"> | null>(null);
  const [filter, setFilter] = useState<StatusFilter>("all");
  // Which row (or "bulk") is waiting on a delete confirmation.
  const [confirm, setConfirm] = useState<Id<"rosterEntries"> | "bulk" | null>(null);
  const [selected, setSelected] = useState<Set<Id<"rosterEntries">>>(new Set());
  // Re-evaluate "stalled" rows every 30s so a stuck send flips without a reload.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);

  const retry = async (ids: Id<"rosterEntries">[]) => {
    setBusy(true);
    try {
      const count = await retryEntries({ entryIds: ids });
      toast.success(`Retrying ${count} student(s).`);
      setSelected(new Set());
    } catch (err) {
      toast.error(getConvexErrorMessage(err, "Couldn't retry. Try again."));
    } finally {
      setBusy(false);
    }
  };

  const remove = async (ids: Id<"rosterEntries">[]) => {
    setBusy(true);
    try {
      const count = await removeEntries({ entryIds: ids });
      toast.success(`Removed ${count} student(s).`);
      setSelected(new Set());
      setConfirm(null);
    } catch (err) {
      toast.error(getConvexErrorMessage(err, "Couldn't remove. Try again."));
    } finally {
      setBusy(false);
    }
  };

  const checkEmail = async (entryId: Id<"rosterEntries">) => {
    setCheckingId(entryId);
    try {
      const status = await checkDelivery({ entryId });
      toast.success(`Resend delivery event: ${status}.`);
    } catch (err) {
      toast.error(getConvexErrorMessage(err, "Couldn't check email delivery."));
    } finally {
      setCheckingId(null);
    }
  };

  if (entries === undefined) {
    return <p className="py-6 text-center text-sm text-muted-foreground">Loading...</p>;
  }
  if (entries.length === 0) {
    return (
      <p className="py-6 text-center text-sm text-muted-foreground">
        No imports yet.
      </p>
    );
  }

  type Entry = (typeof entries)[number];

  // A row that has been "Sending..." for over a minute never finished: let the
  // instructor retry it too.
  const STUCK_MS = 60_000;
  const isPendingLike = (e: Entry) => e.status === "pending" || e.status === "created";
  const isStuck = (e: Entry) => isPendingLike(e) && now - e.createdAt > STUCK_MS;
  const isBad = (e: Entry) =>
    e.deliveryStatus === "bounced" || e.deliveryStatus === "complained";
  const needsAttention = (e: Entry) => e.status === "failed" || isStuck(e) || isBad(e);
  const isRetryable = (e: Entry) => e.status === "failed" || isStuck(e);
  const minutesSince = (e: Entry) => Math.max(1, Math.floor((now - e.createdAt) / 60_000));

  const failed = entries.filter((e) => e.status === "failed");
  const stalled = entries.filter(isStuck);
  const retryable = entries.filter(isRetryable);
  const active = entries.filter((e) => e.status === "emailed" && e.passwordChanged).length;
  const invited = entries.filter((e) => e.status === "emailed" && !e.passwordChanged).length;
  const sending = entries.filter((e) => isPendingLike(e) && !isStuck(e)).length;

  const badge = (e: Entry) => {
    if (e.status === "failed") return { label: "Failed", cls: RED };
    if (e.deliveryStatus === "bounced")
      return { label: "Email doesn't exist", cls: RED };
    if (e.deliveryStatus === "complained")
      return { label: "Marked as spam", cls: AMBER };
    if (e.status === "emailed") {
      return e.passwordChanged
        ? { label: "Active", cls: GREEN }
        : { label: "Accepted by provider", cls: BLUE };
    }
    if (isStuck(e)) return { label: `Stalled · ${minutesSince(e)} min`, cls: ORANGE };
    return { label: "Sending...", cls: AMBER };
  };

  const FILTERS: { key: StatusFilter; label: string; count: number }[] = [
    { key: "all", label: "All", count: entries.length },
    { key: "attention", label: "Needs attention", count: entries.filter(needsAttention).length },
    { key: "sending", label: "Sending", count: sending },
    { key: "active", label: "Active", count: active },
  ];
  const matches = (e: Entry) => {
    if (filter === "attention") return needsAttention(e);
    if (filter === "sending") return isPendingLike(e) && !isStuck(e);
    if (filter === "active") return e.status === "emailed" && e.passwordChanged;
    return true;
  };
  const visible = entries.filter(matches);

  const selectedEntries = entries.filter((e) => selected.has(e._id));
  const selectedRetryable = selectedEntries.filter(isRetryable);
  const allVisibleSelected =
    visible.length > 0 && visible.every((e) => selected.has(e._id));

  const toggleOne = (id: Id<"rosterEntries">) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const toggleAllVisible = () =>
    setSelected((prev) => {
      const next = new Set(prev);
      for (const e of visible) {
        if (allVisibleSelected) next.delete(e._id);
        else next.add(e._id);
      }
      return next;
    });

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">
          {active} active · {invited} accepted by provider · {sending} sending ·{" "}
          {stalled.length} stalled · {failed.length} failed
        </p>
        {retryable.length > 0 && (
          <Button
            size="sm"
            variant="outline"
            disabled={busy}
            onClick={() => retry(retryable.map((e) => e._id))}
          >
            <RefreshCw className="h-3.5 w-3.5" /> Retry all stalled or failed (
            {retryable.length})
          </Button>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <Button
            key={f.key}
            size="sm"
            variant={filter === f.key ? "default" : "outline"}
            className="rounded-full"
            onClick={() => setFilter(f.key)}
          >
            {f.label} · {f.count}
          </Button>
        ))}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <label className="flex cursor-pointer items-center gap-2 text-xs font-medium text-muted-foreground">
          <input
            type="checkbox"
            className="h-4 w-4"
            checked={allVisibleSelected}
            onChange={toggleAllVisible}
            disabled={visible.length === 0}
          />
          {selectedEntries.length > 0
            ? `${selectedEntries.length} selected`
            : "Select all"}
        </label>
        {selectedEntries.length > 0 && (
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              disabled={busy || selectedRetryable.length === 0}
              onClick={() => retry(selectedRetryable.map((e) => e._id))}
            >
              Retry selected ({selectedRetryable.length})
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="text-red-600 dark:text-red-400"
              disabled={busy}
              onClick={() => setConfirm("bulk")}
            >
              Remove selected ({selectedEntries.length})
            </Button>
            <Button size="sm" variant="outline" onClick={() => setSelected(new Set())}>
              Clear
            </Button>
          </div>
        )}
      </div>

      {confirm === "bulk" && selectedEntries.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
          <span>
            Remove {selectedEntries.length} student(s) from this list? Accounts
            that were never used are deleted. Students who already signed in
            keep their account and team spot. This can&apos;t be undone.
          </span>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="destructive"
              disabled={busy}
              onClick={() => void remove(selectedEntries.map((e) => e._id))}
            >
              {busy ? "Removing..." : "Remove"}
            </Button>
            <Button size="sm" variant="outline" onClick={() => setConfirm(null)}>
              Keep
            </Button>
          </div>
        </div>
      )}

      <div className="space-y-2">
        {visible.length === 0 && (
          <p className="rounded-lg border border-dashed py-6 text-center text-sm text-muted-foreground">
            Nothing here. Everyone in this filter is sorted.
          </p>
        )}
        {visible.map((e) => {
          const b = badge(e);
          const stuck = isStuck(e);
          const isSelected = selected.has(e._id);
          const bounced = e.deliveryStatus === "bounced";
          const canRetry =
            e.status === "failed" ||
            stuck ||
            (e.status === "emailed" && !e.passwordChanged && !bounced);
          return (
            <div key={e._id} className="rounded-lg border p-3">
              <div className="flex items-center justify-between gap-3">
                <div className="flex min-w-0 items-start gap-3">
                  <input
                    type="checkbox"
                    className="mt-1 h-4 w-4 shrink-0"
                    checked={isSelected}
                    onChange={() => toggleOne(e._id)}
                    aria-label={`Select ${e.name}`}
                  />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{e.name}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {e.email} · {e.teamName}
                    </p>
                    {e.emailId && (
                      <p className="mt-0.5 break-all text-[11px] text-muted-foreground">
                        Resend message ID: {e.emailId}
                      </p>
                    )}
                    {e.deliveryStatus && (
                      <p className="text-[11px] text-muted-foreground">
                        Latest Resend event: {e.deliveryStatus}
                      </p>
                    )}
                    {stuck && !e.emailId && (
                      <p className="mt-0.5 text-[11px] text-orange-700 dark:text-orange-300">
                        No Resend message ID after {minutesSince(e)} min. The send
                        most likely never left the queue, so retrying is safe.
                      </p>
                    )}
                    {e.error && <p className="mt-0.5 text-xs text-red-500">{e.error}</p>}
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <span className={`${BADGE} ${b.cls}`}>{b.label}</span>
                  {e.status === "emailed" && e.emailId && !bounced && (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={checkingId === e._id}
                      onClick={() => void checkEmail(e._id)}
                    >
                      {checkingId === e._id ? "Checking..." : "Check delivery"}
                    </Button>
                  )}
                  {isSelected && canRetry && (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={busy}
                      onClick={() => retry([e._id])}
                    >
                      {e.status === "emailed" ? "Re-send" : "Retry"}
                    </Button>
                  )}
                  {isSelected && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-red-600 dark:text-red-400"
                      disabled={busy}
                      onClick={() => setConfirm(e._id)}
                    >
                      <Trash className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              </div>
              {confirm === e._id && isSelected && (
                <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
                  <span>
                    {e.status === "emailed" && e.passwordChanged
                      ? `Remove ${e.name} from this list? Their account and team spot stay as they are.`
                      : `Remove ${e.name} from this import? Their unused account is deleted and nothing more is sent.`}{" "}
                    This can&apos;t be undone.
                  </span>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="destructive"
                      disabled={busy}
                      onClick={() => void remove([e._id])}
                    >
                      {busy ? "Removing..." : "Remove"}
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => setConfirm(null)}>
                      Keep
                    </Button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
      <p className="text-xs text-muted-foreground">
        “Accepted by provider” means Resend accepted the request, not that Gmail
        placed it in the inbox. Search the message ID in Resend&apos;s email
        logs; also check Gmail&apos;s Spam and Promotions folders.
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Dialog
// ---------------------------------------------------------------------------

export function ImportRosterDialog() {
  const convex = useConvex();
  const importRoster = useMutation(api.roster.importRoster);

  const [open, setOpen] = useState(false);
  const [view, setView] = useState<"upload" | "status">("upload");
  const [fileName, setFileName] = useState("");
  const [rows, setRows] = useState<RosterRow[] | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [parseError, setParseError] = useState("");
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const reset = () => {
    setFileName("");
    setRows(null);
    setPreview(null);
    setParseError("");
    if (inputRef.current) inputRef.current.value = "";
  };

  const handleFile = async (file: File) => {
    setRows(null);
    setPreview(null);
    setParseError("");
    setFileName(file.name);
    setBusy(true);
    try {
      const read = await readTable(file);
      if ("error" in read) {
        setParseError(read.error);
        return;
      }
      const parsed = parseTable(read.table);
      if ("error" in parsed) {
        setParseError(parsed.error);
        return;
      }
      const result = await convex.query(api.roster.previewRoster, {
        rows: parsed.rows,
      });
      setRows(parsed.rows);
      setPreview(result);
    } catch (err) {
      setParseError(getConvexErrorMessage(err, "Couldn't check that roster."));
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const handleImport = async () => {
    if (!rows || busy) return;
    setBusy(true);
    try {
      const res = await importRoster({ fileName, rows });
      toast.success(
        `Importing ${res.count} student(s). Accounts and emails are sent in the background.`
      );
      reset();
      setView("status");
    } catch (err) {
      toast.error(getConvexErrorMessage(err, "Import failed. Try again."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) {
          reset();
          setView("upload");
        }
      }}
    >
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" className="gap-1.5 rounded-full">
          <Upload className="h-4 w-4" /> Import roster
        </Button>
      </DialogTrigger>

      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Import roster</DialogTitle>
          <DialogDescription>
            Students are added to their team and emailed instructions to sign
            in with Google using the rostered email. No password is created.
          </DialogDescription>
        </DialogHeader>

        <div className="flex gap-2">
          <Button
            size="sm"
            variant={view === "upload" ? "default" : "outline"}
            onClick={() => setView("upload")}
          >
            Upload
          </Button>
          <Button
            size="sm"
            variant={view === "status" ? "default" : "outline"}
            onClick={() => setView("status")}
          >
            Status
          </Button>
        </div>

        {view === "status" ? (
          <RosterStatus />
        ) : (
          <div className="space-y-4">
            <div className="space-y-1 rounded-lg border bg-muted/40 p-3 text-xs text-muted-foreground">
              <p>
                Upload an <span className="font-medium">.xlsx</span> or{" "}
                <span className="font-medium">.csv</span> file with one row per
                student. Required columns: <code>team_name</code>,{" "}
                <code>member_name</code>, <code>member_email</code>,{" "}
                <code>adviser_email</code>. Optional: <code>project_title</code>,{" "}
                <code>student_no</code>, <code>program</code> (BSIT, BSCS, BLIS),{" "}
                <code>section</code>.
              </p>
              <p>
                Student emails must end in @antiquespride.edu.ph. Advisers must
                already have an approved account. Don&apos;t leave blank rows
                between students.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Button size="sm" variant="outline" onClick={downloadTemplate}>
                <Download className="h-4 w-4" /> Download template
              </Button>
              <Button
                size="sm"
                disabled={busy}
                onClick={() => inputRef.current?.click()}
              >
                <FileSpreadsheet className="h-4 w-4" /> Choose file
              </Button>
              <input
                ref={inputRef}
                type="file"
                accept=".xlsx,.csv"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void handleFile(f);
                }}
              />
              {fileName && (
                <span className="text-xs text-muted-foreground">{fileName}</span>
              )}
            </div>

            {parseError && (
              <p role="alert" className="text-sm text-red-500">
                {parseError}
              </p>
            )}
            {busy && !preview && !parseError && (
              <p className="text-sm text-muted-foreground">Checking roster...</p>
            )}

            {preview && (
              <div className="space-y-3">
                {!preview.ok && (
                  <div className="rounded-lg border border-red-200 bg-red-50 p-3 dark:border-red-900 dark:bg-red-950/40">
                    <p className="text-sm font-medium text-red-700 dark:text-red-300">
                      Fix {preview.errors.length} problem(s) and upload again:
                    </p>
                    <ul className="mt-2 max-h-48 space-y-1 overflow-y-auto text-xs text-red-700 dark:text-red-300">
                      {preview.errors.slice(0, 50).map((e, i) => (
                        <li key={i}>
                          Row {e.row}: {e.message}
                        </li>
                      ))}
                    </ul>
                    {preview.errors.length > 50 && (
                      <p className="mt-1 text-xs text-red-700 dark:text-red-300">
                        ...and {preview.errors.length - 50} more.
                      </p>
                    )}
                  </div>
                )}

                {preview.teams.map((t) => (
                  <div key={t.teamName} className="rounded-lg border p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold">{t.teamName}</p>
                        <p className="truncate text-xs text-muted-foreground">
                          {t.projectTitle} · Adviser: {t.adviserName}
                        </p>
                      </div>
                      <span className={`${BADGE} ${t.isExistingTeam ? AMBER : GREEN}`}>
                        {t.isExistingTeam ? "Existing team" : "New team"}
                      </span>
                      <span className={`${BADGE} ${BLUE}`}>
                        {t.members.length}/{MAX_TEAM_MEMBERS} members
                      </span>
                    </div>
                    <ul className="mt-2 space-y-0.5 text-xs text-muted-foreground">
                      {t.members.map((m) => (
                        <li key={m.row}>
                          {m.name} · {m.email}
                          {m.alreadyRegistered && " (already registered)"}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}

                <div className="flex justify-end">
                  <Button disabled={!preview.ok || busy} onClick={handleImport}>
                    {busy ? "Importing..." : `Import ${rows?.length ?? 0} student(s)`}
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}