import { mutation, query } from "./_generated/server";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { paginationOptsValidator, paginationResultValidator } from "convex/server";
import { v } from "convex/values";
import type { Doc } from "./_generated/dataModel";

const messageValidator = v.object({
  _id: v.id("workspaceChatMessages"),
  _creationTime: v.number(),
  capstoneProjectId: v.id("capstoneProjects"),
  phase: v.string(),
  authorId: v.id("users"),
  authorName: v.string(),
  authorRole: v.union(
    v.literal("student"),
    v.literal("instructor"),
    v.literal("adviser"),
    v.literal("admin")
  ),
  message: v.string(),
  createdAt: v.number(),
});

async function getApprovedCaller(ctx: QueryCtx | MutationCtx) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) throw new Error("Not signed in");

  const caller = await ctx.db
    .query("users")
    .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
    .first();
  if (!caller) throw new Error("User not found");
  if (caller.status === "pending" || caller.status === "rejected") {
    throw new Error("Your account is awaiting admin approval");
  }
  return caller;
}

async function requireProjectAccess(
  ctx: QueryCtx | MutationCtx,
  caller: Doc<"users">,
  projectId: Doc<"capstoneProjects">["_id"],
) {
  const project = await ctx.db.get(projectId);
  if (!project) throw new Error("Project not found");
  const isProjectMember = (project.members ?? []).includes(caller._id);
  const canAccess =
    caller.role === "admin" ||
    project.adviserId === caller._id ||
    project.instructorId === caller._id ||
    isProjectMember;
  if (!canAccess) throw new Error("Not authorized to access this project chat");
}

export const list = query({
  args: {
    capstoneProjectId: v.id("capstoneProjects"),
    phase: v.string(),
    paginationOpts: paginationOptsValidator,
  },
  returns: paginationResultValidator(messageValidator),
  handler: async (ctx, args) => {
    const caller = await getApprovedCaller(ctx);
    await requireProjectAccess(ctx, caller, args.capstoneProjectId);

    return await ctx.db
      .query("workspaceChatMessages")
      .withIndex("by_project_phase", (q) =>
        q.eq("capstoneProjectId", args.capstoneProjectId).eq("phase", args.phase),
      )
      .order("desc")
      .paginate(args.paginationOpts);
  },
});

export const send = mutation({
  args: {
    capstoneProjectId: v.id("capstoneProjects"),
    phase: v.string(),
    message: v.string(),
  },
  returns: v.id("workspaceChatMessages"),
  handler: async (ctx, args) => {
    const caller = await getApprovedCaller(ctx);
    await requireProjectAccess(ctx, caller, args.capstoneProjectId);

    const message = args.message.trim();
    if (!message) throw new Error("Message cannot be empty");
    if (message.length > 2000) throw new Error("Message must be 2000 characters or fewer");
    if (!args.phase.trim() || args.phase.length > 100) {
      throw new Error("Invalid chapter or phase");
    }

    return await ctx.db.insert("workspaceChatMessages", {
      capstoneProjectId: args.capstoneProjectId,
      phase: args.phase,
      authorId: caller._id,
      authorName: caller.name,
      authorRole: caller.role,
      message,
      createdAt: Date.now(),
    });
  },
});
