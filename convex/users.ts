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
      await ctx.db.insert("users", args);
      await logAction(
        ctx,
        { clerkId: args.clerkId, name: args.name },
        "User registered",
        `${args.name} registered as ${args.role}`
      );
    } else {
      // role is never patched here, so admins keep their role on login
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

export const getAdvisers = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db
      .query("users")
      .withIndex("by_role", (q) => q.eq("role", "adviser"))
      .collect();
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

export const setUserRole = mutation({
  args: {
    userId: v.id("users"),
    role: v.union(
      v.literal("student"),
      v.literal("instructor"),
      v.literal("adviser"),
      v.literal("admin")
    ),
  },
  handler: async (ctx, args) => {
    const admin = await requireAdmin(ctx);

    if (admin._id === args.userId && args.role !== "admin") {
      throw new Error("You can't remove your own admin role.");
    }

    const target = await ctx.db.get(args.userId);
    if (!target) throw new Error("User not found");

    await ctx.db.patch(args.userId, { role: args.role });
    await logAction(
      ctx,
      admin,
      "Changed user role",
      `${target.name}: ${target.role} → ${args.role}`
    );
  },
});

// Run from the Convex dashboard to create the first admin:
// { "email": "you@example.com" }
export const makeAdmin = internalMutation({
  args: { email: v.string() },
  handler: async (ctx, args) => {
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