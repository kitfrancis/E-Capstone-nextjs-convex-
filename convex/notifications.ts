import { v } from "convex/values";
import { mutation, query, type MutationCtx, type QueryCtx } from "./_generated/server";


export const NOTIFICATION_TYPES = [
  "team_created",
  "task_assigned",
  "task_submitted", // student marked a task done (sent to the instructor)
  "task_revision", // instructor sent a task back for revision
  "task_confirmed", // instructor confirmed a task
  "comment_added",
  "deliverable_uploaded",
] as const;

const MAX_LIST = 50;

async function getCurrentUser(ctx: QueryCtx | MutationCtx) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) return null;

  return await ctx.db
    .query("users")
    .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
    .first();
}

export const sendNotification = mutation({
  args: {
    userId: v.string(),
    message: v.string(),
    type: v.string(),
    relatedId: v.optional(v.string()),
    link: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("notifications", {
      userId: args.userId,
      message: args.message,
      read: false,
      type: args.type,
      relatedId: args.relatedId,
      link: args.link,
    });
  },
});

export const myUnreadNotifications = query({
  handler: async (ctx) => {
    const user = await getCurrentUser(ctx);
    if (!user) return [];

    return await ctx.db
      .query("notifications")
      .withIndex("by_user_read", (q) => q.eq("userId", user._id).eq("read", false))
      .order("desc")
      .collect();
  },
});

export const myNotifications = query({
  handler: async (ctx) => {
    const user = await getCurrentUser(ctx);
    if (!user) return [];

    const unread = await ctx.db
      .query("notifications")
      .withIndex("by_user_read", (q) => q.eq("userId", user._id).eq("read", false))
      .order("desc")
      .collect();

    const read = await ctx.db
      .query("notifications")
      .withIndex("by_user_read", (q) => q.eq("userId", user._id).eq("read", true))
      .order("desc")
      .take(MAX_LIST);

    return [...unread, ...read]
      .sort((a, b) => b._creationTime - a._creationTime)
      .slice(0, Math.max(MAX_LIST, unread.length));
  },
});

/** Accurate badge count, even if there are more unread than the list shows. */
export const myUnreadCount = query({
  handler: async (ctx) => {
    const user = await getCurrentUser(ctx);
    if (!user) return 0;

    const unread = await ctx.db
      .query("notifications")
      .withIndex("by_user_read", (q) => q.eq("userId", user._id).eq("read", false))
      .collect();

    return unread.length;
  },
});

async function setRead(ctx: MutationCtx, notificationId: any, read: boolean) {
  const user = await getCurrentUser(ctx);
  if (!user) throw new Error("Not authenticated");

  const notification = await ctx.db.get(notificationId);
  if (!notification || (notification as any).userId !== user._id) {
    throw new Error("Notification not found");
  }

  if ((notification as any).read !== read) {
    await ctx.db.patch(notificationId, { read });
  }
}

export const markNotificationAsRead = mutation({
  args: { notificationId: v.id("notifications") },
  handler: async (ctx, args) => setRead(ctx, args.notificationId, true),
});

export const markNotificationAsUnread = mutation({
  args: { notificationId: v.id("notifications") },
  handler: async (ctx, args) => setRead(ctx, args.notificationId, false),
});

/** One round trip instead of one mutation per notification. */
export const markAllNotificationsAsRead = mutation({
  handler: async (ctx) => {
    const user = await getCurrentUser(ctx);
    if (!user) throw new Error("Not authenticated");

    const unread = await ctx.db
      .query("notifications")
      .withIndex("by_user_read", (q) => q.eq("userId", user._id).eq("read", false))
      .collect();

    await Promise.all(unread.map((n) => ctx.db.patch(n._id, { read: true })));
    return unread.length;
  },
});