export const TOTAL_CHAPTERS = 5;
export const CHAPTER_MAX = 20;

// true: uploads (10%) and revisions (15%) count as partial credit (original behavior).
// false: only approved chapters count toward the total.
export const COUNT_PARTIAL_PROGRESS = true;

type Item = {
  _id: string;
  phase: string;
  version: number;
  status: string;
  uploadedAt: string;
};

const ROMAN: Record<string, number> = { i: 1, ii: 2, iii: 3, iv: 4, v: 5 };
const WORDS: Record<string, number> = { one: 1, two: 2, three: 3, four: 4, five: 5 };

export function chapterOf(phase: string): number | null {
  const m = phase.trim().match(/^(?:chapter|ch)?[\s._-]*(\d+|[ivx]+|one|two|three|four|five)\b/i);
  if (!m) return null;
  const t = m[1].toLowerCase();
  const n = /^\d+$/.test(t) ? Number(t) : ROMAN[t] ?? WORDS[t] ?? 0;
  return n >= 1 && n <= TOTAL_CHAPTERS ? n : null;
}

export type ChapterProgress = {
  chapter: number;
  // credit this chapter has earned at its current status (10 / 15 / 20)
  points: number;
  // credit that actually counts toward the total
  counted: number;
  status: string | null;
  latestId: string | null;
};

export function computeProgress(items: Item[]) {
  const chapters: ChapterProgress[] = Array.from({ length: TOTAL_CHAPTERS }, (_, i) => ({
    chapter: i + 1,
    points: 0,
    counted: 0,
    status: null,
    latestId: null,
  }));

  const byChapter = new Map<number, Item[]>();
  for (const d of items) {
    const n = chapterOf(d.phase);
    if (n) byChapter.set(n, [...(byChapter.get(n) ?? []), d]);
  }

  let chapterItems = 0;

  for (const [n, list] of byChapter) {
    chapterItems += list.length;

    const latest = [...list].sort(
      (a, b) => b.version - a.version || b.uploadedAt.localeCompare(a.uploadedAt)
    )[0];
    const hadRevision = list.some((d) => d.status === "needs_revision");

    let points = 10;
    if (latest.status === "approved") points = 20;
    else if (latest.status === "needs_revision" || hadRevision) points = 15;

    const counted =
      latest.status === "approved" ? points : COUNT_PARTIAL_PROGRESS ? points : 0;

    chapters[n - 1] = {
      chapter: n,
      points,
      counted,
      status: latest.status,
      latestId: latest._id,
    };
  }

  const withLatest = chapters.filter((c) => c.latestId !== null).length;

  return {
    chapters,
    total: chapters.reduce((sum, c) => sum + c.counted, 0),
    // stats use the latest version of each chapter only
    approved: chapters.filter((c) => c.status === "approved").length,
    underReview: chapters.filter((c) => c.status === "under_review").length,
    needsRevision: chapters.filter((c) => c.status === "needs_revision").length,
    superseded: chapterItems - withLatest,
  };
}