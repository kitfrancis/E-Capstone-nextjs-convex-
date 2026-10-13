import { v } from "convex/values";
import { mutation, query, type MutationCtx } from "./_generated/server";

const DEFAULTS = {
  systemName: "E-Capstone",
  institutionName: "Antique State University",
  academicYear: "",
  allowRegistration: true,
  requireArchiveApproval: true,
  maintenanceMode: false,
  supportEmail: "",
};

async function requireAdmin(ctx: MutationCtx) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) throw new Error("Not authenticated");
  const user = await ctx.db
    .query("users")
    .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
    .unique();
  if (!user || user.role !== "admin") throw new Error("Admins only");
  return user;
}

/**
 * Readable by any signed-in user so other pages can check maintenanceMode
 * or allowRegistration. Returns defaults until an admin saves once.
 */
export const get = query({
  args: {},
  handler: async (ctx) => {
    const row = await ctx.db.query("settings").first();
    return row ?? { ...DEFAULTS, updatedAt: null };
  },
});

export const update = mutation({
  args: {
    systemName: v.string(),
    institutionName: v.string(),
    academicYear: v.string(),
    allowRegistration: v.boolean(),
    requireArchiveApproval: v.boolean(),
    maintenanceMode: v.boolean(),
    supportEmail: v.string(),
  },
  handler: async (ctx, args) => {
    const admin = await requireAdmin(ctx);
    const next = { ...args, updatedAt: Date.now() };

    const existing = await ctx.db.query("settings").first();
    if (existing) await ctx.db.patch(existing._id, next);
    else await ctx.db.insert("settings", next);

    await ctx.db.insert("auditLogs", {
      userId: admin.clerkId,
      userName: admin.name,
      action: "Updated system settings",
      details: `Maintenance mode ${args.maintenanceMode ? "on" : "off"}, registration ${
        args.allowRegistration ? "open" : "closed"
      }`,
    });
  },
});