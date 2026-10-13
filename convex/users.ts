import { internalMutation, mutation, query } from "./_generated/server";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { v } from "convex/values";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function getCurrentUser(ctx: QueryCtx | MutationCtx) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) return null;

  // .unique() throws if a duplicate clerkId ever exists, so bugs surface early.
  return await ctx.db
    .query("users")
    .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
    .unique();
}

// Signed-in AND approved. Returns null instead of throwing (for queries).
async function getApprovedUser(ctx: QueryCtx | MutationCtx) {
  const user = await getCurrentUser(ctx);
  if (!user) return null;
  if (user.status === "pending" || user.status === "rejected") return null;
  return user;
}

// Use this at the top of every admin-only query/mutation (in any file)
export async function requireAdmin(ctx: QueryCtx | MutationCtx) {
  const user = await getCurrentUser(ctx);
  if (!user) throw new Error("Not authenticated");
  if (user.role !== "admin") throw new Error("Admin access required");
  return user;
}

// Call from any mutation to add an entry to the audit log
export async function logAction(
  ctx: MutationCtx,
  actor: { clerkId: string; name: string },
  action: string,
  details: string
) {
  await ctx.db.insert("auditLogs", {
    userId: actor.clerkId,
    userName: actor.name,
    action,
    details,
  });
}

// ---------------------------------------------------------------------------
// Registration
// ---------------------------------------------------------------------------
// Both mutations take the identity from the signed-in session, never from
// client-supplied arguments. Both are idempotent: calling them again for an
// already-registered account returns the existing user id instead of throwing,
// so a retry after a network hiccup doesn't show a false error.

// STUDENT sign-up. The role is always "student", the invite code is checked
// on the server, and creating the user + joining the team happen in ONE
// transaction (no half-created accounts).
// Call this AFTER the Clerk session is active (setActive) and Convex is authed.
export const registerStudent = mutation({
  args: {
    name: v.string(),
    email: v.string(),
    studentNo: v.string(),
    program: v.string(),
    section: v.string(),
    inviteCode: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not signed in");

    const existing = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .unique();
    if (existing) return existing._id;

    // Tip: add .index("by_invite_code", ["inviteCode"]) to capstoneProjects in
    // schema.ts and switch this to withIndex. Codes must be stored UPPERCASE.
    const team = await ctx.db
      .query("capstoneProjects")
      .filter((q) =>
        q.eq(q.field("inviteCode"), args.inviteCode.trim().toUpperCase())
      )
      .first();
    if (!team) throw new Error("Invalid or expired invite code.");

    const studentNo = args.studentNo.trim();
    const duplicate = await ctx.db
      .query("users")
      .withIndex("by_studentno", (q) => q.eq("studentNo", studentNo))
      .first();
    if (duplicate) throw new Error("Student number is already registered.");

    // Prefer the verified email from the Clerk token.
    const email = identity.email ?? args.email;

    const userId = await ctx.db.insert("users", {
      clerkId: identity.subject,
      name: args.name.trim(),
      email,
      role: "student",
      status: "approved",
      studentNo,
      program: args.program,
      section: args.section,
    });

    await ctx.db.patch(team._id, {
      members: [...(team.members ?? []), userId],
    });

    await logAction(
      ctx,
      { clerkId: identity.subject, name: args.name },
      "User registered",
      `${args.name} joined "${team.teamName}" as student`
    );

    return userId;
  },
});

// INSTRUCTOR / ADVISER sign-up. Always starts as "pending" until an admin
// approves. "admin" and "student" are rejected by the validator below.
export const registerStaff = mutation({
  args: {
    name: v.string(),
    email: v.string(),
    role: v.union(v.literal("instructor"), v.literal("adviser")),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not signed in");

    const existing = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .unique();
    if (existing) return existing._id;

    const userId = await ctx.db.insert("users", {
      clerkId: identity.subject,
      name: args.name.trim(),
      email: identity.email ?? args.email,
      role: args.role,
      status: "pending",
    });

    await logAction(
      ctx,
      { clerkId: identity.subject, name: args.name },
      "User registered",
      `${args.name} registered as ${args.role} (awaiting approval)`
    );

    return userId;
  },
});

export const updateProfile = mutation({
  args: {
    name: v.string(),
    studentNo: v.optional(v.string()),
    program: v.optional(v.string()),
    section: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    if (!user) throw new Error("Not authenticated");

    // Only include fields that were actually sent. Patching with `undefined`
    // would REMOVE the stored field in Convex.
    const patch: {
      name: string;
      studentNo?: string;
      program?: string;
      section?: string;
    } = { name: args.name.trim() };

    if (args.program !== undefined) patch.program = args.program;
    if (args.section !== undefined) patch.section = args.section;

    const newNo = args.studentNo?.trim();
    if (newNo && newNo !== user.studentNo) {
      // Student number is write-once for non-admins
      if (user.studentNo && user.role !== "admin") {
        throw new Error("Student number can't be changed. Contact an admin.");
      }
      const duplicate = await ctx.db
        .query("users")
        .withIndex("by_studentno", (q) => q.eq("studentNo", newNo))
        .first();
      if (duplicate && duplicate._id !== user._id) {
        throw new Error("Student number is already registered.");
      }
      patch.studentNo = newNo;
    }

    await ctx.db.patch(user._id, patch);
  },
});

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

export const getMe = query({
  args: {},
  handler: async (ctx) => {
    return await getCurrentUser(ctx);
  },
});

// Instructors/admins pick advisers when creating a team.
// Only approved advisers, and only the fields the UI needs.
export const getAdvisers = query({
  args: {},
  handler: async (ctx) => {
    const caller = await getApprovedUser(ctx);
    if (!caller || (caller.role !== "instructor" && caller.role !== "admin")) {
      return [];
    }

    const advisers = await ctx.db
      .query("users")
      .withIndex("by_role", (q) => q.eq("role", "adviser"))
      .collect();

    return advisers
      .filter((a) => a.status !== "pending" && a.status !== "rejected")
      .map((a) => ({ _id: a._id, name: a.name, email: a.email, image: a.image }));
  },
});

// NOTE: any approved instructor/adviser sees every student here. If advisers
// should only see students on their own teams, scope this query.
export const getStudents = query({
  args: {},
  handler: async (ctx) => {
    const caller = await getApprovedUser(ctx);
    if (
      !caller ||
      (caller.role !== "instructor" &&
        caller.role !== "adviser" &&
        caller.role !== "admin")
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

// ---------------------------------------------------------------------------
// Admin
// ---------------------------------------------------------------------------

export const listAllUsers = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    return await ctx.db.query("users").collect();
  },
});

export const approveUser = mutation({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const admin = await requireAdmin(ctx);

    const target = await ctx.db.get(args.userId);
    if (!target) throw new Error("User not found");

    await ctx.db.patch(args.userId, { status: "approved" });
    await logAction(ctx, admin, "Approved account", `${target.name} (${target.role})`);
  },
});

export const rejectUser = mutation({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const admin = await requireAdmin(ctx);

    const target = await ctx.db.get(args.userId);
    if (!target) throw new Error("User not found");
    if (target.role === "admin") {
      throw new Error("The admin account can't be rejected.");
    }

    await ctx.db.patch(args.userId, { status: "rejected" });
    await logAction(ctx, admin, "Rejected account", `${target.name} (${target.role})`);
  },
});

// Admin is NOT assignable here: there is exactly one admin account.
export const setUserRole = mutation({
  args: {
    userId: v.id("users"),
    role: v.union(
      v.literal("student"),
      v.literal("instructor"),
      v.literal("adviser")
    ),
  },
  handler: async (ctx, args) => {
    const admin = await requireAdmin(ctx);

    const target = await ctx.db.get(args.userId);
    if (!target) throw new Error("User not found");
    if (target.role === "admin") {
      throw new Error("The admin account's role can't be changed.");
    }

    await ctx.db.patch(args.userId, { role: args.role });
    await logAction(
      ctx,
      admin,
      "Changed user role",
      `${target.name}: ${target.role} → ${args.role}`
    );
  },
});

// Removes a user from Convex only. The Clerk account still exists, so delete it
// in Clerk too (or via a Clerk backend API call from an action). A deleted user
// who signs in again can only re-register as a student (valid invite code) or
// as pending staff.
export const deleteUser = mutation({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const admin = await requireAdmin(ctx);

    const target = await ctx.db.get(args.userId);
    if (!target) throw new Error("User not found");
    if (target.role === "admin") {
      throw new Error("The admin account can't be deleted.");
    }

    const teams = await ctx.db.query("capstoneProjects").collect();

    // Don't leave a team without its adviser or instructor
    const supervised = teams.filter(
      (t) => t.adviserId === target._id || t.instructorId === target._id
    );
    if (supervised.length > 0) {
      throw new Error(
        `${target.name} is the adviser or instructor of ${supervised.length} team(s). Reassign those teams first.`
      );
    }

    // Remove from any team they're a member of
    for (const team of teams) {
      if ((team.members ?? []).includes(target._id)) {
        await ctx.db.patch(team._id, {
          members: (team.members ?? []).filter((m) => m !== target._id),
        });
      }
    }

    // Clear their notifications
    const notifications = await ctx.db
      .query("notifications")
      .withIndex("by_user", (q) => q.eq("userId", target._id))
      .collect();
    for (const n of notifications) {
      await ctx.db.delete(n._id);
    }

    await ctx.db.delete(target._id);
    await logAction(
      ctx,
      admin,
      "Deleted user",
      `${target.name} (${target.email}), ${target.role}`
    );
  },
});

// Run from the Convex dashboard to create the one admin:
// { "email": "you@example.com" }
// Refuses to run if an admin already exists.
export const makeAdmin = internalMutation({
  args: { email: v.string() },
  handler: async (ctx, args) => {
    const existingAdmin = await ctx.db
      .query("users")
      .withIndex("by_role", (q) => q.eq("role", "admin"))
      .first();
    if (existingAdmin) {
      throw new Error("An admin already exists. Only one admin is allowed.");
    }

    const user = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", args.email))
      .first();

    if (!user) {
      throw new Error("No user with that email. Sign up first, then run this.");
    }

    await ctx.db.patch(user._id, { role: "admin", status: "approved" });
  },
});

// Syncs the profile photo and the VERIFIED email from the Clerk token.
// The display name is intentionally NOT synced, so edits made in
// updateProfile aren't overwritten at the next sign-in.
export const syncMe = mutation({
  args: {
    image: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return;

    const user = await getCurrentUser(ctx);
    if (!user) return; // not registered yet, nothing to sync

    const patch: { email?: string; image?: string } = {};
    if (identity.email && identity.email !== user.email) {
      patch.email = identity.email;
    }
    if (args.image && args.image !== user.image) patch.image = args.image;

    if (Object.keys(patch).length > 0) {
      await ctx.db.patch(user._id, patch);
    }
  },
});