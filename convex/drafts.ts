import { mutation, query, type MutationCtx, type QueryCtx } from "./_generated/server";
import { v } from "convex/values";
import type { Doc } from "./_generated/dataModel";

async function getDraftUser(ctx: MutationCtx | QueryCtx) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) return null;
  const user = await ctx.db
    .query("users")
    .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
    .first();
  if (!user || user.status === "pending" || user.status === "rejected") return null;
  return user;
}

function canAccessDraft(user: Doc<"users">, project: Doc<"capstoneProjects">) {
  return (
    user.role === "admin" ||
    project.adviserId === user._id ||
    project.instructorId === user._id ||
    (project.members ?? []).includes(user._id)
  );
}

// Student clicks "Edit & resubmit": create the draft, or return the existing one.
export const startDraft = mutation({
  args: { deliverableId: v.id("deliverables") },
  returns: v.object({
    draftId: v.id("deliverableDrafts"),
    storageId: v.id("_storage"),
    baseVersion: v.number(),
    sessionRevision: v.number(),
  }),
  handler: async (ctx, { deliverableId }) => {
    const user = await getDraftUser(ctx);
    if (!user) throw new Error("Not authorized");
    const d = await ctx.db.get(deliverableId);
    if (!d || !d.storageId) throw new Error("File not found");
    const project = await ctx.db.get(d.capstoneProjectId);
    if (!project) throw new Error("Project not found");
    if (!canAccessDraft(user, project)) throw new Error("Not authorized");
    if (project.stage === "archived") {
      throw new Error("Archived projects are read-only.");
    }

    // NEW: fail with a clear message if the original file is gone
    const originalUrl = await ctx.storage.getUrl(d.storageId);
    if (!originalUrl) throw new Error("The original file is missing. Please upload this chapter again.");

    const existing = await ctx.db
      .query("deliverableDrafts")
      .withIndex("by_deliverable", (q) => q.eq("deliverableId", deliverableId))
      .first();

    if (existing) {
      const url = await ctx.storage.getUrl(existing.storageId);
      if (url) {
        return {
          draftId: existing._id,
          storageId: existing.storageId,
          baseVersion: existing.baseVersion,
          sessionRevision: existing.sessionRevision ?? 0,
        };
      }
      // draft file is gone: start again from the original file
      await ctx.db.patch(existing._id, {
        storageId: d.storageId,
        baseVersion: d.version,
        updatedAt: Date.now(),
      });
      return {
        draftId: existing._id,
        storageId: d.storageId,
        baseVersion: d.version,
        sessionRevision: existing.sessionRevision ?? 0,
      };
    }

    const draftId = await ctx.db.insert("deliverableDrafts", {
      deliverableId,
      storageId: d.storageId,
      baseVersion: d.version,
      updatedAt: Date.now(),
      sessionRevision: 0,
    });
    return { draftId, storageId: d.storageId, baseVersion: d.version, sessionRevision: 0 };
  },
});

export const getWorkingDraft = query({
  args: { deliverableId: v.id("deliverables") },
  returns: v.union(
    v.null(),
    v.object({
      _id: v.id("deliverableDrafts"),
      storageId: v.id("_storage"),
      baseVersion: v.number(),
      saveRevision: v.optional(v.number()),
      sessionRevision: v.number(),
    }),
  ),
  handler: async (ctx, { deliverableId }) => {
    const user = await getDraftUser(ctx);
    if (!user) return null;
    const deliverable = await ctx.db.get(deliverableId);
    if (!deliverable) return null;
    const project = await ctx.db.get(deliverable.capstoneProjectId);
    if (!project || !canAccessDraft(user, project)) return null;
    const draft = await ctx.db
      .query("deliverableDrafts")
      .withIndex("by_deliverable", (q) => q.eq("deliverableId", deliverableId))
      .first();
    return draft
      ? {
          _id: draft._id,
          storageId: draft.storageId,
          baseVersion: draft.baseVersion,
          saveRevision: draft.saveRevision,
          sessionRevision: draft.sessionRevision ?? 0,
        }
      : null;
  },
});

export const getByDeliverable = query({
  args: { deliverableId: v.id("deliverables") },
  handler: (ctx, { deliverableId }) =>
    ctx.db
      .query("deliverableDrafts")
      .withIndex("by_deliverable", (q) => q.eq("deliverableId", deliverableId))
      .first(),
});

// Called ONLY by the OnlyOffice callback route (checked with a shared secret).
export const generateDraftUploadUrl = mutation({
  args: { secret: v.string() },
  handler: async (ctx, { secret }) => {
    if (secret !== process.env.ONLYOFFICE_SECRET) throw new Error("Forbidden");
    return await ctx.storage.generateUploadUrl();
  },
});

export const saveDraftFile = mutation({
  args: {
    secret: v.string(),
    draftId: v.id("deliverableDrafts"),
    storageId: v.id("_storage"),
    sessionRevision: v.number(),
    sessionClosed: v.boolean(),
  },
  returns: v.union(
    v.null(),
    v.object({ saveRevision: v.number(), sessionRevision: v.number() }),
  ),
  handler: async (
    ctx,
    { secret, draftId, storageId, sessionRevision: expectedSessionRevision, sessionClosed },
  ) => {
    if (secret !== process.env.ONLYOFFICE_SECRET) throw new Error("Forbidden");
    const draft = await ctx.db.get(draftId);
    if (!draft) return null; // draft already submitted: ignore a late callback
    const currentSessionRevision = draft.sessionRevision ?? 0;
    if (expectedSessionRevision !== currentSessionRevision) return null;
    // CHANGED: no longer deletes the previous draft file, so it can never
    // remove a file that a submitted version is now using
    const saveRevision = (draft.saveRevision ?? 0) + 1;
    const sessionRevision =
      currentSessionRevision + (sessionClosed ? 1 : 0);
    await ctx.db.patch(draftId, {
      storageId,
      updatedAt: Date.now(),
      saveRevision,
      sessionRevision,
    });
    return { saveRevision, sessionRevision };
  },
});

// After the new version is saved, remove the draft row (the blob now belongs to the new version).
export const finish = mutation({
  args: { draftId: v.id("deliverableDrafts") },
  returns: v.null(),
  handler: async (ctx, { draftId }) => {
    await ctx.db.delete(draftId);
    return null;
  },
});
