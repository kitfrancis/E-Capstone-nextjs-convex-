import { v } from "convex/values";
import { query } from "./_generated/server";
import type { QueryCtx } from "./_generated/server";
import { throwUserError } from "./errors";

const verificationQueueEntry = v.object({
  submissionId: v.id("imradSubmissions"),
  teamName: v.string(),
  projectTitle: v.string(),
  instructorName: v.string(),
  submittedAt: v.number(),
  documentUrl: v.union(v.string(), v.null()),
  completedParts: v.array(v.number()),
});

async function requireCoordinator(ctx: QueryCtx) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) throwUserError("Not authenticated");

  const user = await ctx.db
    .query("users")
    .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
    .unique();
  if (
    !user ||
    user.role !== "coordinator" ||
    user.status === "pending" ||
    user.status === "rejected" ||
    user.mustChangePassword === true
  ) {
    throwUserError("Approved coordinator access required");
  }
  return user;
}

async function countSubmissions(
  ctx: QueryCtx,
  status: "verification" | "approved" | "completed" | "changes_requested" | "archived"
) {
  return (
    await ctx.db
      .query("imradSubmissions")
      .withIndex("by_status_submitted_at", (q) => q.eq("status", status))
      .take(101)
  ).length;
}

export const getDashboardStats = query({
  args: {},
  returns: v.object({
    awaitingVerification: v.number(),
    verified: v.number(),
    returned: v.number(),
    archived: v.number(),
  }),
  handler: async (ctx) => {
    await requireCoordinator(ctx);

    const [
      awaitingVerification,
      approved,
      completed,
      returned,
      archived,
    ] = await Promise.all([
      countSubmissions(ctx, "verification"),
      countSubmissions(ctx, "approved"),
      countSubmissions(ctx, "completed"),
      countSubmissions(ctx, "changes_requested"),
      countSubmissions(ctx, "archived"),
    ]);

    return {
      awaitingVerification,
      verified: approved + completed,
      returned,
      archived,
    };
  },
});

export const recentActivity = query({
  args: {},
  returns: v.array(
    v.object({
      _id: v.id("auditLogs"),
      _creationTime: v.number(),
      action: v.string(),
      details: v.string(),
      userName: v.string(),
    })
  ),
  handler: async (ctx) => {
    await requireCoordinator(ctx);

    const logs = await ctx.db.query("auditLogs").order("desc").take(100);
    return logs
      .filter((log) => /imrad|archive/i.test(log.action))
      .slice(0, 8)
      .map(({ _id, _creationTime, action, details, userName }) => ({
        _id,
        _creationTime,
        action,
        details,
        userName,
      }));
  },
});

export const listFinalVerificationQueue = query({
  args: {},
  returns: v.array(verificationQueueEntry),
  handler: async (ctx) => {
    await requireCoordinator(ctx);

    const submissions = await ctx.db
      .query("imradSubmissions")
      .withIndex("by_status_submitted_at", (q) =>
        q.eq("status", "verification")
      )
      .order("desc")
      .take(100);

    return await Promise.all(
      submissions.map(async (submission) => {
        const [project, instructor, workingDocument] = await Promise.all([
          ctx.db.get(submission.capstoneProjectId),
          ctx.db.get(submission.instructorId),
          ctx.db
            .query("imradWorkingDocuments")
            .withIndex("by_submission", (q) =>
              q.eq("submissionId", submission._id)
            )
            .unique(),
        ]);

        return {
          submissionId: submission._id,
          teamName: project?.teamName ?? "Deleted team",
          projectTitle: project?.projectTitle ?? "Project unavailable",
          instructorName: instructor?.name ?? "Unknown instructor",
          submittedAt: submission.submittedAt,
          documentUrl: workingDocument
            ? await ctx.storage.getUrl(workingDocument.storageId)
            : null,
          completedParts: workingDocument?.completedParts ?? [],
        };
      })
    );
  },
});
