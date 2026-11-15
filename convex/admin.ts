import { query } from "./_generated/server";
import type { QueryCtx } from "./_generated/server";
import { v } from "convex/values";
import { requireAdmin } from "./users";

// Instructors (and admins) may read admin activity
async function requireInstructorOrAdmin(ctx: QueryCtx) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) throw new Error("Not authenticated");

  const me = await ctx.db
    .query("users")
    .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
    .first();

  if (!me || (me.role !== "instructor" && me.role !== "admin")) {
    throw new Error("Not authorized");
  }
  return me;
}

export const getDashboardStats = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);

    const users = await ctx.db.query("users").collect();
    const teams = await ctx.db.query("capstoneProjects").collect();
    const archived = await ctx.db.query("projects").collect();
    const deliverables = await ctx.db.query("deliverables").collect();

    return {
      totalUsers: users.length,
      roles: {
        student: users.filter((u) => u.role === "student").length,
        adviser: users.filter((u) => u.role === "adviser").length,
        instructor: users.filter((u) => u.role === "instructor").length,
        admin: users.filter((u) => u.role === "admin").length,
      },
      totalTeams: teams.length,
      archivedProjects: archived.length,
      underReview: deliverables.filter((d) => d.status === "under_review")
        .length,
    };
  },
});

export const recentActivity = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    return await ctx.db
      .query("auditLogs")
      .order("desc")
      .take(args.limit ?? 8);
  },
});

export const listAuditLogs = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    // Newest first, capped to keep the page fast
    return await ctx.db.query("auditLogs").order("desc").take(500);
  },
});

// Read-only feed of admin-performed actions for the instructor "Admin logs" page
export const listAdminActivityLogs = query({
  args: {},
  handler: async (ctx) => {
    await requireInstructorOrAdmin(ctx);

    const admins = await ctx.db
      .query("users")
      .withIndex("by_role", (q) => q.eq("role", "admin"))
      .collect();

    // auditLogs.userId may hold the Convex _id OR the Clerk id, so accept both
    const adminIds = new Set<string>();
    for (const a of admins) {
      adminIds.add(a._id as string);
      adminIds.add(a.clerkId);
    }

    const logs = await ctx.db.query("auditLogs").order("desc").take(500);
    return logs.filter((l) => adminIds.has(l.userId));
  },
});