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
    studentNo: v.optional(v.string()),
    program: v.optional(v.string()),
    section: v.optional(v.string()),
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
    } else {
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
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .first();

    if (!user) throw new Error("User not found");

     if (args.studentNo && args.studentNo.trim() !== "") {
  const allUsers = await ctx.db.query("users").collect();
  console.log("All studentNos in DB:", allUsers.map(u => u.studentNo));
  
  const duplicate = await ctx.db
    .query("users")
    .filter((q) => q.eq(q.field("studentNo"), args.studentNo))
    .first();

  console.log("Looking for:", args.studentNo);
  console.log("Duplicate found:", duplicate);

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

export const getMe = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;

    return ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .first();
  },
});

export const getAdvisers = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db
      .query("users")
      .filter((q) => q.eq(q.field("role"), "adviser"))
      .collect();
  },
});

export const getStudents = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db
      .query("users")
      .filter((q) => q.eq(q.field("role"), "student"))
      .collect();
  },
});