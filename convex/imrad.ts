import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { requireAdmin, logAction } from "./users";

async function getCurrentUser(ctx: QueryCtx | MutationCtx) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) return null;

  return await ctx.db
    .query("users")
    .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
    .unique();
}

async function requireInstructor(ctx: MutationCtx) {
  const user = await getCurrentUser(ctx);
  if (!user) throw new Error("Not authenticated");
  if (user.role !== "instructor" || user.status === "pending" || user.status === "rejected") {
    throw new Error("Approved instructor access required");
  }
  return user;
}

const evaluationFileValidator = v.object({
  storageId: v.id("_storage"),
  fileName: v.string(),
});

export const generateEvaluationUploadUrl = mutation({
  args: {},
  returns: v.string(),
  handler: async (ctx) => {
    await requireInstructor(ctx);
    return await ctx.storage.generateUploadUrl();
  },
});

export const submitPanelEvaluations = mutation({
  args: {
    projectId: v.id("capstoneProjects"),
    evaluationFiles: v.array(evaluationFileValidator),
    description: v.string(),
  },
  returns: v.id("imradSubmissions"),
  handler: async (ctx, args) => {
    const instructor = await requireInstructor(ctx);
    if (args.evaluationFiles.length !== 3) {
      throw new Error("Exactly three panel evaluation PDFs are required.");
    }

    for (const file of args.evaluationFiles) {
      if (!file.fileName.trim().toLowerCase().endsWith(".pdf")) {
        throw new Error("Panel evaluations must be PDF files.");
      }
    }
    const description = args.description.trim();
    if (!description) throw new Error("Submission details are required.");

    const project = await ctx.db.get(args.projectId);
    if (!project) throw new Error("Project not found.");
    if (project.instructorId !== instructor._id) {
      throw new Error("You can only submit evaluations for your own team.");
    }
    if (project.stage !== "ready_to_archive" || project.defenseResult !== "passed") {
      throw new Error("Only teams accepted without revisions can be submitted for IMRAD processing.");
    }

    const existing = await ctx.db
      .query("imradSubmissions")
      .withIndex("by_project", (q) => q.eq("capstoneProjectId", project._id))
      .unique();
    if (existing && existing.status !== "rejected") {
      throw new Error("This team has already been submitted for IMRAD processing.");
    }

    if (existing) {
      const previousStorageIds = new Set(
        existing.evaluationFiles.map((file) => file.storageId)
      );
      await Promise.all(
        [...previousStorageIds].map((storageId) => ctx.storage.delete(storageId))
      );
      await ctx.db.patch(existing._id, {
        evaluationFiles: args.evaluationFiles,
        description,
        status: "submitted",
        submittedAt: Date.now(),
        processedAt: undefined,
        rejectionMessage: undefined,
      });
      await logAction(
        ctx,
        instructor,
        "Resubmitted panel evaluations for IMRAD processing",
        project.teamName
      );
      return existing._id;
    }

    const submissionId = await ctx.db.insert("imradSubmissions", {
      capstoneProjectId: project._id,
      instructorId: instructor._id,
      evaluationFiles: args.evaluationFiles,
      description,
      status: "submitted",
      submittedAt: Date.now(),
    });

    await logAction(
      ctx,
      instructor,
      "Submitted panel evaluations for IMRAD processing",
      project.teamName
    );
    return submissionId;
  },
});

export const myInstructorSubmissions = query({
  args: {},
  returns: v.array(
    v.object({
      submissionId: v.id("imradSubmissions"),
      projectId: v.id("capstoneProjects"),
      status: v.union(
        v.literal("submitted"),
        v.literal("processing"),
        v.literal("rejected")
      ),
      rejectionMessage: v.union(v.string(), v.null()),
      workingDocumentFileName: v.union(v.string(), v.null()),
      completedParts: v.array(v.number()),
    })
  ),
  handler: async (ctx) => {
    const user = await getCurrentUser(ctx);
    if (
      !user ||
      user.role !== "instructor" ||
      user.status === "pending" ||
      user.status === "rejected"
    ) {
      return [];
    }

    const submissions = await ctx.db
      .query("imradSubmissions")
      .withIndex("by_instructor_status", (q) => q.eq("instructorId", user._id))
      .take(100);

    return await Promise.all(
      submissions.map(async (submission) => {
        const workingDocument =
          submission.status === "processing"
            ? await ctx.db
                .query("imradWorkingDocuments")
                .withIndex("by_submission", (q) =>
                  q.eq("submissionId", submission._id)
                )
                .unique()
            : null;

        return {
          submissionId: submission._id,
          projectId: submission.capstoneProjectId,
          status: submission.status,
          rejectionMessage: submission.rejectionMessage ?? null,
          workingDocumentFileName: workingDocument?.fileName ?? null,
          completedParts: workingDocument?.completedParts ?? [],
        };
      })
    );
  },
});

export const adminSubmissions = query({
  args: {},
  returns: v.array(
    v.object({
      submissionId: v.id("imradSubmissions"),
      projectId: v.id("capstoneProjects"),
      teamName: v.string(),
      projectTitle: v.string(),
      workingDocument: v.union(
        v.object({
          storageId: v.id("_storage"),
          fileName: v.string(),
          url: v.union(v.string(), v.null()),
          completedParts: v.array(v.number()),
        }),
        v.null()
      ),
      year: v.number(),
      instructorName: v.string(),
      description: v.string(),
      status: v.union(v.literal("submitted"), v.literal("processing")),
      submittedAt: v.number(),
      evaluationFiles: v.array(
        v.object({
          fileName: v.string(),
          url: v.union(v.string(), v.null()),
        })
      ),
    })
  ),
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const [submitted, processing] = await Promise.all([
      ctx.db
        .query("imradSubmissions")
        .withIndex("by_status_submitted_at", (q) => q.eq("status", "submitted"))
        .order("desc")
        .take(100),
      ctx.db
        .query("imradSubmissions")
        .withIndex("by_status_submitted_at", (q) => q.eq("status", "processing"))
        .order("desc")
        .take(100),
    ]);

    return await Promise.all(
      [...submitted, ...processing].map(async (submission) => {
        if (submission.status !== "submitted" && submission.status !== "processing") {
          throw new Error("Unexpected IMRAD submission status.");
        }
        const [project, instructor, evaluationFiles, workingDocument] = await Promise.all([
          ctx.db.get(submission.capstoneProjectId),
          ctx.db.get(submission.instructorId),
          Promise.all(
            submission.evaluationFiles.map(async (file) => ({
              fileName: file.fileName,
              url: await ctx.storage.getUrl(file.storageId),
            }))
          ),
          ctx.db
            .query("imradWorkingDocuments")
            .withIndex("by_submission", (q) => q.eq("submissionId", submission._id))
            .unique(),
        ]);

        return {
          submissionId: submission._id,
          projectId: submission.capstoneProjectId,
          teamName: project?.teamName ?? "Deleted team",
          projectTitle: project?.projectTitle ?? "Project unavailable",
          workingDocument: workingDocument
            ? {
                storageId: workingDocument.storageId,
                fileName: workingDocument.fileName,
                url: await ctx.storage.getUrl(workingDocument.storageId),
                completedParts: workingDocument.completedParts ?? [],
              }
            : null,
          year: project ? new Date(project._creationTime).getFullYear() : new Date(submission.submittedAt).getFullYear(),
          instructorName: instructor?.name ?? "Unknown instructor",
          description: submission.description,
          status: submission.status,
          submittedAt: submission.submittedAt,
          evaluationFiles,
        };
      })
    );
  },
});

const imradPartNames = [
  "Introduction",
  "Methodology",
  "Results",
  "Discussion",
] as const;

export const completeWorkingDocumentPart = mutation({
  args: {
    submissionId: v.id("imradSubmissions"),
    partNumber: v.union(
      v.literal(1),
      v.literal(2),
      v.literal(3),
      v.literal(4)
    ),
  },
  returns: v.number(),
  handler: async (ctx, { submissionId, partNumber }) => {
    const admin = await requireAdmin(ctx);
    const submission = await ctx.db.get(submissionId);
    if (!submission || submission.status !== "processing") {
      throw new Error("This project is not in IMRAD processing.");
    }

    const project = await ctx.db.get(submission.capstoneProjectId);
    if (!project) throw new Error("Project not found.");

    const workingDocument = await ctx.db
      .query("imradWorkingDocuments")
      .withIndex("by_submission", (q) => q.eq("submissionId", submissionId))
      .unique();
    if (!workingDocument) {
      throw new Error("Create the team IMRAD guide copy before marking a part complete.");
    }

    const completedParts = workingDocument.completedParts ?? [];
    if (completedParts.includes(partNumber)) return completedParts.length;
    if (partNumber !== completedParts.length + 1) {
      throw new Error("Complete the IMRAD parts in order.");
    }

    await ctx.db.patch(workingDocument._id, {
      completedParts: [...completedParts, partNumber],
    });
    await ctx.db.insert("notifications", {
      userId: submission.instructorId,
      message: `${project.teamName}'s IMRAD conversion is complete through Part ${partNumber} - ${imradPartNames[partNumber - 1]} (${partNumber}/4).`,
      read: false,
      type: "imrad_progress",
      relatedId: submission._id,
      link: "/dashboard/instructor",
    });
    await logAction(
      ctx,
      admin,
      `Completed IMRAD Part ${partNumber}`,
      project.teamName
    );

    return partNumber;
  },
});

export const saveWorkingDocument = mutation({
  args: {
    submissionId: v.id("imradSubmissions"),
    storageId: v.id("_storage"),
  },
  returns: v.object({
    storageId: v.id("_storage"),
    fileName: v.string(),
    url: v.union(v.string(), v.null()),
  }),
  handler: async (ctx, { submissionId, storageId }) => {
    const admin = await requireAdmin(ctx);
    const submission = await ctx.db.get(submissionId);
    if (!submission || submission.status !== "processing") {
      throw new Error("This project is not in IMRAD processing.");
    }

    const project = await ctx.db.get(submission.capstoneProjectId);
    if (!project) throw new Error("Project not found.");

    const metadata = await ctx.db.system.get("_storage", storageId);
    if (metadata?.contentType !== "application/pdf") {
      throw new Error("The IMRAD working document must be a PDF.");
    }

    const existing = await ctx.db
      .query("imradWorkingDocuments")
      .withIndex("by_submission", (q) => q.eq("submissionId", submissionId))
      .unique();
    if (existing) {
      if (existing.storageId !== storageId) await ctx.storage.delete(storageId);
      return {
        storageId: existing.storageId,
        fileName: existing.fileName,
        url: await ctx.storage.getUrl(existing.storageId),
      };
    }

    const fileName = `${project.teamName} - IMRAD Conversion Guide.pdf`;
    await ctx.db.insert("imradWorkingDocuments", {
      submissionId,
      projectId: project._id,
      storageId,
      fileName,
      createdBy: admin._id,
      createdAt: Date.now(),
    });
    await logAction(ctx, admin, "Created IMRAD working document", project.teamName);
    return {
      storageId,
      fileName,
      url: await ctx.storage.getUrl(storageId),
    };
  },
});

export const deleteInvalidSubmission = mutation({
  args: { submissionId: v.id("imradSubmissions") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const admin = await requireAdmin(ctx);
    const submission = await ctx.db.get(args.submissionId);
    if (!submission) throw new Error("Submission not found.");
    if (submission.status !== "submitted") {
      throw new Error("Only unprocessed submissions can be deleted.");
    }
    if (submission.evaluationFiles.length === 3) {
      throw new Error("Only submissions with an incorrect number of panel evaluations can be deleted here.");
    }

    const project = await ctx.db.get(submission.capstoneProjectId);
    const storageIds = new Set(submission.evaluationFiles.map((file) => file.storageId));
    await Promise.all([...storageIds].map((storageId) => ctx.storage.delete(storageId)));
    await ctx.db.delete(submission._id);
    await logAction(
      ctx,
      admin,
      "Deleted IMRAD submission with an invalid panel evaluation count",
      `${project?.teamName ?? "Deleted team"} (${submission.evaluationFiles.length} files)`
    );
    return null;
  },
});

export const processSubmission = mutation({
  args: { submissionId: v.id("imradSubmissions") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const admin = await requireAdmin(ctx);
    const submission = await ctx.db.get(args.submissionId);
    if (!submission) throw new Error("Submission not found.");
    if (submission.status !== "submitted") throw new Error("Submission is already being processed.");

    const project = await ctx.db.get(submission.capstoneProjectId);
    if (!project) throw new Error("Project not found.");
    await ctx.db.patch(submission._id, { status: "processing", processedAt: Date.now() });
    await logAction(ctx, admin, "Started IMRAD processing", project.teamName);
    return null;
  },
});

export const rejectSubmission = mutation({
  args: {
    submissionId: v.id("imradSubmissions"),
    rejectionMessage: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const admin = await requireAdmin(ctx);
    const submission = await ctx.db.get(args.submissionId);
    if (!submission) throw new Error("Submission not found.");
    if (submission.status !== "submitted") {
      throw new Error("Only submitted evaluations can be rejected.");
    }

    const rejectionMessage = args.rejectionMessage.trim();
    if (!rejectionMessage) throw new Error("Provide a reason for rejecting this submission.");

    const project = await ctx.db.get(submission.capstoneProjectId);
    if (!project) throw new Error("Project not found.");
    await ctx.db.patch(submission._id, {
      status: "rejected",
      rejectionMessage,
      processedAt: undefined,
    });
    await logAction(ctx, admin, "Rejected IMRAD evaluation submission", project.teamName);
    return null;
  },
});

export const cancelProcessing = mutation({
  args: { submissionId: v.id("imradSubmissions") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const admin = await requireAdmin(ctx);
    const submission = await ctx.db.get(args.submissionId);
    if (!submission) throw new Error("Submission not found.");
    if (submission.status !== "processing") throw new Error("Submission isn't being processed.");

    const project = await ctx.db.get(submission.capstoneProjectId);
    if (!project) throw new Error("Project not found.");

    const workingDocument = await ctx.db
      .query("imradWorkingDocuments")
      .withIndex("by_submission", (q) => q.eq("submissionId", submission._id))
      .unique();
    const storageIds = new Set([
      ...submission.evaluationFiles.map((file) => file.storageId),
      ...(workingDocument ? [workingDocument.storageId] : []),
    ]);
    await Promise.all(
      [...storageIds].map((storageId) => ctx.storage.delete(storageId))
    );
    if (workingDocument) await ctx.db.delete(workingDocument._id);
    await ctx.db.delete(submission._id);
    await logAction(
      ctx,
      admin,
      "Canceled IMRAD processing and deleted submission files",
      project.teamName
    );
    return null;
  },
});
