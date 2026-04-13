import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";


export default defineSchema({
  users: defineTable({
    clerkId: v.string(),
    name: v.string(),
    email: v.string(),
    image: v.optional(v.string()),
    role: v.union(
      v.literal("student"),
      v.literal("instructor"),
      v.literal("adviser")
    ),
    course: v.optional(v.string()),
  }).index("by_clerk_id", ["clerkId"]),

  projects: defineTable({
    title: v.string(),
    team: v.string(),
    year: v.number(),
    course: v.string(),
    grade: v.string(),
    abstract: v.string(),
    archivedDate: v.string(),
    keywords: v.array(v.string()),
    members: v.array(v.string()),
    adviser: v.string(),
  }),

  capstoneProjects: defineTable({
    teamName: v.string(),
    projectTitle: v.string(),
    phase: v.string(),
    progress: v.number(),
    approved: v.number(),
    underReview: v.number(),
    needsRevision: v.number(),
    adviserId: v.optional(v.string()),
    members: v.array(v.string()),
  }),

  deliverables: defineTable({
    capstoneProjectId: v.id("capstoneProjects"),
    fileName: v.string(),
    phase: v.string(),
    version: v.number(),
    status: v.union(
      v.literal("approved"),
      v.literal("under_review"),
      v.literal("needs_revision")
    ),
    fileSize: v.string(),
    uploadedAt: v.string(),
    comments: v.number(),
  storageId: v.optional(v.id("_storage")),
  }),

  tasks: defineTable({
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
  }),
});