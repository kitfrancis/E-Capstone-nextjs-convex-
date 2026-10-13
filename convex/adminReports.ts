import { v } from "convex/values";
import { query, type QueryCtx } from "./_generated/server";

async function requireAdmin(ctx: QueryCtx) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) throw new Error("Not authenticated");
  const user = await ctx.db
    .query("users")
    .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
    .unique();
  if (!user || user.role !== "admin") throw new Error("Admins only");
  return user;
}

/** Numbers for the Reports page. */
export const overview = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);

    const [users, teams, deliverables, archived] = await Promise.all([
      ctx.db.query("users").collect(),
      ctx.db.query("capstoneProjects").collect(),
      ctx.db.query("deliverables").collect(),
      ctx.db.query("projects").collect(),
    ]);

    // Project status, derived from each team's progress (0-100)
    let completed = 0;
    let inProgress = 0;
    let notStarted = 0;
    for (const t of teams) {
      if (t.progress >= 100) completed++;
      else if (t.progress > 0) inProgress++;
      else notStarted++;
    }

    // Submissions by program: a team's program is the first member who has one
    const programByClerkId = new Map(users.map((u) => [u.clerkId, u.program]));
    const programByTeam = new Map<string, string>();
    for (const t of teams) {
      const program = (t.members ?? [])
        .map((m) => programByClerkId.get(m))
        .find(Boolean);
      programByTeam.set(t._id, program ?? "Unassigned");
    }
    const counts = new Map<string, number>();
    for (const d of deliverables) {
      const program = programByTeam.get(d.capstoneProjectId) ?? "Unassigned";
      counts.set(program, (counts.get(program) ?? 0) + 1);
    }
    const submissionsByProgram = Array.from(counts, ([program, count]) => ({
      program,
      count,
    })).sort((a, b) => b.count - a.count);

    return {
      totalUsers: users.length,
      pendingUsers: users.filter((u) => u.status === "pending").length,
      teams: teams.length,
      submissions: deliverables.length,
      archived: archived.length,
      projectStatus: { completed, inProgress, notStarted },
      submissionsByProgram,
    };
  },
});

/** Flat rows for the CSV downloads. */
export const exportRows = query({
  args: {
    report: v.union(
      v.literal("overview"),
      v.literal("activity"),
      v.literal("projects"),
      v.literal("archive")
    ),
  },
  handler: async (ctx, { report }) => {
    await requireAdmin(ctx);

    if (report === "overview") {
      const users = await ctx.db.query("users").collect();
      const teams = await ctx.db.query("capstoneProjects").collect();
      const deliverables = await ctx.db.query("deliverables").collect();
      const archived = await ctx.db.query("projects").collect();
      const role = (r: string) => users.filter((u) => u.role === r).length;
      return [
        { Metric: "Total users", Value: users.length },
        { Metric: "Students", Value: role("student") },
        { Metric: "Advisers", Value: role("adviser") },
        { Metric: "Instructors", Value: role("instructor") },
        { Metric: "Admins", Value: role("admin") },
        { Metric: "Capstone teams", Value: teams.length },
        { Metric: "Deliverables submitted", Value: deliverables.length },
        { Metric: "Archived projects", Value: archived.length },
      ];
    }

    if (report === "activity") {
      const logs = await ctx.db.query("auditLogs").order("desc").collect();
      return logs.map((l) => ({
        Date: new Date(l._creationTime).toISOString(),
        User: l.userName,
        Action: l.action,
        Details: l.details,
      }));
    }

    if (report === "projects") {
      const teams = await ctx.db.query("capstoneProjects").collect();
      return teams.map((t) => ({
        Team: t.teamName,
        Title: t.projectTitle,
        Phase: t.phase,
        "Progress (%)": t.progress,
        Approved: t.approved,
        "Under review": t.underReview,
        "Needs revision": t.needsRevision,
      }));
    }

    const archived = await ctx.db.query("projects").order("desc").collect();
    return archived.map((p) => ({
      Title: p.title,
      Program: p.course,
      Year: p.year,
      Authors: p.members.join("; "),
      Adviser: p.adviser,
      "Date archived": p.archivedDate,
    }));
  },
});