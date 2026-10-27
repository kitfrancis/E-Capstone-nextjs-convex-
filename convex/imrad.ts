import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
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
        v.literal("rejected"),
        v.literal("verification"),
        v.literal("changes_requested"),
        v.literal("approved"),
        v.literal("completed"),
        v.literal("archived")
      ),
      rejectionMessage: v.union(v.string(), v.null()),
      verificationComment: v.union(v.string(), v.null()),
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
        const workingDocument = await ctx.db
          .query("imradWorkingDocuments")
          .withIndex("by_submission", (q) =>
            q.eq("submissionId", submission._id)
          )
          .unique();

        return {
          submissionId: submission._id,
          projectId: submission.capstoneProjectId,
          status: submission.status,
          rejectionMessage: submission.rejectionMessage ?? null,
          verificationComment: submission.verificationComment ?? null,
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
          revision: v.number(),
          savedAt: v.union(v.number(), v.null()),
        }),
        v.null()
      ),
      year: v.number(),
      instructorName: v.string(),
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
      verificationComment: v.union(v.string(), v.null()),
      requiredSaveRevision: v.number(),
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
    const activeStatuses = [
      "submitted",
      "processing",
      "verification",
      "changes_requested",
      "approved",
      "completed",
    ] as const;
    const submissionsByStatus = await Promise.all(
      activeStatuses.map((status) =>
        ctx.db
          .query("imradSubmissions")
          .withIndex("by_status_submitted_at", (q) => q.eq("status", status))
          .order("desc")
          .take(100)
      )
    );
    const submissions = submissionsByStatus.flat();

    return await Promise.all(
      submissions.map(async (submission) => {
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
                revision: workingDocument.revision ?? 0,
                savedAt: workingDocument.savedAt ?? null,
              }
            : null,
          year: project ? new Date(project._creationTime).getFullYear() : new Date(submission.submittedAt).getFullYear(),
          instructorName: instructor?.name ?? "Unknown instructor",
          description: submission.description,
          status: submission.status,
          verificationComment: submission.verificationComment ?? null,
          requiredSaveRevision: submission.requiredSaveRevision ?? 1,
          submittedAt: submission.submittedAt,
          evaluationFiles,
        };
      })
    );
  },
});

export const myVerificationSubmissions = query({
  args: {},
  returns: v.array(
    v.object({
      submissionId: v.id("imradSubmissions"),
      projectId: v.id("capstoneProjects"),
      teamName: v.string(),
      projectTitle: v.string(),
      fileName: v.string(),
      fileUrl: v.union(v.string(), v.null()),
      submittedAt: v.number(),
    })
  ),
  handler: async (ctx) => {
    const instructor = await getCurrentUser(ctx);
    if (
      !instructor ||
      instructor.role !== "instructor" ||
      instructor.status === "pending" ||
      instructor.status === "rejected"
    ) {
      return [];
    }

    const submissions = await ctx.db
      .query("imradSubmissions")
      .withIndex("by_instructor_status", (q) =>
        q.eq("instructorId", instructor._id).eq("status", "verification")
      )
      .take(100);

    return await Promise.all(
      submissions.map(async (submission) => {
        const [project, workingDocument] = await Promise.all([
          ctx.db.get(submission.capstoneProjectId),
          ctx.db
            .query("imradWorkingDocuments")
            .withIndex("by_submission", (q) =>
              q.eq("submissionId", submission._id)
            )
            .unique(),
        ]);
        if (!workingDocument) {
          throw new Error("A final verification submission is missing its PDF.");
        }
        return {
          submissionId: submission._id,
          projectId: submission.capstoneProjectId,
          teamName: project?.teamName ?? "Deleted team",
          projectTitle: project?.projectTitle ?? "Project unavailable",
          fileName: workingDocument.fileName,
          fileUrl: await ctx.storage.getUrl(workingDocument.storageId),
          submittedAt: submission.processedAt ?? submission.submittedAt,
        };
      })
    );
  },
});

export const adminWorkingDocumentStatus = query({
  args: { submissionId: v.id("imradSubmissions") },
  returns: v.union(
    v.object({
      revision: v.number(),
      savedAt: v.union(v.number(), v.null()),
      requiredSaveRevision: v.number(),
    }),
    v.null()
  ),
  handler: async (ctx, { submissionId }) => {
    await requireAdmin(ctx);
    const submission = await ctx.db.get(submissionId);
    if (!submission) throw new Error("Submission not found.");
    const workingDocument = await ctx.db
      .query("imradWorkingDocuments")
      .withIndex("by_submission", (q) => q.eq("submissionId", submissionId))
      .unique();
    if (!workingDocument) return null;
    return {
      revision: workingDocument.revision ?? 0,
      savedAt: workingDocument.savedAt ?? null,
      requiredSaveRevision: submission.requiredSaveRevision ?? 1,
    };
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
    if (
      !submission ||
      !["processing", "changes_requested"].includes(submission.status)
    ) {
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
    if (partNumber === 4) {
      await ctx.db.patch(submission._id, {
        requiredSaveRevision: (workingDocument.revision ?? 0) + 1,
      });
    }
    await ctx.db.insert("notifications", {
      userId: (await ctx.db.get(submission.instructorId))?.clerkId ?? submission.instructorId,
      message: partNumber === 4
        ? `${project.teamName}'s IMRaD Part 4 is complete. The admin can save the PDF and submit it for final verification.`
        : `${project.teamName}'s IMRAD conversion is complete through Part ${partNumber} - ${imradPartNames[partNumber - 1]} (${partNumber}/4).`,
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

export const generateAdminWorkingDocumentUploadUrl = mutation({
  args: { secret: v.string() },
  returns: v.string(),
  handler: async (ctx, { secret }) => {
    if (secret !== process.env.ONLYOFFICE_SECRET) throw new Error("Forbidden");
    return await ctx.storage.generateUploadUrl();
  },
});

export const saveAdminWorkingDocumentFile = mutation({
  args: {
    secret: v.string(),
    submissionId: v.id("imradSubmissions"),
    storageId: v.id("_storage"),
  },
  returns: v.number(),
  handler: async (ctx, { secret, submissionId, storageId }) => {
    if (secret !== process.env.ONLYOFFICE_SECRET) throw new Error("Forbidden");
    const submission = await ctx.db.get(submissionId);
    if (!submission || !["processing", "changes_requested"].includes(submission.status)) {
      throw new Error("This IMRaD document cannot be saved in its current state.");
    }

    const metadata = await ctx.db.system.get("_storage", storageId);
    if (metadata?.contentType !== "application/pdf") {
      throw new Error("The saved IMRaD document must be a PDF.");
    }

    const workingDocument = await ctx.db
      .query("imradWorkingDocuments")
      .withIndex("by_submission", (q) => q.eq("submissionId", submissionId))
      .unique();
    if (!workingDocument) throw new Error("The team IMRaD document was not found.");

    const revision = (workingDocument.revision ?? 0) + 1;
    await ctx.db.patch(workingDocument._id, {
      storageId,
      revision,
      savedAt: Date.now(),
    });
    if (workingDocument.storageId !== storageId) {
      await ctx.storage.delete(workingDocument.storageId);
    }
    return revision;
  },
});

export const submitFinalVerification = mutation({
  args: { submissionId: v.id("imradSubmissions") },
  returns: v.null(),
  handler: async (ctx, { submissionId }) => {
    const admin = await requireAdmin(ctx);
    const submission = await ctx.db.get(submissionId);
    if (!submission || !["processing", "changes_requested"].includes(submission.status)) {
      throw new Error("This IMRaD document is not ready to submit for verification.");
    }
    const project = await ctx.db.get(submission.capstoneProjectId);
    if (!project) throw new Error("Project not found.");
    const workingDocument = await ctx.db
      .query("imradWorkingDocuments")
      .withIndex("by_submission", (q) => q.eq("submissionId", submissionId))
      .unique();
    if (
      !workingDocument ||
      (workingDocument.completedParts ?? []).length !== 4 ||
      workingDocument.savedAt === undefined ||
      (workingDocument.revision ?? 0) < (submission.requiredSaveRevision ?? 1)
    ) {
      throw new Error("Save the completed four-part IMRaD PDF before submitting final verification.");
    }

    await ctx.db.patch(submissionId, {
      status: "verification",
      verificationComment: undefined,
      processedAt: Date.now(),
    });
    await ctx.db.insert("notifications", {
      userId: (await ctx.db.get(submission.instructorId))?.clerkId ?? submission.instructorId,
      message: `${project.teamName}'s IMRaD PDF is ready for your final verification.`,
      read: false,
      type: "imrad_verification",
      relatedId: submissionId,
      link: "/dashboard/instructor/verification",
    });
    await logAction(ctx, admin, "Submitted IMRaD PDF for instructor verification", project.teamName);
    return null;
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
    const user = await getCurrentUser(ctx);
    if (!user) throw new Error("Not authenticated.");
    const submission = await ctx.db.get(args.submissionId);
    if (!submission) throw new Error("Submission not found.");
    if (
      !["processing", "changes_requested", "verification"].includes(
        submission.status
      )
    ) {
      throw new Error("This IMRaD submission can no longer be canceled.");
    }

    if (user.role === "admin") {
      await requireAdmin(ctx);
    } else {
      const instructor = await requireInstructor(ctx);
      if (
        submission.status !== "verification" ||
        submission.instructorId !== instructor._id
      ) {
        throw new Error("You can only cancel your team's pending verification.");
      }
    }

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
      user,
      "Canceled IMRAD processing and deleted submission files",
      project.teamName
    );
    return null;
  },
});

export const completeConversion = mutation({
  args: { submissionId: v.id("imradSubmissions") },
  returns: v.null(),
  handler: async (ctx, { submissionId }) => {
    const admin = await requireAdmin(ctx);
    const submission = await ctx.db.get(submissionId);
    if (!submission || submission.status !== "approved") {
      throw new Error("Only an instructor-approved IMRaD document can be completed.");
    }
    const project = await ctx.db.get(submission.capstoneProjectId);
    if (!project) throw new Error("Project not found.");
    const workingDocument = await ctx.db
      .query("imradWorkingDocuments")
      .withIndex("by_submission", (q) => q.eq("submissionId", submissionId))
      .unique();
    if (!workingDocument || !workingDocument.savedAt) {
      throw new Error("The final IMRaD PDF is not saved.");
    }

    await ctx.db.patch(submissionId, { status: "completed" });
    const members = new Set([...(project.members ?? []), submission.instructorId]);
    for (const memberId of members) {
      const id = ctx.db.normalizeId("users", memberId);
      const member = id ? await ctx.db.get(id) : null;
      if (!member) continue;
      await ctx.db.insert("notifications", {
        userId: member.clerkId,
        message: `${project.teamName}'s IMRaD conversion is complete and ready in the project archive.`,
        read: false,
        type: "imrad_complete",
        relatedId: submissionId,
        link: "/components/Archive",
      });
    }
    await logAction(ctx, admin, "Completed IMRaD conversion", project.teamName);
    return null;
  },
});

export const archiveCompletedConversion = mutation({
  args: { submissionId: v.id("imradSubmissions") },
  returns: v.null(),
  handler: async (ctx, { submissionId }) => {
    const admin = await requireAdmin(ctx);
    const submission = await ctx.db.get(submissionId);
    if (!submission || submission.status !== "completed") {
      throw new Error("Complete the approved IMRaD conversion before archiving it.");
    }
    const project = await ctx.db.get(submission.capstoneProjectId);
    if (!project) throw new Error("Project not found.");
    const workingDocument = await ctx.db
      .query("imradWorkingDocuments")
      .withIndex("by_submission", (q) => q.eq("submissionId", submissionId))
      .unique();
    if (!workingDocument || !workingDocument.savedAt) {
      throw new Error("The final IMRaD PDF is not saved.");
    }

    const memberNames: string[] = [];
    let course = "Capstone";
    for (const memberId of project.members ?? []) {
      const id = ctx.db.normalizeId("users", memberId);
      const member = id ? await ctx.db.get(id) : null;
      if (member) {
        memberNames.push(member.name);
        if (course === "Capstone" && member.program) course = member.program;
      }
    }
    let adviserName = "—";
    if (project.adviserId) {
      const adviserId = ctx.db.normalizeId("users", project.adviserId);
      const adviser = adviserId ? await ctx.db.get(adviserId) : null;
      if (adviser) adviserName = adviser.name;
    }

    let archiveEntry = await ctx.db
      .query("projects")
      .withIndex("by_capstone_project", (q) => q.eq("capstoneProjectId", project._id))
      .first();
    if (!archiveEntry) {
      const candidates = await ctx.db
        .query("projects")
        .withIndex("by_team_title", (q) =>
          q.eq("team", project.teamName).eq("title", project.projectTitle)
        )
        .take(100);
      archiveEntry =
        candidates.find((candidate) => candidate.storageId === project.finalFileId) ??
        (candidates.length === 1 ? candidates[0] : null);
    }
    if (!archiveEntry) {
      const archiveFileId = project.finalFileId ?? workingDocument.storageId;
      const archiveEntryId = await ctx.db.insert("projects", {
        capstoneProjectId: project._id,
        title: project.projectTitle,
        team: project.teamName,
        year: new Date(project._creationTime).getFullYear(),
        course,
        grade: project.finalGrade ?? "—",
        abstract: project.abstract ?? submission.description,
        archivedDate: new Date().toISOString(),
        keywords: project.keywords ?? [],
        members: memberNames,
        adviser: adviserName,
        storageId: archiveFileId,
        additionalFiles:
          archiveFileId === workingDocument.storageId
            ? []
            : [{ storageId: workingDocument.storageId, fileName: workingDocument.fileName }],
      });
      archiveEntry = await ctx.db.get(archiveEntryId);
      if (!archiveEntry) throw new Error("Could not create the project archive entry.");
    } else {
      const additionalFiles = archiveEntry.additionalFiles ?? [];
      if (
        archiveEntry.storageId !== workingDocument.storageId &&
        additionalFiles.some((file) => file.storageId === workingDocument.storageId)
      ) {
        throw new Error("This IMRaD PDF is already in the project archive.");
      }
      await ctx.db.patch(archiveEntry._id, {
        capstoneProjectId: project._id,
        ...(archiveEntry.storageId !== workingDocument.storageId
          ? {
              additionalFiles: [
                ...additionalFiles,
                { storageId: workingDocument.storageId, fileName: workingDocument.fileName },
              ],
            }
          : {}),
        course: archiveEntry.course || course,
        members: archiveEntry.members.length > 0 ? archiveEntry.members : memberNames,
        adviser: archiveEntry.adviser || adviserName,
      });
    }
    await ctx.db.patch(submissionId, { status: "archived" });
    await ctx.db.patch(project._id, {
      stage: "archived",
      archivedAt: project.archivedAt ?? Date.now(),
    });
    await logAction(ctx, admin, "Added completed IMRaD PDF to project archive", project.teamName);
    return null;
  },
});

export const reviewFinalVerification = mutation({
  args: {
    submissionId: v.id("imradSubmissions"),
    decision: v.union(v.literal("approve"), v.literal("request_changes")),
    comment: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const instructor = await requireInstructor(ctx);
    const submission = await ctx.db.get(args.submissionId);
    if (
      !submission ||
      submission.instructorId !== instructor._id ||
      submission.status !== "verification"
    ) {
      throw new Error("This IMRaD document is not awaiting your verification.");
    }
    const project = await ctx.db.get(submission.capstoneProjectId);
    if (!project) throw new Error("Project not found.");
    const workingDocument = await ctx.db
      .query("imradWorkingDocuments")
      .withIndex("by_submission", (q) =>
        q.eq("submissionId", submission._id)
      )
      .unique();
    if (!workingDocument || (workingDocument.completedParts ?? []).length !== 4) {
      throw new Error("All four IMRaD parts must be complete before verification.");
    }

    if (args.decision === "request_changes") {
      const comment = args.comment?.trim() ?? "";
      if (!comment) throw new Error("Enter a comment explaining the requested changes.");
      const requiredSaveRevision = (workingDocument.revision ?? 0) + 1;
      await ctx.db.patch(submission._id, {
        status: "changes_requested",
        verificationComment: comment,
        requiredSaveRevision,
      });
      await notifyAdmins(ctx, `${project.teamName}'s IMRaD PDF needs changes: ${comment}`, submission._id);
      await logAction(
        ctx,
        instructor,
        "Requested IMRaD verification changes",
        project.teamName
      );
      return null;
    }

    await ctx.db.patch(submission._id, {
      status: "approved",
      verificationComment: undefined,
    });
    await notifyAdmins(
      ctx,
      `${project.teamName}'s final IMRaD PDF was approved and is ready for the admin's final action.`,
      submission._id
    );
    await logAction(ctx, instructor, "Approved final IMRaD verification", project.teamName);
    return null;
  },
});

export const confirmAdminWorkingDocumentHasNoPendingChanges = mutation({
  args: { submissionId: v.id("imradSubmissions") },
  returns: v.null(),
  handler: async (ctx, { submissionId }) => {
    await requireAdmin(ctx);
    const submission = await ctx.db.get(submissionId);
    if (!submission || !["processing", "changes_requested"].includes(submission.status)) {
      throw new Error("This IMRaD document cannot be confirmed in its current state.");
    }
    const workingDocument = await ctx.db
      .query("imradWorkingDocuments")
      .withIndex("by_submission", (q) => q.eq("submissionId", submissionId))
      .unique();
    if (
      !workingDocument ||
      (workingDocument.completedParts ?? []).length !== 4
    ) {
      throw new Error("Save the completed four-part IMRaD PDF before confirming it.");
    }

    const metadata = await ctx.db.system.get("_storage", workingDocument.storageId);
    if (metadata?.contentType !== "application/pdf") {
      throw new Error("The current IMRaD working document is not a saved PDF.");
    }

    const savedAt = workingDocument.savedAt ?? Date.now();
    await ctx.db.patch(submissionId, {
      requiredSaveRevision: workingDocument.revision ?? 0,
    });
    if (!workingDocument.savedAt) {
      await ctx.db.patch(workingDocument._id, { savedAt });
    }
    return null;
  },
});

async function notifyAdmins(
  ctx: MutationCtx,
  message: string,
  submissionId: Id<"imradSubmissions">
) {
  const admins = await ctx.db
    .query("users")
    .withIndex("by_role", (q) => q.eq("role", "admin"))
    .take(100);
  for (const admin of admins) {
    await ctx.db.insert("notifications", {
      userId: admin.clerkId,
      message,
      read: false,
      type: "imrad_verification",
      relatedId: submissionId,
      link: "/dashboard/admin/imrad-processing",
    });
  }
}
