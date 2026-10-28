import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  users: defineTable({
    clerkId: v.string(),
    name: v.string(),
    studentNo: v.optional(v.string()),
    program: v.optional(v.string()),
    section: v.optional(v.string()),
    email: v.string(),
    image: v.optional(v.string()),
    role: v.union(
      v.literal("student"),
      v.literal("instructor"),
      v.literal("adviser"),
      v.literal("admin")
    ),
    status: v.optional(
      v.union(
        v.literal("pending"),
        v.literal("approved"),
        v.literal("rejected")
      )
    ),
    inviteCode: v.optional(v.string()),
  })
    .index("by_clerk_id", ["clerkId"])
    .index("by_studentno", ["studentNo"])
    .index("by_role", ["role"])
    .index("by_email", ["email"]),

  projects: defineTable({
    capstoneProjectId: v.optional(v.id("capstoneProjects")),
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
    storageId: v.optional(v.id("_storage")),
    additionalFiles: v.optional(
      v.array(
        v.object({
          storageId: v.id("_storage"),
          fileName: v.string(),
        })
      )
    ),
  })
    .index("by_capstone_project", ["capstoneProjectId"])
    .index("by_team_title", ["team", "title"]),

  capstoneProjects: defineTable({
    teamName: v.string(),
    projectTitle: v.string(),
    phase: v.string(),
    progress: v.number(),
    approved: v.number(),
    underReview: v.number(),
    needsRevision: v.number(),
    adviserId: v.optional(v.string()),
    instructorId: v.optional(v.string()),
    members: v.optional(v.array(v.string())),
    teamRoles: v.optional(
      v.array(
        v.object({
          memberId: v.id("users"),
          role: v.union(
            v.literal("Project Manager"),
            v.literal("Programmer"),
            v.literal("Designer"),
            v.literal("System Analyst"),
            v.literal("System Architect")
          ),
        })
      )
    ),
    inviteCode: v.optional(v.string()),

    // Defense pipeline
    stage: v.optional(
      v.union(
        v.literal("endorsed"),
        v.literal("defense_scheduled"),
        v.literal("final_revisions"),
        v.literal("ready_to_archive"),
        v.literal("archived")
      )
    ),
    endorsedAt: v.optional(v.number()),
    defenseDate: v.optional(v.string()), // "2026-11-12T09:00"
    defenseVenue: v.optional(v.string()),
    defensePanel: v.optional(v.string()),
    defenseResult: v.optional(
      v.union(
        v.literal("passed"),
        v.literal("passed_with_revisions"),
        v.literal("failed")
      )
    ),
    finalGrade: v.optional(v.string()),
    abstract: v.optional(v.string()),
    keywords: v.optional(v.array(v.string())),
    finalFileId: v.optional(v.id("_storage")),
    archivedAt: v.optional(v.number()),
  })
    .index("by_inviteCode", ["inviteCode"])
    .index("by_instructor_stage_result", ["instructorId", "stage", "defenseResult"]),

  imradSubmissions: defineTable({
    capstoneProjectId: v.id("capstoneProjects"),
    instructorId: v.id("users"),
    evaluationFiles: v.array(
      v.object({
        storageId: v.id("_storage"),
        fileName: v.string(),
      })
    ),
    description: v.string(),
    status: v.union(
      v.literal("submitted"),
      v.literal("processing"),
      v.literal("rejected"),
      v.literal("verification"),
      v.literal("changes_requested"),
      v.literal("approved"),
      v.literal("completed"),
      v.literal("archived")
    ),
    submittedAt: v.number(),
    processedAt: v.optional(v.number()),
    rejectionMessage: v.optional(v.string()),
    verificationComment: v.optional(v.string()),
    requiredSaveRevision: v.optional(v.number()),
  })
    .index("by_project", ["capstoneProjectId"])
    .index("by_instructor_status", ["instructorId", "status"])
    .index("by_status_submitted_at", ["status", "submittedAt"]),

  imradWorkingDocuments: defineTable({
    submissionId: v.id("imradSubmissions"),
    projectId: v.id("capstoneProjects"),
    storageId: v.id("_storage"),
    fileName: v.string(),
    completedParts: v.optional(v.array(v.number())),
    revision: v.optional(v.number()),
    savedAt: v.optional(v.number()),
    createdBy: v.id("users"),
    createdAt: v.number(),
  }).index("by_submission", ["submissionId"]),

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
    message: v.optional(v.string()),
    versionLabel: v.optional(v.string()),
    submissionDraftId: v.optional(v.id("deliverableDrafts")),
  }),

    deliverableDrafts: defineTable({
    deliverableId: v.id("deliverables"),
    storageId: v.id("_storage"),
    baseVersion: v.number(),
    updatedAt: v.number(),
    saveRevision: v.optional(v.number()),
  }).index("by_deliverable", ["deliverableId"]),

  pdfComments: defineTable({
    deliverableId: v.id("deliverables"),
    userId: v.string(),
    userName: v.string(),
    comment: v.string(),
    pageNumber: v.number(),
    x: v.number(),
    y: v.number(),
    createdAt: v.string(),
  }).index("by_deliverable", ["deliverableId"]),

  tasks: defineTable({
    capstoneProjectId: v.id("capstoneProjects"),
    title: v.string(),
    description: v.string(),
    assignedTo: v.string(),
    dueDate: v.string(),
    status: v.union(
      v.literal("completed"),
      v.literal("in_progress"),
      v.literal("pending"),
      v.literal("under_review"),
      v.literal("needs_revision")
    ),
    batchId: v.optional(v.string()),
    targetRole: v.optional(
      v.union(
        v.literal("Project Manager"),
        v.literal("Programmer"),
        v.literal("Designer"),
        v.literal("System Analyst"),
        v.literal("System Architect")
      )
    ),
  }).index("by_capstone_project", ["capstoneProjectId"]),

  notifications: defineTable({
    userId: v.string(),
    message: v.string(),
    read: v.boolean(),
    type: v.string(),
    relatedId: v.optional(v.string()),
    link: v.optional(v.string()),
  })
    .index("by_user", ["userId"])
    .index("by_user_read", ["userId", "read"]),

  auditLogs: defineTable({
    userId: v.string(),
    userName: v.string(),
    action: v.string(),
    details: v.string(),
  }),

  settings: defineTable({
    systemName: v.string(),
    institutionName: v.string(),
    academicYear: v.string(),
    allowRegistration: v.boolean(),
    requireArchiveApproval: v.boolean(),
    maintenanceMode: v.boolean(),
    supportEmail: v.string(),
    updatedAt: v.number(),
  }),
});