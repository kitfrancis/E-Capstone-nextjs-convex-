import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

// Student clicks "Edit & resubmit": create the draft, or return the existing one.
export const startDraft = mutation({
  args: { deliverableId: v.id("deliverables") },
  handler: async (ctx, { deliverableId }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not signed in");
    const d = await ctx.db.get(deliverableId);
    if (!d || !d.storageId) throw new Error("File not found");

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
        return { draftId: existing._id, storageId: existing.storageId, baseVersion: existing.baseVersion };
      }
      // draft file is gone: start again from the original file
      await ctx.db.patch(existing._id, {
        storageId: d.storageId,
        baseVersion: d.version,
        updatedAt: Date.now(),
      });
      return { draftId: existing._id, storageId: d.storageId, baseVersion: d.version };
    }

    const draftId = await ctx.db.insert("deliverableDrafts", {
      deliverableId,
      storageId: d.storageId,
      baseVersion: d.version,
      updatedAt: Date.now(),
    });
    return { draftId, storageId: d.storageId, baseVersion: d.version };
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
  args: { secret: v.string(), draftId: v.id("deliverableDrafts"), storageId: v.id("_storage") },
  handler: async (ctx, { secret, draftId, storageId }) => {
    if (secret !== process.env.ONLYOFFICE_SECRET) throw new Error("Forbidden");
    const draft = await ctx.db.get(draftId);
    if (!draft) return; // draft already submitted: ignore a late callback
    // CHANGED: no longer deletes the previous draft file, so it can never
    // remove a file that a submitted version is now using
    await ctx.db.patch(draftId, { storageId, updatedAt: Date.now() });
  },
});

// After the new version is saved, remove the draft row (the blob now belongs to the new version).
export const finish = mutation({
  args: { draftId: v.id("deliverableDrafts") },
  handler: async (ctx, { draftId }) => {
    await ctx.db.delete(draftId);
  },
});