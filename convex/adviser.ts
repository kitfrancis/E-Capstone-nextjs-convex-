import { query } from "./_generated/server";
import type { QueryCtx } from "./_generated/server";

// Teams supervised by the signed-in, approved adviser
async function myTeams(ctx: QueryCtx) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) return [];

  const me = await ctx.db
    .query("users")
    .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
    .first();
  if (!me || me.status === "pending" || me.status === "rejected") return [];

  const teams = await ctx.db.query("capstoneProjects").collect();
  return teams.filter((t) => t.adviserId === me._id);
}

export const myProjects = query({
  args: {},
  handler: async (ctx) => {
    return await myTeams(ctx);
  },
});

export const myDeliverables = query({
  args: {},
  handler: async (ctx) => {
    const teams = await myTeams(ctx);
    const names = new Map(teams.map((t) => [t._id, t.teamName]));

    const deliverables = await ctx.db
      .query("deliverables")
      .order("desc")
      .collect();

    return deliverables
      .filter((d) => names.has(d.capstoneProjectId))
      .map((d) => ({
        ...d,
        teamName: names.get(d.capstoneProjectId) ?? "Unknown Team",
      }));
  },
});

export const myTasks = query({
  args: {},
  handler: async (ctx) => {
    const teams = await myTeams(ctx);
    const names = new Map(teams.map((t) => [t._id, t.teamName]));

    const tasks = await ctx.db.query("tasks").collect();

    return tasks
      .filter((t) => names.has(t.capstoneProjectId))
      .map((t) => ({
        ...t,
        teamName: names.get(t.capstoneProjectId) ?? "Unknown Team",
      }));
  },
});