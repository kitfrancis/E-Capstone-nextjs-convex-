import { internalMutation, mutation, query } from "./_generated/server";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { v } from "convex/values";

// ---------- helpers ----------
async function getCurrentUser(ctx: QueryCtx | MutationCtx) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) return null;

  return await ctx.db
    .query("users")
    .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
    .first();
}

// Use this at the top of every admin-only query/mutation (in any file)
export async function requireAdmin(ctx: QueryCtx | MutationCtx) {
  const user = await getCurrentUser(ctx);
  if (!user) throw new Error("Not authenticated");
  if (user.role !== "admin") throw new Error("Admin access required");
  return user;
}

// Call from any mutation to add an entry to the audit log
export async function logAction(
  ctx: MutationCtx,
  actor: { clerkId: string; name: string },
  action: string,
  details: string
) {
  await ctx.db.insert("auditLogs", {
    userId: actor.clerkId,
    userName: actor.name,
    action,
    details,
  });
}

// ---------- user sync ----------
// NOTE: "admin" is intentionally NOT allowed here (this mutation is public).
export const upsertUser = mutation({
  args: {
    clerkId: v.string(),
    name: v.string(),
    email: v.string(),
    image: v.optional(v.string()),
    role: v.union(
      v.literal("student"),
      v.literal("instructor"),
      v.literal("adviser")
    ),
    studentNo: v.optional(v.string()),
    program: v.optional(v.string()),
    section: v.optional(v.string()),
    inviteCode: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", args.clerkId))
      .first();

    if (!existing) {
      if (args.studentNo) {
        const duplicate = await ctx.db
          .query("users")
          .withIndex("by_studentno", (q) => q.eq("studentNo", args.studentNo))
          .first();

        if (duplicate) {
          throw new Error("Student number is already registered.");
        }
      }

      // Only advisers must be verified by the admin first.
      // Students and instructors are approved automatically.
      const needsApproval = args.role === "adviser";
      const status = needsApproval ? "pending" : "approved";

      await ctx.db.insert("users", { ...args, status });
      await logAction(
        ctx,
        { clerkId: args.clerkId, name: args.name },
        "User registered",
        `${args.name} registered as ${args.role}${needsApproval ? " (awaiting approval)" : ""}`
      );
    } else {
      // role and status are never patched here
      await ctx.db.patch(existing._id, {
        name: args.name,
        email: args.email,
        image: args.image,
        studentNo: args.studentNo,
        program: args.program,
        section: args.section,
      });
    }
  },
});

export const updateProfile = mutation({
  args: {
    name: v.string(),
    studentNo: v.optional(v.string()),
    program: v.optional(v.string()),
    section: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    if (!user) throw new Error("Not authenticated");

    if (args.studentNo && args.studentNo.trim() !== "") {
      const duplicate = await ctx.db
        .query("users")
        .withIndex("by_studentno", (q) => q.eq("studentNo", args.studentNo))
        .first();

      if (duplicate && duplicate._id !== user._id) {
        throw new Error("Student number is already registered.");
      }
    }

    await ctx.db.patch(user._id, {
      name: args.name,
      studentNo: args.studentNo,
      program: args.program,
      section: args.section,
    });
  },
});

// ---------- queries ----------
export const getMe = query({
  args: {},
  handler: async (ctx) => {
    return await getCurrentUser(ctx);
  },
});

// Only approved advisers can be assigned to teams
export const getAdvisers = query({
  args: {},
  handler: async (ctx) => {
    const advisers = await ctx.db
      .query("users")
      .withIndex("by_role", (q) => q.eq("role", "adviser"))
      .collect();
    return advisers.filter(
      (a) => a.status !== "pending" && a.status !== "rejected"
    );
  },
});

export const getStudents = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db
      .query("users")
      .withIndex("by_role", (q) => q.eq("role", "student"))
      .collect();
  },
});

// ---------- admin ----------
export const listAllUsers = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    return await ctx.db.query("users").collect();
  },
});

export const approveUser = mutation({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const admin = await requireAdmin(ctx);

    const target = await ctx.db.get(args.userId);
    if (!target) throw new Error("User not found");

    await ctx.db.patch(args.userId, { status: "approved" });
    await logAction(
      ctx,
      admin,
      "Approved account",
      `${target.name} (${target.role})`
    );
  },
});

export const rejectUser = mutation({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const admin = await requireAdmin(ctx);

    const target = await ctx.db.get(args.userId);
    if (!target) throw new Error("User not found");
    if (target.role === "admin") {
      throw new Error("The admin account can't be rejected.");
    }

    await ctx.db.patch(args.userId, { status: "rejected" });
    await logAction(
      ctx,
      admin,
      "Rejected account",
      `${target.name} (${target.role})`
    );
  },
});

// Admin is NOT assignable here: there is exactly one admin account.
export const setUserRole = mutation({
  args: {
    userId: v.id("users"),
    role: v.union(
      v.literal("student"),
      v.literal("instructor"),
      v.literal("adviser")
    ),
  },
  handler: async (ctx, args) => {
    const admin = await requireAdmin(ctx);

    const target = await ctx.db.get(args.userId);
    if (!target) throw new Error("User not found");
    if (target.role === "admin") {
      throw new Error("The admin account's role can't be changed.");
    }

    await ctx.db.patch(args.userId, { role: args.role });
    await logAction(
      ctx,
      admin,
      "Changed user role",
      `${target.name}: ${target.role} → ${args.role}`
    );
  },
});

// Removes a user from the system (Convex only; see notes about Clerk).
export const deleteUser = mutation({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const admin = await requireAdmin(ctx);

    const target = await ctx.db.get(args.userId);
    if (!target) throw new Error("User not found");
    if (target.role === "admin") {
      throw new Error("The admin account can't be deleted.");
    }

    const teams = await ctx.db.query("capstoneProjects").collect();

    // Don't leave a team without its adviser or instructor
    const supervised = teams.filter(
      (t) => t.adviserId === target._id || t.instructorId === target._id
    );
    if (supervised.length > 0) {
      throw new Error(
        `${target.name} is the adviser or instructor of ${supervised.length} team(s). Reassign those teams first.`
      );
    }

    // Remove from any team they're a member of
    for (const team of teams) {
      if ((team.members ?? []).includes(target._id)) {
        await ctx.db.patch(team._id, {
          members: (team.members ?? []).filter((m) => m !== target._id),
        });
      }
    }

    // Clear their notifications
    const notifications = await ctx.db
      .query("notifications")
      .withIndex("by_user", (q) => q.eq("userId", target._id))
      .collect();
    for (const n of notifications) {
      await ctx.db.delete(n._id);
    }

    await ctx.db.delete(target._id);
    await logAction(
      ctx,
      admin,
      "Deleted user",
      `${target.name} (${target.email}), ${target.role}`
    );
  },
});

// Run from the Convex dashboard to create the one admin:
// { "email": "you@example.com" }
// Refuses to run if an admin already exists.
export const makeAdmin = internalMutation({
  args: { email: v.string() },
  handler: async (ctx, args) => {
    const existingAdmin = await ctx.db
      .query("users")
      .withIndex("by_role", (q) => q.eq("role", "admin"))
      .first();
    if (existingAdmin) {
      throw new Error("An admin already exists. Only one admin is allowed.");
    }

    const user = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", args.email))
      .first();

    if (!user) {
      throw new Error("No user with that email. Sign up first, then run this.");
    }

    await ctx.db.patch(user._id, { role: "admin" });
  },
});