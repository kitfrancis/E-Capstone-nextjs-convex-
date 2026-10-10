export const TOTAL_CHAPTERS = 5;
export const CHAPTER_MAX = 20;

type Item = {
  _id: string;
  phase: string;
  version: number;
  status: string;
  uploadedAt: string;
};

const ROMAN: Record<string, number> = { i: 1, ii: 2, iii: 3, iv: 4, v: 5 };
const WORDS: Record<string, number> = { one: 1, two: 2, three: 3, four: 4, five: 5 };

// Accepts "Chapter 1", "chapter-1", "Ch 1", "Chapter I", "Chapter One", or just "1".
// Returns null for anything else (e.g. "Proposal").
export function chapterOf(phase: string): number | null {
  const m = phase.trim().match(/^(?:chapter|ch)?[\s._-]*(\d+|[ivx]+|one|two|three|four|five)\b/i);
  if (!m) return null;
  const t = m[1].toLowerCase();
  const n = /^\d+$/.test(t) ? Number(t) : ROMAN[t] ?? WORDS[t] ?? 0;
  return n >= 1 && n <= TOTAL_CHAPTERS ? n : null;
}

export type ChapterProgress = {
  chapter: number;
  points: number;
  status: string | null;
  latestId: string | null;
};

export function computeProgress(items: Item[]) {
  const chapters: ChapterProgress[] = Array.from({ length: TOTAL_CHAPTERS }, (_, i) => ({
    chapter: i + 1,
    points: 0,
    status: null,
    latestId: null,
  }));

  const byChapter = new Map<number, Item[]>();
  for (const d of items) {
    const n = chapterOf(d.phase);
    if (n) byChapter.set(n, [...(byChapter.get(n) ?? []), d]);
  }

  for (const [n, list] of byChapter) {
    // Only the newest version of each chapter counts
    const latest = [...list].sort(
      (a, b) => b.version - a.version || b.uploadedAt.localeCompare(a.uploadedAt)
    )[0];
    const hadRevision = list.some((d) => d.status === "needs_revision");

    let points = 10; // uploaded
    if (latest.status === "approved") points = 20;
    else if (latest.status === "needs_revision" || hadRevision) points = 15; // resubmission never drops below 15

    chapters[n - 1] = { chapter: n, points, status: latest.status, latestId: latest._id };
  }

  return {
    chapters,
    total: chapters.reduce((sum, c) => sum + c.points, 0),
    approved: chapters.filter((c) => c.status === "approved").length,
  };
}