import { mutation, query } from "./_generated/server";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { paginationOptsValidator, paginationResultValidator } from "convex/server";
import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
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
 * Auto "ready for defense": once every chapter is approved (progress = 100%),
 * the project moves to the "endorsed" stage by itself. Progress is recomputed
 * on the server, so a client can't fake it. Safe to call repeatedly: it does
 * nothing if the project already has a stage.
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

    if (computeProgress(deliverables).total < 100) return;

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
      });
    } else {
      const grade = args.grade?.trim();
      if (!grade) throw new Error("Enter the final grade.");
      await ctx.db.patch(project._id, {
        stage: args.result === "passed" ? "ready_to_archive" : "final_revisions",
        defenseResult: args.result,
        finalGrade: grade,
      });
    }
    await logAction(ctx, user, "Recorded defense result", `${project.teamName}: ${args.result}`);
  },
});

// Student uploads the revised manuscript after "passed with revisions".
export const submitFinalManuscript = mutation({
  args: { projectId: v.id("capstoneProjects"), fileId: v.id("_storage") },
  handler: async (ctx, args) => {
    const user = await currentUser(ctx);
    if (!user) throw new Error("Not authenticated");
    const project = await ctx.db.get(args.projectId);
    if (!project) throw new Error("Project not found");
    if (!(project.members ?? []).includes(user._id)) {
      throw new Error("You're not a member of this team.");
    }
    if (project.stage !== "final_revisions") {
      throw new Error("Final revisions aren't open for this project.");
    }

    await ctx.db.patch(project._id, { finalFileId: args.fileId, stage: "ready_to_archive" });
    await logAction(ctx, user, "Submitted final manuscript", project.teamName);
  },
});

export const archiveProject = mutation({
  args: {
    projectId: v.id("capstoneProjects"),
    grade: v.string(),
    abstract: v.string(),
    keywords: v.array(v.string()),
    fileId: v.optional(v.id("_storage")),
  },
  handler: async (ctx, args) => {
    const { user, project } = await requireSupervisor(ctx, args.projectId);
    if (project.stage !== "ready_to_archive") {
      throw new Error("This project isn't ready to archive.");
    }

    const grade = args.grade.trim();
    const abstract = args.abstract.trim();
    const keywords = args.keywords.map((k) => k.trim()).filter(Boolean);
    const finalFileId = args.fileId ?? project.finalFileId;
    if (!grade || !abstract || keywords.length < 3 || !finalFileId) {
      throw new Error("Grade, abstract, 3+ keywords and the final file are required.");
    }

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