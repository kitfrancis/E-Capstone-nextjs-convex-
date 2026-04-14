import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const getMyProject = query({
  args: { clerkId: v.string(),  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("capstoneProjects")
      .first();
  },
});

export const getDeliverables = query({
  args: { capstoneProjectId: v.id("capstoneProjects") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("deliverables")
      .filter(q => q.eq(q.field("capstoneProjectId"), args.capstoneProjectId))
      .collect();
  },
});

export const getTasks = query({
  args: { capstoneProjectId: v.id("capstoneProjects") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("tasks")
      .filter(q => q.eq(q.field("capstoneProjectId"), args.capstoneProjectId))
      .collect();
  },
});


export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    return await ctx.storage.generateUploadUrl();
  },
});

export const saveDeliverable = mutation({
  args: {
    storageId: v.id("_storage"),
    fileName: v.string(),
    phase: v.string(),
    fileSize: v.string(),
    capstoneProjectId: v.id("capstoneProjects"),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("deliverables", {
      capstoneProjectId: args.capstoneProjectId,
      fileName: args.fileName,
      phase: args.phase,
      version: 1,
      status: "under_review",
      fileSize: args.fileSize,
      uploadedAt: new Date().toISOString(),
      comments: 0,
      storageId: args.storageId,
    });
  },
});

export const getTeams = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("capstoneProjects").collect();
  },
});

export const createTask = mutation({
  args: {
    capstoneProjectId: v.id("capstoneProjects"),
    title: v.string(),
    description: v.string(),
    assignedTo: v.string(),
    dueDate: v.string(),
    status: v.union(
      v.literal("completed"),
      v.literal("in_progress"),
      v.literal("pending")
    ),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("tasks", {
      capstoneProjectId: args.capstoneProjectId,
      title: args.title,
      description: args.description,
      assignedTo: args.assignedTo,
      dueDate: args.dueDate,
      status: args.status,
    });
  },
});
