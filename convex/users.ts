import { internalMutation, mutation, query } from "./_generated/server";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { v } from "convex/values";
import { throwUserError } from "./errors";
import { PRIVACY_NOTICE_VERSION } from "../lib/privacy-consent";

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
  if (user.mustChangePassword === true) return null;
  return user;
}

// Use this at the top of every admin-only query/mutation (in any file)
export async function requireAdmin(ctx: QueryCtx | MutationCtx) {
  const user = await getCurrentUser(ctx);
  if (!user) throwUserError("Not authenticated");
  if (user.role !== "admin") throwUserError("Admin access required");
  return user;
}

export async function requireAdminOrCoordinator(
  ctx: QueryCtx | MutationCtx
) {
  const user = await getCurrentUser(ctx);
  if (!user) throwUserError("Not authenticated");
  if (user.role === "admin") return user;
  if (
    user.role !== "coordinator" ||
    user.status === "pending" ||
    user.status === "rejected" ||
    user.mustChangePassword === true
  ) {
    throwUserError("Approved coordinator access required");
  }
  return user;
}

async function requireAdminOrApprovedInstructor(ctx: MutationCtx) {
  const user = await getCurrentUser(ctx);
  if (!user) throwUserError("Not authenticated");
  if (user.role === "admin") return user;
  if (
    user.role !== "instructor" ||
    user.status === "pending" ||
    user.status === "rejected" ||
    user.mustChangePassword === true
  ) {
    throwUserError("Approved instructor access required");
  }
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

// Retained for compatibility with older clients. New student accounts must be
// created by an instructor's roster import.
export const registerStudent = mutation({
  args: {
    name: v.string(),
    email: v.string(),
    studentNo: v.string(),
    program: v.string(),
    section: v.string(),
    inviteCode: v.string(),
    privacyConsentVersion: v.literal(PRIVACY_NOTICE_VERSION),
  },
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throwUserError("Not signed in");

    const existing = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .unique();
    if (existing) return existing._id;

    throwUserError(
      "Student accounts can only be created when an instructor imports the roster."
    );
  },
});

// Instructors and coordinators start as pending until an admin approves;
// advisers await an instructor's verification.
export const registerStaff = mutation({
  args: {
    name: v.string(),
    email: v.string(),
    role: v.union(
      v.literal("instructor"),
      v.literal("adviser"),
      v.literal("coordinator")
    ),
    coordinatorOrganization: v.optional(v.string()),
    coordinatorReason: v.optional(v.string()),
    privacyConsentVersion: v.literal(PRIVACY_NOTICE_VERSION),
  },
  returns: v.id("users"),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throwUserError("Not signed in");

    const existing = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .unique();
    if (existing) return existing._id;

    let coordinatorDetails: {
      coordinatorOrganization?: string;
      coordinatorReason?: string;
    } = {};
    if (args.role === "coordinator") {
      const coordinatorOrganization = args.coordinatorOrganization?.trim();
      const coordinatorReason = args.coordinatorReason?.trim();
      if (!coordinatorOrganization || !coordinatorReason) {
        throwUserError("Organization and request reason are required.");
      }
      if (coordinatorOrganization.length > 120 || coordinatorReason.length > 500) {
        throwUserError(
          "Organization must be 120 characters or less and the reason 500 characters or less."
        );
      }
      coordinatorDetails = { coordinatorOrganization, coordinatorReason };
    } else if (
      args.coordinatorOrganization !== undefined ||
      args.coordinatorReason !== undefined
    ) {
      throwUserError(
        "Coordinator request details are only valid for coordinator accounts."
      );
    }

    const userId = await ctx.db.insert("users", {
      clerkId: identity.subject,
      name: args.name.trim(),
      email: identity.email ?? args.email,
      role: args.role,
      status: "pending",
      privacyConsentAt: Date.now(),
      privacyConsentVersion: args.privacyConsentVersion,
      ...coordinatorDetails,
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
    if (!user) throwUserError("Not authenticated");

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
        throwUserError("Student number can't be changed. Contact an admin.");
      }
      const duplicate = await ctx.db
        .query("users")
        .withIndex("by_studentno", (q) => q.eq("studentNo", newNo))
        .first();
      if (duplicate && duplicate._id !== user._id) {
        throwUserError("Student number is already registered.");
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

// Returns [] for anyone who isn't a signed-in admin (including the brief
// moment before the Clerk token reaches Convex), instead of throwing.
export const listAllUsers = query({
  args: {},
  handler: async (ctx) => {
    const caller = await getCurrentUser(ctx);
    if (!caller || caller.role !== "admin") return [];
    return await ctx.db.query("users").collect();
  },
});

export const listAdviserApprovals = query({
  args: {},
  returns: v.array(
    v.object({
      _id: v.id("users"),
      _creationTime: v.number(),
      name: v.string(),
      email: v.string(),
      role: v.literal("adviser"),
      status: v.union(v.literal("pending"), v.literal("rejected")),
    })
  ),
  handler: async (ctx) => {
    const caller = await getApprovedUser(ctx);
    if (!caller || caller.role !== "instructor") return [];

    const pending = await ctx.db
      .query("users")
      .withIndex("by_role_status", (q) =>
        q.eq("role", "adviser").eq("status", "pending")
      )
      .take(100);
    const rejected = await ctx.db
      .query("users")
      .withIndex("by_role_status", (q) =>
        q.eq("role", "adviser").eq("status", "rejected")
      )
      .take(100);

    return [
      ...pending.map(({ _id, _creationTime, name, email }) => ({
        _id,
        _creationTime,
        name,
        email,
        role: "adviser" as const,
        status: "pending" as const,
      })),
      ...rejected.map(({ _id, _creationTime, name, email }) => ({
        _id,
        _creationTime,
        name,
        email,
        role: "adviser" as const,
        status: "rejected" as const,
      })),
    ];
  },
});

// Sidebar badge: admins see pending instructors, instructors see pending advisers.
export const pendingApprovalsCount = query({
  args: {},
  returns: v.number(),
  handler: async (ctx) => {
    const caller = await getApprovedUser(ctx);
    if (!caller) return 0;

    if (caller.role === "admin") {
      const [instructors, coordinators] = await Promise.all([
        ctx.db
          .query("users")
          .withIndex("by_role_status", (q) =>
            q.eq("role", "instructor").eq("status", "pending")
          )
          .take(100),
        ctx.db
          .query("users")
          .withIndex("by_role_status", (q) =>
            q.eq("role", "coordinator").eq("status", "pending")
          )
          .take(100),
      ]);
      return instructors.length + coordinators.length;
    }

    if (caller.role !== "instructor") return 0;
    const pendingAdvisers = await ctx.db
      .query("users")
      .withIndex("by_role_status", (q) =>
        q.eq("role", "adviser").eq("status", "pending")
      )
      .take(100);
    return pendingAdvisers.length;
  },
});

export const approveUser = mutation({
  args: { userId: v.id("users") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const approver = await requireAdminOrApprovedInstructor(ctx);

    const target = await ctx.db.get(args.userId);
    if (!target) throwUserError("User not found");
    if (
      approver.role === "admin" &&
      target.role !== "instructor" &&
      target.role !== "coordinator"
    ) {
      throwUserError("Admins can only approve instructor or coordinator accounts.");
    }
    if (approver.role === "instructor" && target.role !== "adviser") {
      throwUserError("Instructors can only approve adviser accounts.");
    }

    await ctx.db.patch(args.userId, { status: "approved" });
    await logAction(
      ctx,
      approver,
      "Approved account",
      `${target.name} (${target.role})`
    );
    return null;
  },
});

export const rejectUser = mutation({
  args: { userId: v.id("users") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const approver = await requireAdminOrApprovedInstructor(ctx);

    const target = await ctx.db.get(args.userId);
    if (!target) throwUserError("User not found");
    if (
      approver.role === "admin" &&
      target.role !== "instructor" &&
      target.role !== "coordinator"
    ) {
      throwUserError("Admins can only reject instructor or coordinator accounts.");
    }
    if (approver.role === "instructor" && target.role !== "adviser") {
      throwUserError("Instructors can only reject adviser accounts.");
    }

    await ctx.db.patch(args.userId, { status: "rejected" });
    await logAction(
      ctx,
      approver,
      "Rejected account",
      `${target.name} (${target.role})`
    );
    return null;
  },
});

// Admin is NOT assignable here: there is exactly one admin account.
export const setUserRole = mutation({
  args: {
    userId: v.id("users"),
    role: v.union(
      v.literal("student"),
      v.literal("instructor"),
      v.literal("adviser"),
      v.literal("coordinator")
    ),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const admin = await requireAdmin(ctx);

    const target = await ctx.db.get(args.userId);
    if (!target) throwUserError("User not found");
    if (target.role === "admin") {
      throwUserError("The admin account's role can't be changed.");
    }

    await ctx.db.patch(args.userId, {
      role: args.role,
      ...(args.role === "coordinator" ? { status: "approved" as const } : {}),
    });
    await logAction(
      ctx,
      admin,
      "Changed user role",
      `${target.name}: ${target.role} -> ${args.role}`
    );
    return null;
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
    if (!target) throwUserError("User not found");
    if (target.role === "admin") {
      throwUserError("The admin account can't be deleted.");
    }

    const teams = await ctx.db.query("capstoneProjects").collect();

    // Don't leave a team without its adviser or instructor
    const supervised = teams.filter(
      (t) => t.adviserId === target._id || t.instructorId === target._id
    );
    if (supervised.length > 0) {
      throwUserError(
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
      throwUserError("An admin already exists. Only one admin is allowed.");
    }

    const user = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", args.email))
      .first();

    if (!user) {
      throwUserError("No user with that email. Sign up first, then run this.");
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