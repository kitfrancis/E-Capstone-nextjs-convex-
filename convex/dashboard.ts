import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const getMyProject = query({
  args: { clerkId: v.string() },
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

export const seed = mutation({
  args: {},
  handler: async (ctx) => {
    const projectId = await ctx.db.insert("capstoneProjects", {
      teamName: "Team Codevenger",
      projectTitle: "E-Capstone: Thesis Management System",
      phase: "Development",
      progress: 10,
      approved: 1,
      underReview: 1,
      needsRevision: 0,
    });

    await ctx.db.insert("deliverables", {
      capstoneProjectId: projectId,
      fileName: "Project Proposal.pdf",
      phase: "Proposal",
      version: 2,
      status: "approved",
      fileSize: "2.0MB",
      uploadedAt: "Oct 24, 2024",
      comments: 1,
    });

    await ctx.db.insert("tasks", {
      capstoneProjectId: projectId,
      title: "Complete User Interface Mockups",
      description: "Design and finalize all user interface mockups for application.",
      assignedTo: "Team",
      dueDate: "Dec 01, 2024",
      status: "completed",
    });
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