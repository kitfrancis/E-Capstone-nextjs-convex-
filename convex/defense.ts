import { mutation, query } from "./_generated/server";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { paginationOptsValidator, paginationResultValidator } from "convex/server";
import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import { logAction } from "./users";
// Relative import: the "@/" alias may not resolve inside the convex/ folder.
// If lib/progress.ts imports anything with "@/", copy computeProgress into convex/ instead.
import { computeProgress } from "../lib/progress";

async function currentUser(ctx: QueryCtx | MutationCtx) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) return null;
  return await ctx.db
    .query("users")
    .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
    .unique();
}

const IMRAD_PHASE = "IMRaD Final";

async function latestImrad(ctx: QueryCtx | MutationCtx, projectId: Id<"capstoneProjects">) {
  const docs = await ctx.db
    .query("deliverables")
    .withIndex("by_capstone_project", (q) => q.eq("capstoneProjectId", projectId))
    .collect();
  return (
    docs
      .filter((d) => d.phase === IMRAD_PHASE)
      .sort((a, b) => b.version - a.version || b.uploadedAt.localeCompare(a.uploadedAt))[0] ?? null
  );
}

// How far the team is in the final revisions: a chapter counts as "revised" when its
// latest version was uploaded after the defense result was recorded.
async function revisionState(ctx: QueryCtx | MutationCtx, project: Doc<"capstoneProjects">) {
  const deliverables = await ctx.db
    .query("deliverables")
    .withIndex("by_capstone_project", (q) => q.eq("capstoneProjectId", project._id))
    .collect();
  const progress = computeProgress(deliverables);
  const since = project.defenseRecordedAt ?? 0;
  let revised = 0;
  let approved = 0;
  for (const c of progress.chapters) {
    const d = c.latestId ? deliverables.find((x) => x._id === c.latestId) : undefined;
    if (d && Date.parse(d.uploadedAt) > since) {
      revised++;
      if (d.status === "approved") approved++;
    }
  }
  return { revised, approved, total: progress.chapters.length };
}

// Status of the team's latest IMRaD file. Only the project's instructor or admin can see it.
export const imradStatus = query({
  args: { projectId: v.id("capstoneProjects") },
  handler: async (ctx, args) => {
    const user = await currentUser(ctx);
    const project = user ? await ctx.db.get(args.projectId) : null;
    if (!user || !project) return null;
    const isOwner = user.role === "instructor" && project.instructorId === user._id;
    if (!isOwner && user.role !== "admin") return null;
    return (await latestImrad(ctx, project._id))?.status ?? null;
  },
});

// Projects the admin needs to verify and archive
export const endorsedForArchiving = query({
  args: {},
  handler: async (ctx) => {
    const user = await currentUser(ctx);
    if (!user || user.role !== "admin") return [];
    const all = await ctx.db
      .query("capstoneProjects")
      .filter((q) => q.eq(q.field("stage"), "ready_to_archive"))
      .collect();
    return all.filter((p) => p.archiveEndorsedAt);
  },
});

export const endorseForArchiving = mutation({
  args: { projectId: v.id("capstoneProjects") },
  handler: async (ctx, args) => {
    const { user, project } = await requireSupervisor(ctx, args.projectId);
    if (user.role !== "instructor") {
      throw new Error("Only the project's instructor can endorse it for archiving.");
    }
    if (project.stage !== "ready_to_archive") {
      throw new Error("This project isn't ready to be endorsed.");
    }
    if (project.archiveEndorsedAt) throw new Error("Already endorsed for archiving.");

    const imrad = await latestImrad(ctx, project._id);
    if (!imrad || imrad.status !== "approved") {
      throw new Error("Approve the team's IMRaD file before endorsing.");
    }

    await ctx.db.patch(project._id, { archiveEndorsedAt: Date.now() });

    const admins = await ctx.db
      .query("users")
      .withIndex("by_role", (q) => q.eq("role", "admin"))
      .take(100);
    for (const admin of admins) {
      await ctx.db.insert("notifications", {
        userId: admin.clerkId,
        message: `${project.teamName} was endorsed for archiving and needs your final verification.`,
        read: false,
        type: "archive_endorsement",
        relatedId: project._id,
        link: "/dashboard/admin", // change to your admin page
      });
    }
    await logAction(ctx, user, "Endorsed for archiving", project.teamName);
  },
});

// Only the project's own instructor (or the admin) can move it through defense.
async function requireSupervisor(ctx: MutationCtx, projectId: Id<"capstoneProjects">) {
  const user = await currentUser(ctx);
  if (!user) throw new Error("Not authenticated");
  if (user.status === "pending" || user.status === "rejected") {
    throw new Error("Your account isn't approved.");
  }
  const project = await ctx.db.get(projectId);
  if (!project) throw new Error("Project not found");
  const isOwner = user.role === "instructor" && project.instructorId === user._id;
  if (user.role !== "admin" && !isOwner) {
    throw new Error("Only this project's instructor can do this.");
  }
  return { user, project };
}

export const myInstructorProjects = query({
  args: {},
  handler: async (ctx) => {
    const user = await currentUser(ctx);
    if (!user || user.role !== "instructor") return [];
    const all = await ctx.db.query("capstoneProjects").collect();
    return all.filter((p) => p.instructorId === user._id);
  },
});

export const myImradReadyProjects = query({
  args: { paginationOpts: paginationOptsValidator },
  returns: paginationResultValidator(
    v.object({
      projectId: v.id("capstoneProjects"),
      teamName: v.string(),
      projectTitle: v.string(),
      finalFileId: v.union(v.id("_storage"), v.null()),
      finalGrade: v.union(v.string(), v.null()),
      defenseDate: v.union(v.string(), v.null()),
      defenseVenue: v.union(v.string(), v.null()),
      defensePanel: v.union(v.string(), v.null()),
      acceptedAt: v.number(),
    })
  ),
  handler: async (ctx, args) => {
    const user = await currentUser(ctx);
    if (
      !user ||
      user.role !== "instructor" ||
      user.status === "pending" ||
      user.status === "rejected"
    ) {
      return { page: [], isDone: true, continueCursor: "" };
    }

    const result = await ctx.db
      .query("capstoneProjects")
      .withIndex("by_instructor_stage_result", (q) =>
        q
          .eq("instructorId", user._id)
          .eq("stage", "ready_to_archive")
          .eq("defenseResult", "passed")
      )
      .order("desc")
      .paginate(args.paginationOpts);

    return {
      ...result,
      page: result.page.map((project) => ({
        projectId: project._id,
        teamName: project.teamName,
        projectTitle: project.projectTitle,
        finalFileId: project.finalFileId ?? null,
        finalGrade: project.finalGrade ?? null,
        defenseDate: project.defenseDate ?? null,
        defenseVenue: project.defenseVenue ?? null,
        defensePanel: project.defensePanel ?? null,
        acceptedAt: project._creationTime,
      })),
    };
  },
});

export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    if (!(await ctx.auth.getUserIdentity())) throw new Error("Not authenticated");
    return await ctx.storage.generateUploadUrl();
  },
});

/**
 * Auto "ready for defense". Progress is recomputed on the server, so a client
 * can't fake it. Safe to call repeatedly: it does nothing if the project
 * already has a stage.
 *
 *  1. Chapters 1-3 approved (and no passed proposal yet) -> "proposal_endorsed"
 *  2. Proposal passed and every chapter approved (100%) -> "endorsed" (final defense)
 */
export const syncDefenseReadiness = mutation({
  args: { projectId: v.id("capstoneProjects") },
  handler: async (ctx, args) => {
    const user = await currentUser(ctx);
    if (!user) return;

    const project = await ctx.db.get(args.projectId);
    if (!project || project.stage) return; // already in the pipeline

    const isMember = (project.members ?? []).includes(user._id);
    const isOwner = user.role === "instructor" && project.instructorId === user._id;
    if (!isMember && !isOwner && user.role !== "admin") return;

    // Swap in your real index here if you have one (e.g. "by_project")
    const deliverables = await ctx.db
      .query("deliverables")
      .filter((q) => q.eq(q.field("capstoneProjectId"), project._id))
      .collect();
    const progress = computeProgress(deliverables);

    const proposalDone =
      project.proposalResult === "passed" ||
      project.proposalResult === "passed_with_revisions";

    // Step 1: chapters 1-3 approved -> proposal defense
    if (!proposalDone) {
      const ch13Done = progress.chapters.slice(0, 3).every((c) => c.status === "approved");
      if (!ch13Done) return;
      await ctx.db.patch(project._id, {
        stage: "proposal_endorsed",
        proposalEndorsedAt: Date.now(),
      });
      await logAction(ctx, user, "Auto-endorsed for proposal defense", project.teamName);
      return;
    }

    // Step 2: proposal passed and all chapters approved -> final defense
    if (progress.total < 100) return;
    await ctx.db.patch(project._id, { stage: "endorsed", endorsedAt: Date.now() });
    await logAction(ctx, user, "Auto-endorsed for defense", project.teamName);
  },
});

// Manual fallback (no longer used by the UI)
export const endorseForDefense = mutation({
  args: { projectId: v.id("capstoneProjects") },
  handler: async (ctx, args) => {
    const { user, project } = await requireSupervisor(ctx, args.projectId);
    if (project.stage) throw new Error("This project was already endorsed.");

    await ctx.db.patch(project._id, { stage: "endorsed", endorsedAt: Date.now() });
    await logAction(ctx, user, "Endorsed for defense", project.teamName);
  },
});

// ───────────── Proposal defense (after Chapters 1-3) ─────────────

export const scheduleProposalDefense = mutation({
  args: {
    projectId: v.id("capstoneProjects"),
    date: v.string(), // "YYYY-MM-DDTHH:mm"
    venue: v.string(),
    panel: v.string(),
  },
  handler: async (ctx, args) => {
    const { user, project } = await requireSupervisor(ctx, args.projectId);
    if (project.stage !== "proposal_endorsed" && project.stage !== "proposal_scheduled") {
      throw new Error("This project isn't ready for a proposal defense.");
    }
    if (!args.date.trim() || !args.venue.trim() || !args.panel.trim()) {
      throw new Error("Date, venue and panel are required.");
    }

    await ctx.db.patch(project._id, {
      stage: "proposal_scheduled",
      proposalDate: args.date,
      proposalVenue: args.venue.trim(),
      proposalPanel: args.panel.trim(),
      proposalResult: undefined, // clears a previous "failed" result on re-defense
    });
    await logAction(ctx, user, "Scheduled proposal defense", `${project.teamName}: ${args.date}`);
  },
});

export const recordProposalResult = mutation({
  args: {
    projectId: v.id("capstoneProjects"),
    result: v.union(
      v.literal("passed"),
      v.literal("passed_with_revisions"),
      v.literal("failed")
    ),
  },
  handler: async (ctx, args) => {
    const { user, project } = await requireSupervisor(ctx, args.projectId);
    if (project.stage !== "proposal_scheduled") {
      throw new Error("There's no scheduled proposal defense to record a result for.");
    }

    if (args.result === "failed") {
      // Back to "proposal_endorsed" so the instructor can schedule a re-defense
      await ctx.db.patch(project._id, {
        stage: "proposal_endorsed",
        proposalResult: "failed",
        proposalDate: undefined,
        proposalVenue: undefined,
        proposalPanel: undefined,
      });
    } else {
      // Leaves the pipeline so the student can work on Chapters 4-5
      await ctx.db.patch(project._id, {
        stage: undefined,
        proposalResult: args.result,
      });
    }
    await logAction(
      ctx,
      user,
      "Recorded proposal defense result",
      `${project.teamName}: ${args.result}`
    );
  },
});

// ───────────── Final defense ─────────────

export const scheduleDefense = mutation({
  args: {
    projectId: v.id("capstoneProjects"),
    date: v.string(), // "YYYY-MM-DDTHH:mm"
    venue: v.string(),
    panel: v.string(),
  },
  handler: async (ctx, args) => {
    const { user, project } = await requireSupervisor(ctx, args.projectId);
    if (project.stage !== "endorsed" && project.stage !== "defense_scheduled") {
      throw new Error("Endorse the project before scheduling a defense.");
    }
    if (!args.date.trim() || !args.venue.trim() || !args.panel.trim()) {
      throw new Error("Date, venue and panel are required.");
    }

    await ctx.db.patch(project._id, {
      stage: "defense_scheduled",
      defenseDate: args.date,
      defenseVenue: args.venue.trim(),
      defensePanel: args.panel.trim(),
      defenseResult: undefined, // clears a previous "failed" result on re-defense
    });
    await logAction(ctx, user, "Scheduled defense", `${project.teamName}: ${args.date}`);
  },
});

// Status only (Pass / Pass with Revisions / Fail). No numerical grade.
export const recordDefenseResult = mutation({
  args: {
    projectId: v.id("capstoneProjects"),
    result: v.union(
      v.literal("passed"),
      v.literal("passed_with_revisions"),
      v.literal("failed")
    ),
    grade: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { user, project } = await requireSupervisor(ctx, args.projectId);
    if (project.stage !== "defense_scheduled") {
      throw new Error("There's no scheduled defense to record a result for.");
    }

    if (args.result === "failed") {
      // Back to "endorsed" so the instructor can schedule a re-defense
      await ctx.db.patch(project._id, {
        stage: "endorsed",
        defenseResult: "failed",
        defenseDate: undefined,
        defenseVenue: undefined,
        defensePanel: undefined,
        finalGrade: undefined,
        defenseRecordedAt: undefined,
      });
    } else {
      await ctx.db.patch(project._id, {
        // Pass: straight to IMRaD. Pass with revisions: evaluation forms, then revisions.
        stage: args.result === "passed" ? "ready_to_archive" : "final_revisions",
        defenseResult: args.result,
        finalGrade: args.result === "passed" ? "Passed" : "Passed with revisions",
        defenseRecordedAt: Date.now(),
      });
    }
    await logAction(ctx, user, "Recorded defense result", `${project.teamName}: ${args.result}`);
  },
});

// ───────────── Evaluation forms + final revisions ─────────────

// Instructor uploads the 3 panel evaluation forms. Students see them once saved.
export const uploadEvaluationForms = mutation({
  args: {
    projectId: v.id("capstoneProjects"),
    files: v.array(v.object({ storageId: v.id("_storage"), fileName: v.string() })),
  },
  handler: async (ctx, args) => {
    const { user, project } = await requireSupervisor(ctx, args.projectId);
    if (project.stage !== "final_revisions") {
      throw new Error("Evaluation forms are only needed for a 'passed with revisions' result.");
    }
    if (args.files.length !== 3) throw new Error("Upload exactly 3 evaluation forms.");

    await ctx.db.patch(project._id, { evaluationForms: args.files });

    for (const m of project.members ?? []) {
      const id = ctx.db.normalizeId("users", m);
      const member = id ? await ctx.db.get(id) : null;
      if (member) {
        await ctx.db.insert("notifications", {
          userId: member.clerkId,
          message: "The panel evaluation forms are ready. Review them before submitting your final revisions.",
          read: false,
          type: "evaluation_forms",
          relatedId: project._id,
          link: "/dashboard/student",
        });
      }
    }
    await logAction(ctx, user, "Uploaded evaluation forms", project.teamName);
  },
});

// Forms (with download links) and revision progress for the student dashboard card
export const finalRevisionInfo = query({
  args: { projectId: v.id("capstoneProjects") },
  handler: async (ctx, args) => {
    const user = await currentUser(ctx);
    const project = user ? await ctx.db.get(args.projectId) : null;
    if (!user || !project) return null;

    const isMember = (project.members ?? []).includes(user._id);
    const isOwner = user.role === "instructor" && project.instructorId === user._id;
    if (!isMember && !isOwner && user.role !== "admin") return null;

    const forms: { fileName: string; url: string | null }[] = [];
    for (const f of project.evaluationForms ?? []) {
      forms.push({ fileName: f.fileName, url: await ctx.storage.getUrl(f.storageId) });
    }
    const rev = project.stage === "final_revisions" ? await revisionState(ctx, project) : null;

    return {
      stage: project.stage ?? null,
      forms,
      revised: rev?.revised ?? 0,
      approved: rev?.approved ?? 0,
      total: rev?.total ?? 0,
    };
  },
});

// When every chapter has been resubmitted and approved, unlock the IMRaD upload.
// Safe to call repeatedly; the server recomputes everything.
export const syncFinalRevisions = mutation({
  args: { projectId: v.id("capstoneProjects") },
  handler: async (ctx, args) => {
    const user = await currentUser(ctx);
    if (!user) return;
    const project = await ctx.db.get(args.projectId);
    if (!project || project.stage !== "final_revisions") return;

    const isMember = (project.members ?? []).includes(user._id);
    const isOwner = user.role === "instructor" && project.instructorId === user._id;
    if (!isMember && !isOwner && user.role !== "admin") return;

    if ((project.evaluationForms ?? []).length < 3) return;
    const s = await revisionState(ctx, project);
    if (s.revised < s.total || s.approved < s.total) return;

        await ctx.db.patch(project._id, { stage: "ready_to_archive" });
    await logAction(ctx, user, "Final revisions approved", project.teamName);

    for (const m of project.members ?? []) {
      const id = ctx.db.normalizeId("users", m);
      const member = id ? await ctx.db.get(id) : null;
      if (member) {
        await ctx.db.insert("notifications", {
          userId: member.clerkId,
          message: "Your final revisions were approved. You can now upload your IMRaD file.",
          read: false,
          type: "deliverable_approved",
          relatedId: project._id,
          link: "/dashboard/student",
        });
      }
    }
  },
});

// Replaced by chapter-by-chapter final revisions (see syncFinalRevisions).
export const submitFinalManuscript = mutation({
  args: { projectId: v.id("capstoneProjects"), fileId: v.id("_storage") },
  handler: async () => {
    throw new Error("Final revisions are now submitted chapter by chapter.");
  },
});

export const archiveProject = mutation({
  args: {
    projectId: v.id("capstoneProjects"),
    abstract: v.string(),
    keywords: v.array(v.string()),
    fileId: v.optional(v.id("_storage")),
  },
  handler: async (ctx, args) => {
    const { user, project } = await requireSupervisor(ctx, args.projectId);
    if (user.role !== "admin") throw new Error("Only the admin can verify and archive.");
    if (project.stage !== "ready_to_archive") {
      throw new Error("This project isn't ready to archive.");
    }
    if (!project.archiveEndorsedAt) {
      throw new Error("The instructor hasn't endorsed this project for archiving yet.");
    }

    const abstract = args.abstract.trim();
    const keywords = args.keywords.map((k) => k.trim()).filter(Boolean);
    const imrad = await latestImrad(ctx, project._id);
    const finalFileId = args.fileId ?? imrad?.storageId ?? project.finalFileId;
    if (!abstract || keywords.length < 3 || !finalFileId) {
      throw new Error("Abstract, 3+ keywords and the final file are required.");
    }
    const grade = project.finalGrade ?? "Passed";

    // Resolve member and adviser names for the archive entry
    const memberNames: string[] = [];
    let course = "Capstone";
    for (const m of project.members ?? []) {
      const id = ctx.db.normalizeId("users", m);
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

    const now = new Date();

    // The archive page reads from the `projects` table
    await ctx.db.insert("projects", {
      capstoneProjectId: project._id,
      title: project.projectTitle,
      team: project.teamName,
      year: now.getFullYear(),
      course,
      grade,
      abstract,
      archivedDate: now.toISOString(),
      keywords,
      members: memberNames,
      adviser: adviserName,
      storageId: finalFileId,
    });

    await ctx.db.patch(project._id, {
      stage: "archived",
      archivedAt: now.getTime(),
      finalGrade: grade,
      abstract,
      keywords,
      finalFileId,
    });
    await logAction(ctx, user, "Archived project", project.teamName);
  },
});