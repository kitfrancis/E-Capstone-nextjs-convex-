import { mutation, query } from "./_generated/server";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { v } from "convex/values";
import { api } from "./_generated/api";
import type { Doc } from "./_generated/dataModel";
import { logAction } from "./users";

type Role = "student" | "instructor" | "adviser" | "admin";

// ---------------------------------------------------------------------------
// Auth helpers
// ---------------------------------------------------------------------------

// Signed-in, approved user for READ queries. Returns null instead of throwing.
async function getCaller(ctx: QueryCtx): Promise<Doc<"users"> | null> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) return null;

  const user = await ctx.db
    .query("users")
    .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
    .first();
  if (!user) return null;
  if (user.status === "pending" || user.status === "rejected") return null;
  return user;
}

// Admin, or the team's adviser / instructor / a member
function canAccess(user: Doc<"users">, project: Doc<"capstoneProjects">) {
  if (user.role === "admin") return true;
  if (project.adviserId === user._id) return true;
  if (project.instructorId === user._id) return true;
  return (project.members ?? []).includes(user._id);
}

// Admin, or THIS team's instructor (for edit/delete/task management)
function canManage(user: Doc<"users">, project: Doc<"capstoneProjects">) {
  if (user.role === "admin") return true;
  return project.instructorId === user._id;
}

// Signed-in, approved user for MUTATIONS. Throws.
async function requireCaller(ctx: MutationCtx) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) throw new Error("Not signed in");

  const user = await ctx.db
    .query("users")
    .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
    .first();
  if (!user) throw new Error("User not found");
  if (user.status === "pending" || user.status === "rejected") {
    throw new Error("Your account is awaiting admin approval");
  }
  return user;
}

// Signed in AND one of the given roles
async function requireRole(ctx: MutationCtx, roles: Role[]) {
  const user = await requireCaller(ctx);
  if (!roles.includes(user.role)) throw new Error("Not authorized");
  return user;
}

// Deletes a deliverable together with its comments and stored file
async function deleteDeliverableCascade(
  ctx: MutationCtx,
  d: Doc<"deliverables">
) {
  const comments = await ctx.db
    .query("pdfComments")
    .withIndex("by_deliverable", (q) => q.eq("deliverableId", d._id))
    .collect();
  for (const c of comments) await ctx.db.delete(c._id);

  if (d.storageId) await ctx.storage.delete(d.storageId);
  await ctx.db.delete(d._id);
}

// ---------------------------------------------------------------------------
// Queries: per-user (the id you pass must be the signed-in user)
// ---------------------------------------------------------------------------

export const getMyProject = query({
  args: { clerkId: v.string() },
  handler: async (ctx, args) => {
    const user = await getCaller(ctx);
    if (!user || user.clerkId !== args.clerkId) return null;

    const projects = await ctx.db.query("capstoneProjects").collect();

    const asMember = projects.find((p) => p.members && p.members.includes(user._id));
    if (asMember) return asMember;

    const asAdviser = projects.find((p) => p.adviserId === user._id);
    if (asAdviser) return asAdviser;

    return null;
  },
});

export const getAdviserProjects = query({
  args: { clerkId: v.string() },
  handler: async (ctx, args) => {
    const user = await getCaller(ctx);
    if (!user || user.clerkId !== args.clerkId) return [];

    const allProjects = await ctx.db.query("capstoneProjects").collect();
    return allProjects.filter((p) => p.adviserId === user._id);
  },
});

export const getStudentTeams = query({
  args: { studentId: v.string() },
  handler: async (ctx, args) => {
    const user = await getCaller(ctx);
    if (!user || user._id !== args.studentId) return [];

    const allProjects = await ctx.db.query("capstoneProjects").collect();
    return allProjects.filter((p) => p.members && p.members.includes(args.studentId));
  },
});

export const getInstructorTeams = query({
  args: { instructorId: v.string() },
  handler: async (ctx, args) => {
    const user = await getCaller(ctx);
    if (!user || (user._id !== args.instructorId && user.role !== "admin")) return [];

    const allProjects = await ctx.db.query("capstoneProjects").collect();
    return allProjects.filter((p) => p.instructorId === args.instructorId);
  },
});

export const getInstructorDeliverables = query({
  args: { instructorId: v.string() },
  handler: async (ctx, args) => {
    const user = await getCaller(ctx);
    if (!user || (user._id !== args.instructorId && user.role !== "admin")) return [];

    const projects = await ctx.db.query("capstoneProjects").order("desc").collect();
    const myProjectIds = new Set(
      projects.filter((p) => p.instructorId === args.instructorId).map((p) => p._id)
    );
    const deliverables = await ctx.db.query("deliverables").collect();
    return await Promise.all(
      deliverables
        .filter((d) => myProjectIds.has(d.capstoneProjectId))
        .map(async (d) => {
          const project = await ctx.db.get(d.capstoneProjectId);
          return { ...d, teamName: project?.teamName ?? "Unknown Team" };
        })
    );
  },
});

export const getInstructorTasks = query({
  args: { instructorId: v.string() },
  handler: async (ctx, args) => {
    const user = await getCaller(ctx);
    if (!user || (user._id !== args.instructorId && user.role !== "admin")) return [];

    const projects = await ctx.db.query("capstoneProjects").collect();
    const myProjectIds = new Set(
      projects.filter((p) => p.instructorId === args.instructorId).map((p) => p._id)
    );
    const tasks = await ctx.db.query("tasks").collect();
    return await Promise.all(
      tasks
        .filter((t) => myProjectIds.has(t.capstoneProjectId))
        .map(async (t) => {
          const project = await ctx.db.get(t.capstoneProjectId);
          return { ...t, teamName: project?.teamName ?? "Unknown Team" };
        })
    );
  },
});

export const getInstructorDashboardData = query({
  args: { instructorId: v.string() },
  handler: async (ctx, args) => {
    const empty = {
      totalTeams: 0,
      activeProjects: 0,
      pendingReviews: 0,
      overdueTasks: 0,
      approvedCount: 0,
      underReviewCount: 0,
      needsRevisionCount: 0,
    };

    const user = await getCaller(ctx);
    if (!user || (user._id !== args.instructorId && user.role !== "admin")) return empty;

    const allProjects = await ctx.db.query("capstoneProjects").collect();
    const myProjects = allProjects.filter((p) => p.instructorId === args.instructorId);
    const myProjectIds = new Set(myProjects.map((p) => p._id));

    const allTasks = await ctx.db.query("tasks").collect();
    const tasks = allTasks.filter((t) => myProjectIds.has(t.capstoneProjectId));

    const allDeliverables = await ctx.db.query("deliverables").collect();
    const deliverables = allDeliverables.filter((d) => myProjectIds.has(d.capstoneProjectId));

    const now = new Date().toISOString();

    return {
      totalTeams: myProjects.length,
      activeProjects: myProjects.length,
      pendingReviews: deliverables.filter((d) => d.status === "under_review").length,
      overdueTasks: tasks.filter((t) => t.dueDate < now && t.status !== "completed").length,
      approvedCount: deliverables.filter((d) => d.status === "approved").length,
      underReviewCount: deliverables.filter((d) => d.status === "under_review").length,
      needsRevisionCount: deliverables.filter((d) => d.status === "needs_revision").length,
    };
  },
});

// ---------------------------------------------------------------------------
// Queries: per-team (you must be on the team, its adviser/instructor, or admin)
// ---------------------------------------------------------------------------

export const getDeliverables = query({
  args: { capstoneProjectId: v.id("capstoneProjects") },
  handler: async (ctx, args) => {
    const user = await getCaller(ctx);
    if (!user) return [];
    const project = await ctx.db.get(args.capstoneProjectId);
    if (!project || !canAccess(user, project)) return [];

    return await ctx.db
      .query("deliverables")
      .filter((q) => q.eq(q.field("capstoneProjectId"), args.capstoneProjectId))
      .order("desc")
      .collect();
  },
});

export const getTasks = query({
  args: { capstoneProjectId: v.id("capstoneProjects") },
  handler: async (ctx, args) => {
    const user = await getCaller(ctx);
    if (!user) return [];
    const project = await ctx.db.get(args.capstoneProjectId);
    if (!project || !canAccess(user, project)) return [];

    return await ctx.db
      .query("tasks")
      .filter((q) => q.eq(q.field("capstoneProjectId"), args.capstoneProjectId))
      .collect();
  },
});

export const getProjectMembers = query({
  args: { capstoneProjectId: v.id("capstoneProjects") },
  handler: async (ctx, args) => {
    const user = await getCaller(ctx);
    if (!user) return [];
    const project = await ctx.db.get(args.capstoneProjectId);
    if (!project || !project.members || !canAccess(user, project)) return [];

    const members = [];
    for (const memberId of project.members) {
      const id = ctx.db.normalizeId("users", memberId);
      if (!id) continue;
      const member = await ctx.db.get(id);
      if (member) members.push(member);
    }
    return members;
  },
});

export const getProjectAdviser = query({
  args: { capstoneProjectId: v.id("capstoneProjects") },
  handler: async (ctx, args) => {
    const user = await getCaller(ctx);
    if (!user) return null;
    const project = await ctx.db.get(args.capstoneProjectId);
    if (!project || !project.adviserId || !canAccess(user, project)) return null;

    const id = ctx.db.normalizeId("users", project.adviserId);
    if (!id) return null;
    return (await ctx.db.get(id)) ?? null;
  },
});

export const getPdfComments = query({
  args: { deliverableId: v.id("deliverables") },
  handler: async (ctx, args) => {
    const user = await getCaller(ctx);
    if (!user) return [];
    const deliverable = await ctx.db.get(args.deliverableId);
    if (!deliverable) return [];
    const project = await ctx.db.get(deliverable.capstoneProjectId);
    if (!project || !canAccess(user, project)) return [];

    return await ctx.db
      .query("pdfComments")
      .withIndex("by_deliverable", (q) => q.eq("deliverableId", args.deliverableId))
      .collect();
  },
});

export const getDashboardData = query({
  args: { capstoneProjectId: v.id("capstoneProjects") },
  handler: async (ctx, args) => {
    const empty = {
      pendingReviews: 0,
      overdueTasks: 0,
      approvedCount: 0,
      underReviewCount: 0,
      needsRevisionCount: 0,
    };

    const user = await getCaller(ctx);
    if (!user) return empty;
    const project = await ctx.db.get(args.capstoneProjectId);
    if (!project || !canAccess(user, project)) return empty;

    const tasks = await ctx.db
      .query("tasks")
      .filter((q) => q.eq(q.field("capstoneProjectId"), args.capstoneProjectId))
      .collect();
    const deliverables = await ctx.db
      .query("deliverables")
      .filter((q) => q.eq(q.field("capstoneProjectId"), args.capstoneProjectId))
      .collect();
    const approvedCount = deliverables.filter((d) => d.status === "approved").length;
    const underReviewCount = deliverables.filter((d) => d.status === "under_review").length;
    const needsRevisionCount = deliverables.filter((d) => d.status === "needs_revision").length;

    const now = new Date().toISOString();

    return {
      pendingReviews: underReviewCount,
      overdueTasks: tasks.filter((t) => t.dueDate < now && t.status !== "completed").length,
      approvedCount,
      underReviewCount,
      needsRevisionCount,
    };
  },
});

// ---------------------------------------------------------------------------
// Queries: system-wide (admin only) or role-scoped
// ---------------------------------------------------------------------------

export const getAllTasks = query({
  args: {},
  handler: async (ctx) => {
    const user = await getCaller(ctx);
    if (!user || user.role !== "admin") return [];

    const tasks = await ctx.db.query("tasks").collect();
    return await Promise.all(
      tasks.map(async (task) => {
        const project = await ctx.db.get(task.capstoneProjectId);
        return { ...task, teamName: project?.teamName ?? "Unknown Team" };
      })
    );
  },
});

export const getAllDeliverables = query({
  args: {},
  handler: async (ctx) => {
    const user = await getCaller(ctx);
    if (!user || user.role !== "admin") return [];

    const deliverables = await ctx.db.query("deliverables").order("desc").collect();
    return await Promise.all(
      deliverables.map(async (d) => {
        const project = await ctx.db.get(d.capstoneProjectId);
        return { ...d, teamName: project?.teamName ?? "Unknown Team" };
      })
    );
  },
});

// Only the teams you belong to or supervise (admin sees all)
export const getTeams = query({
  args: {},
  handler: async (ctx) => {
    const user = await getCaller(ctx);
    if (!user) return [];

    const teams = await ctx.db.query("capstoneProjects").collect();
    if (user.role === "admin") return teams;
    return teams.filter((t) => canAccess(user, t));
  },
});

// Same as api.users.getStudents; kept so existing imports don't break.
// Returns only the fields the UI needs.
export const getStudents = query({
  args: {},
  handler: async (ctx) => {
    const user = await getCaller(ctx);
    if (
      !user ||
      (user.role !== "instructor" && user.role !== "adviser" && user.role !== "admin")
    ) {
      return [];
    }

    const students = await ctx.db
      .query("users")
      .withIndex("by_role", (q) => q.eq("role", "student"))
      .collect();

    return students.map((s) => ({
      _id: s._id,
      name: s.name,
      email: s.email,
      image: s.image,
      studentNo: s.studentNo,
      program: s.program,
      section: s.section,
    }));
  },
});

// Only returns a URL if the file belongs to a deliverable you can access
export const getFileUrl = query({
  args: { storageId: v.id("_storage") },
  handler: async (ctx, args) => {
    const user = await getCaller(ctx);
    if (!user) return null;

    const deliverable = await ctx.db
      .query("deliverables")
      .filter((q) => q.eq(q.field("storageId"), args.storageId))
      .first();
    if (!deliverable) return null;

    const project = await ctx.db.get(deliverable.capstoneProjectId);
    if (!project || !canAccess(user, project)) return null;

    return await ctx.storage.getUrl(args.storageId);
  },
});

// ---------------------------------------------------------------------------
// Deliverables
// ---------------------------------------------------------------------------

export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    await requireCaller(ctx);
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
    const caller = await requireCaller(ctx);

    const project = await ctx.db.get(args.capstoneProjectId);
    if (!project) throw new Error("Team not found");
    if (caller.role !== "admin" && !(project.members ?? []).includes(caller._id)) {
      throw new Error("Not authorized");
    }

    // Next version = highest existing version for this chapter in this project, plus 1
    const existing = await ctx.db
      .query("deliverables")
      .filter((q) =>
        q.and(
          q.eq(q.field("capstoneProjectId"), args.capstoneProjectId),
          q.eq(q.field("phase"), args.phase)
        )
      )
      .collect();
    const version = existing.reduce((max, d) => Math.max(max, d.version), 0) + 1;

    const deliverableId = await ctx.db.insert("deliverables", {
      capstoneProjectId: args.capstoneProjectId,
      fileName: args.fileName,
      phase: args.phase,
      version,
      status: "under_review",
      fileSize: args.fileSize,
      uploadedAt: new Date().toISOString(),
      comments: 0,
      storageId: args.storageId,
    });

    await logAction(
      ctx,
      caller,
      "Uploaded deliverable",
      `${args.fileName} (v${version}) for team "${project.teamName}"`
    );

    if (project.adviserId) {
      await ctx.runMutation(api.notifications.sendNotification, {
        userId: project.adviserId,
        message: `Team "${project.teamName}" uploaded ${
          version > 1 ? `version ${version} of ` : ""
        }a deliverable: "${args.fileName}".`,
        type: "deliverable_uploaded",
        relatedId: deliverableId,
        link: `/dashboard/adviser?projectId=${args.capstoneProjectId}&deliverableId=${deliverableId}`,
      });
    }
  },
});

// Students: only their own team. Advisers/instructors: only teams they supervise.
// Admin: anything. Also removes the file and its comments.
export const deleteDeliverable = mutation({
  args: { deliverableId: v.id("deliverables") },
  handler: async (ctx, args) => {
    const caller = await requireCaller(ctx);

    const deliverable = await ctx.db.get(args.deliverableId);
    if (!deliverable) return;

    const project = await ctx.db.get(deliverable.capstoneProjectId);
    if (!project || !canAccess(caller, project)) {
      throw new Error("Not authorized");
    }

    await deleteDeliverableCascade(ctx, deliverable);
    await logAction(ctx, caller, "Deleted deliverable", deliverable.fileName);
  },
});

export const adviserDeliverableStatus = mutation({
  args: {
    deliverableId: v.id("deliverables"),
    status: v.union(
      v.literal("approved"),
      v.literal("under_review"),
      v.literal("needs_revision")
    ),
  },
  handler: async (ctx, args) => {
    const caller = await requireRole(ctx, ["adviser", "instructor", "admin"]);

    const deliverable = await ctx.db.get(args.deliverableId);
    if (!deliverable) throw new Error("Deliverable not found");

    // Must be THIS team's adviser/instructor (or admin)
    const project = await ctx.db.get(deliverable.capstoneProjectId);
    if (!project || !canAccess(caller, project)) {
      throw new Error("Not authorized");
    }

    await ctx.db.patch(args.deliverableId, { status: args.status });

    await logAction(
      ctx,
      caller,
      "Updated deliverable status",
      `${deliverable.fileName} → ${args.status.replace("_", " ")}`
    );
  },
});

// ---------------------------------------------------------------------------
// Teams
// ---------------------------------------------------------------------------

export const createCapstoneProject = mutation({
  args: {
    teamName: v.string(),
    projectTitle: v.string(),
    adviserId: v.string(),
    instructorId: v.string(),
  },

  handler: async (ctx, args) => {
    const caller = await requireRole(ctx, ["instructor", "admin"]);

    // Instructors can only create teams for themselves. Admin can pick.
    const instructorId = caller.role === "admin" ? args.instructorId : caller._id;

    // The adviser must be a real, approved adviser
    const adviserDocId = ctx.db.normalizeId("users", args.adviserId);
    const adviser = adviserDocId ? await ctx.db.get(adviserDocId) : null;
    if (
      !adviser ||
      adviser.role !== "adviser" ||
      adviser.status === "pending" ||
      adviser.status === "rejected"
    ) {
      throw new Error("Please choose a valid, approved adviser.");
    }

    // Generate a unique invite code
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    const makeCode = () => {
      let c = "ECAP-";
      for (let i = 0; i < 4; i++) c += chars[Math.floor(Math.random() * chars.length)];
      c += "-";
      for (let i = 0; i < 4; i++) c += chars[Math.floor(Math.random() * chars.length)];
      return c;
    };

    const existingCodes = new Set(
      (await ctx.db.query("capstoneProjects").collect()).map((p) => p.inviteCode)
    );
    let code = makeCode();
    while (existingCodes.has(code)) code = makeCode();

    const projectId = await ctx.db.insert("capstoneProjects", {
      teamName: args.teamName,
      projectTitle: args.projectTitle,
      phase: "Proposal",
      progress: 0,
      approved: 0,
      underReview: 0,
      needsRevision: 0,
      adviserId: args.adviserId,
      instructorId,
      members: [],
      inviteCode: code,
    });

    await logAction(ctx, caller, "Created team", `${args.teamName}: ${args.projectTitle}`);

    await ctx.runMutation(api.notifications.sendNotification, {
      userId: args.adviserId,
      message: `You have been assigned as adviser for team "${args.teamName}" on project "${args.projectTitle}".`,
      type: "team_created",
      relatedId: projectId,
    });

    return code;
  },
});

export const updateTeam = mutation({
  args: {
    teamId: v.id("capstoneProjects"),
    teamName: v.string(),
    projectTitle: v.string(),
    phase: v.union(
      v.literal("Proposal"),
      v.literal("Development"),
      v.literal("Testing"),
      v.literal("Final")
    ),
  },
  handler: async (ctx, args) => {
    const caller = await requireRole(ctx, ["instructor", "admin"]);

    const team = await ctx.db.get(args.teamId);
    if (!team) throw new Error("Team not found");
    if (!canManage(caller, team)) throw new Error("Not authorized");

    await ctx.db.patch(args.teamId, {
      teamName: args.teamName,
      projectTitle: args.projectTitle,
      phase: args.phase,
    });

    await logAction(ctx, caller, "Updated team", `${args.teamName} (${args.phase})`);
  },
});

export const updateTeamMembers = mutation({
  args: {
    teamId: v.id("capstoneProjects"),
    members: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    const caller = await requireRole(ctx, ["instructor", "admin"]);

    const team = await ctx.db.get(args.teamId);
    if (!team) throw new Error("Team not found");
    if (!canManage(caller, team)) throw new Error("Not authorized");

    // Every member must be a real student; drop duplicates
    const unique = Array.from(new Set(args.members));
    for (const m of unique) {
      const id = ctx.db.normalizeId("users", m);
      const u = id ? await ctx.db.get(id) : null;
      if (!u || u.role !== "student") {
        throw new Error("Team members must be existing students.");
      }
    }

    await ctx.db.patch(args.teamId, { members: unique });
    await logAction(ctx, caller, "Updated team members", `${team.teamName}: ${unique.length} member(s)`);
  },
});

// Deletes the team AND everything that belongs to it
export const deleteTeam = mutation({
  args: { teamId: v.id("capstoneProjects") },
  handler: async (ctx, args) => {
    const caller = await requireRole(ctx, ["instructor", "admin"]);

    const team = await ctx.db.get(args.teamId);
    if (!team) return;
    if (!canManage(caller, team)) throw new Error("Not authorized");

    const tasks = await ctx.db
      .query("tasks")
      .filter((q) => q.eq(q.field("capstoneProjectId"), args.teamId))
      .collect();
    for (const t of tasks) await ctx.db.delete(t._id);

    const deliverables = await ctx.db
      .query("deliverables")
      .filter((q) => q.eq(q.field("capstoneProjectId"), args.teamId))
      .collect();
    for (const d of deliverables) await deleteDeliverableCascade(ctx, d);

    await ctx.db.delete(args.teamId);
    await logAction(ctx, caller, "Deleted team", team.teamName);
  },
});

// ---------------------------------------------------------------------------
// Tasks
// ---------------------------------------------------------------------------

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
    const caller = await requireRole(ctx, ["instructor", "admin"]);

    const project = await ctx.db.get(args.capstoneProjectId);
    if (!project) throw new Error("Team not found");
    if (!canManage(caller, project)) throw new Error("Not authorized");

    const taskId = await ctx.db.insert("tasks", {
      capstoneProjectId: args.capstoneProjectId,
      title: args.title,
      description: args.description,
      assignedTo: project.teamName,
      dueDate: args.dueDate,
      status: args.status,
    });

    await logAction(ctx, caller, "Created task", `${args.title} for team "${project.teamName}"`);

    for (const memberId of project.members ?? []) {
      await ctx.runMutation(api.notifications.sendNotification, {
        userId: memberId,
        message: `A new task "${args.title}" has been assigned to your team. Due date: ${args.dueDate}.`,
        type: "task_assigned",
        relatedId: taskId,
      });
    }

    return taskId;
  },
});

// "Assigned to all active teams (Send to All)": one task per team the caller
// manages (admin: every team), all in one transaction.
export const createTaskForAllTeams = mutation({
  args: {
    title: v.string(),
    description: v.string(),
    dueDate: v.string(),
    status: v.optional(
      v.union(
        v.literal("completed"),
        v.literal("in_progress"),
        v.literal("pending")
      )
    ),
  },
  handler: async (ctx, args) => {
    const caller = await requireRole(ctx, ["instructor", "admin"]);

    const allTeams = await ctx.db.query("capstoneProjects").collect();
    const teams = allTeams.filter((t) => canManage(caller, t));
    if (teams.length === 0) throw new Error("You have no teams to assign this task to.");

    for (const project of teams) {
      const taskId = await ctx.db.insert("tasks", {
        capstoneProjectId: project._id,
        title: args.title,
        description: args.description,
        assignedTo: project.teamName,
        dueDate: args.dueDate,
        status: args.status ?? "pending",
      });

      for (const memberId of project.members ?? []) {
        await ctx.runMutation(api.notifications.sendNotification, {
          userId: memberId,
          message: `A new task "${args.title}" has been assigned to your team. Due date: ${args.dueDate}.`,
          type: "task_assigned",
          relatedId: taskId,
        });
      }
    }

    await logAction(
      ctx,
      caller,
      "Created task for all teams",
      `${args.title} → ${teams.length} team(s)`
    );

    return teams.length;
  },
});

export const updateTask = mutation({
  args: {
    taskId: v.id("tasks"),
    title: v.string(),
    description: v.string(),
    dueDate: v.string(),
    capstoneProjectId: v.id("capstoneProjects"),
  },
  handler: async (ctx, args) => {
    const caller = await requireRole(ctx, ["instructor", "admin"]);

    const task = await ctx.db.get(args.taskId);
    if (!task) throw new Error("Task not found");

    // You must manage BOTH the team it's in now and the team you move it to
    const currentProject = await ctx.db.get(task.capstoneProjectId);
    const newProject = await ctx.db.get(args.capstoneProjectId);
    if (!currentProject || !newProject) throw new Error("Team not found");
    if (!canManage(caller, currentProject) || !canManage(caller, newProject)) {
      throw new Error("Not authorized");
    }

    await ctx.db.patch(args.taskId, {
      title: args.title,
      description: args.description,
      dueDate: args.dueDate,
      capstoneProjectId: args.capstoneProjectId,
      assignedTo: newProject.teamName,
    });

    await logAction(ctx, caller, "Updated task", `${args.title} (team "${newProject.teamName}")`);
  },
});

export const deleteTask = mutation({
  args: { taskId: v.id("tasks") },
  handler: async (ctx, args) => {
    const caller = await requireRole(ctx, ["instructor", "admin"]);

    const task = await ctx.db.get(args.taskId);
    if (!task) return;

    const project = await ctx.db.get(task.capstoneProjectId);
    if (!project || !canManage(caller, project)) throw new Error("Not authorized");

    await ctx.db.delete(args.taskId);
    await logAction(ctx, caller, "Deleted task", `${task.title} (team "${project.teamName}")`);
  },
});

// (updateTaskStatus was removed: it let any instructor set any status and is
// replaced by studentUpdateTask + reviewTask below.)

// ---------------------------------------------------------------------------
// Task review flow: student marks done -> instructor confirms or sends back
// ---------------------------------------------------------------------------

// STUDENT: pending -> in_progress -> under_review (and undo back to in_progress).
// A student can never set "completed". Only the instructor can.
export const studentUpdateTask = mutation({
  args: {
    taskId: v.id("tasks"),
    status: v.union(v.literal("in_progress"), v.literal("under_review")),
  },
  handler: async (ctx, args) => {
    const caller = await requireCaller(ctx);

    const task = await ctx.db.get(args.taskId);
    if (!task) throw new Error("Task not found");

    const project = await ctx.db.get(task.capstoneProjectId);
    if (!project || !(project.members ?? []).includes(caller._id)) {
      throw new Error("You are not on this team");
    }

    const allowed =
      (args.status === "in_progress" &&
        (task.status === "pending" || task.status === "under_review")) ||
      (args.status === "under_review" &&
        (task.status === "in_progress" || task.status === "needs_revision"));
    if (!allowed) {
      throw new Error(`A ${task.status} task can't move to ${args.status}`);
    }

    await ctx.db.patch(args.taskId, { status: args.status });

    // Tell the instructor there's something to review
    if (args.status === "under_review") {
      await logAction(
        ctx,
        caller,
        "Submitted task for review",
        `${task.title} (team "${project.teamName}")`
      );

      if (project.instructorId) {
        await ctx.runMutation(api.notifications.sendNotification, {
          userId: project.instructorId,
          message: `${caller.name} marked "${task.title}" as done for team "${project.teamName}". It's waiting for your review.`,
          type: "task_submitted",
          relatedId: args.taskId,
        });
      }
    }
  },
});

// INSTRUCTOR: confirm (-> completed) or revise (-> needs_revision) a task under review.
export const reviewTask = mutation({
  args: {
    taskId: v.id("tasks"),
    decision: v.union(v.literal("confirm"), v.literal("revise")),
  },
  handler: async (ctx, args) => {
    const caller = await requireCaller(ctx);

    const task = await ctx.db.get(args.taskId);
    if (!task) throw new Error("Task not found");

    const project = await ctx.db.get(task.capstoneProjectId);
    if (!project) throw new Error("Team not found");
    if (project.instructorId !== caller._id) {
      throw new Error("Only this team's instructor can review tasks");
    }
    if (task.status !== "under_review") {
      throw new Error("This task isn't waiting for review");
    }

    const status = args.decision === "confirm" ? "completed" : "needs_revision";
    await ctx.db.patch(args.taskId, { status });

    await logAction(
      ctx,
      caller,
      args.decision === "confirm" ? "Confirmed task" : "Sent task back for revision",
      `${task.title} (team "${project.teamName}")`
    );

    // Tell every team member
    for (const memberId of project.members ?? []) {
      await ctx.runMutation(api.notifications.sendNotification, {
        userId: memberId,
        message:
          args.decision === "confirm"
            ? `Your instructor confirmed the task "${task.title}". It's now completed.`
            : `Your instructor sent the task "${task.title}" back. Please review it and resubmit.`,
        type: args.decision === "confirm" ? "task_confirmed" : "task_revision",
        relatedId: args.taskId,
      });
    }
  },
});

// ---------------------------------------------------------------------------
// PDF comments
// ---------------------------------------------------------------------------

export const addPdfComment = mutation({
  args: {
    deliverableId: v.id("deliverables"),
    // Kept optional so existing frontend calls don't break, but IGNORED:
    // the author always comes from the signed-in user.
    userId: v.optional(v.string()),
    userName: v.optional(v.string()),
    comment: v.string(),
    pageNumber: v.number(),
    x: v.number(),
    y: v.number(),
  },
  handler: async (ctx, args) => {
    const caller = await requireCaller(ctx);

    const deliverable = await ctx.db.get(args.deliverableId);
    if (!deliverable) throw new Error("Deliverable not found");
    const project = await ctx.db.get(deliverable.capstoneProjectId);
    if (!project || !canAccess(caller, project)) {
      throw new Error("Not authorized");
    }

    const commentId = await ctx.db.insert("pdfComments", {
      deliverableId: args.deliverableId,
      userId: caller._id,
      userName: caller.name,
      comment: args.comment,
      pageNumber: args.pageNumber,
      x: args.x,
      y: args.y,
      createdAt: new Date().toISOString(),
    });

    await ctx.db.patch(args.deliverableId, {
      comments: (deliverable.comments || 0) + 1,
    });

    for (const memberId of project.members ?? []) {
      if (memberId === caller._id) continue;

      await ctx.runMutation(api.notifications.sendNotification, {
        userId: memberId,
        message: `A new comment has been added to the deliverable "${deliverable.fileName}" : "${args.comment.slice(0, 80)}${args.comment.length > 80 ? "..." : ""}".`,
        type: "comment_added",
        relatedId: commentId,
        link: `/dashboard/student?deliverableId=${args.deliverableId}&page=${args.pageNumber}`,
      });
    }

    return commentId;
  },
});

// Only the author (or an admin) can delete a comment
export const deletePdfComment = mutation({
  args: { commentId: v.id("pdfComments") },
  handler: async (ctx, args) => {
    const caller = await requireCaller(ctx);

    const comment = await ctx.db.get(args.commentId);
    if (!comment) return;

    // Older comments may have stored the Clerk id instead of the user id
    const isAuthor =
      comment.userId === caller._id || comment.userId === caller.clerkId;
    if (!isAuthor && caller.role !== "admin") {
      throw new Error("You can only delete your own comments");
    }

    await ctx.db.delete(args.commentId);

    const deliverable = await ctx.db.get(comment.deliverableId);
    if (deliverable && deliverable.comments > 0) {
      await ctx.db.patch(comment.deliverableId, {
        comments: deliverable.comments - 1,
      });
    }
  },
});

// ---------------------------------------------------------------------------
// Invite codes
// ---------------------------------------------------------------------------
// Joining a team now happens inside api.users.registerStudent, so
// joinTeamByInviteCode and getTeamByInviteCode (which leaked the whole project
// to signed-out users) were removed.

// Used by the sign-up form for instant feedback. Returns only true/false.
// The real check is enforced again on the server in registerStudent.
export const validateInviteCode = query({
  args: { inviteCode: v.string() },
  handler: async (ctx, args): Promise<boolean> => {
    const code = args.inviteCode.trim().toUpperCase();
    const team = await ctx.db
      .query("capstoneProjects")
      .filter((q) => q.eq(q.field("inviteCode"), code))
      .first();
    return team !== null;
  },
});