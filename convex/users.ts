import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

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
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", args.clerkId))
      .first();

    if (!existing) {
      await ctx.db.insert("users", args);
    } else {
      await ctx.db.patch(existing._id, {
        name: args.name,
        email: args.email,
        image: args.image,
      });
    }
  },
});

export const updateProfile = mutation({
  args: {
    name: v.string(),
    studentId: v.optional(v.string()),
    course: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .first();

    if (!user) throw new Error("User not found");

    await ctx.db.patch(user._id, {
      name: args.name,
      course: args.course,
    });
  },
});

export const getMe = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;

    return ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject)) // 👈 fixed
      .first();
  },
});


export const getAdvisers = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db
      .query("users")
      .filter(q => q.eq(q.field("role"), "adviser"))
      .collect();
  },
});

export const getStudents = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db
      .query("users")
      .filter(q => q.eq(q.field("role"), "student"))
      .collect();
  },
});