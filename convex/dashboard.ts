import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { api } from "./_generated/api";

export const getMyProject = query({
  args: { clerkId: v.string() },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", args.clerkId))
      .first();

    if (!user) return null;

    const projects = await ctx.db.query("capstoneProjects").collect();
    const myProject = projects.find(p => p.members && p.members.includes(user._id));
    
    return myProject || null;
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

export const getStudentTeams = query({
  args: { studentId: v.string() },
  handler: async (ctx, args) => {
    const allProjects = await ctx.db.query("capstoneProjects").collect();
    return allProjects.filter(p => p.members && p.members.includes(args.studentId));
  },
});

export const createCapstoneProject = mutation({
  args: {
    teamName: v.string(),
    projectTitle: v.string(),
    adviserId: v.string(),
    members: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    const projectId = await ctx.db.insert("capstoneProjects", {
      teamName: args.teamName,
      projectTitle: args.projectTitle,
      phase: "Proposal",
      progress: 0,
      approved: 0,
      underReview: 0,
      needsRevision: 0,
      adviserId: args.adviserId,
      members: args.members,
    });

    for (const memberId of args.members) {
      await ctx.runMutation(api.notifications.sendNotification, {
        userId: memberId,
        message: `You have been added to team "${args.teamName}" for project "${args.projectTitle}".`,
        type: "team_created",
        relatedId: projectId,
      });
    }

    await ctx.runMutation(api.notifications.sendNotification, {
      userId: args.adviserId,
      message: `You have been assigned as adviser for team "${args.teamName}" on project "${args.projectTitle}".`,
      type: "team_created",
      relatedId: projectId,
    });

    return projectId;
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
    const taskId = await ctx.db.insert("tasks", {
      capstoneProjectId: args.capstoneProjectId,
      title: args.title,
      description: args.description,
      assignedTo: args.assignedTo,
      dueDate: args.dueDate,
      status: args.status,
    });

    const project = await ctx.db.get(args.capstoneProjectId);
    if (project && project.members) {
      for (const memberId of project.members) {
        await ctx.runMutation(api.notifications.sendNotification, {
          userId: memberId,
          message: `A new task "${args.title}" has been assigned to your team. Due date: ${args.dueDate}.`,
          type: "task_assigned",
          relatedId: taskId,
        });
      }
    }

    return taskId;
  },
});

export const getProjectMembers = query({
  args: { capstoneProjectId: v.id("capstoneProjects") },
  handler: async (ctx, args) => {
    const project = await ctx.db.get(args.capstoneProjectId);
    if (!project || !project.members) return [];
    
    const members = [];
    for (const memberId of project.members) {
      const allUsers = await ctx.db.query("users").collect();
      const user = allUsers.find(u => u._id === memberId);
      if (user) members.push(user);
    }
    return members;
  },
});

export const getProjectAdviser = query({
  args: { capstoneProjectId: v.id("capstoneProjects") },
  handler: async (ctx, args) => {
    const project = await ctx.db.get(args.capstoneProjectId);
    if (!project || !project.adviserId) return null;
    
    const allUsers = await ctx.db.query("users").collect();
    const adviser = allUsers.find(u => u._id === project.adviserId);
    return adviser || null;
  },
});


export const getFileUrl = query({
  args: { storageId: v.id("_storage") },
  handler: async (ctx, args) => {
    return await ctx.storage.getUrl(args.storageId);
  },
});