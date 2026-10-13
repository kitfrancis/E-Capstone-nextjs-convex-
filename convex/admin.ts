import { query } from "./_generated/server";
import { v } from "convex/values";
import { requireAdmin } from "./users";

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