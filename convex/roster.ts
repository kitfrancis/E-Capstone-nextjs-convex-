import {
  action,
  internalAction,
  internalMutation,
  internalQuery,
  mutation,
  query,
} from "./_generated/server";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { internal } from "./_generated/api";
import { ConvexError, v } from "convex/values";
import type { Infer } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import { throwUserError } from "./errors";
import { logAction } from "./users";
import { PRIVACY_NOTICE_VERSION } from "../lib/privacy-consent";

// TESTING: remove "@gmail.com" before real use so only school accounts can be imported.
const ALLOWED_DOMAINS = ["@antiquespride.edu.ph", "@gmail.com"];
const MAX_ROWS = 200;
const TEMP_PASSWORD_HOURS = 72;
const SEND_SPACING_MS = 750; // Resend's free plan allows about 2 emails/second
const PROGRAMS = ["BSIT", "BSCS", "BLIS"];
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// The browser parses the .xlsx/.csv and sends rows in this shape.
// The server re-validates everything, so the client is never trusted.
const rowValidator = v.object({
  teamName: v.string(),
  projectTitle: v.string(),
  memberName: v.string(),
  memberEmail: v.string(),
  studentNo: v.optional(v.string()),
  program: v.optional(v.string()),
  section: v.optional(v.string()),
  adviserEmail: v.string(),
});
type Row = Infer<typeof rowValidator>;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function requireInstructor(ctx: QueryCtx | MutationCtx) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) throwUserError("Not signed in");

  const user = await ctx.db
    .query("users")
    .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
    .unique();
  if (!user || user.role !== "instructor") {
    throwUserError("Only instructors can import a roster.");
  }
  if (
    user.status === "pending" ||
    user.status === "rejected" ||
    user.mustChangePassword === true
  ) {
    throwUserError("Your account can't do this yet.");
  }
  return user;
}

async function findTeam(
  ctx: QueryCtx | MutationCtx,
  instructorId: string,
  teamName: string
) {
  const mine = await ctx.db
    .query("capstoneProjects")
    .withIndex("by_instructor_stage_result", (q) =>
      q.eq("instructorId", instructorId)
    )
    .collect();
  const key = teamName.trim().toLowerCase();
  return mine.find((t) => t.teamName.trim().toLowerCase() === key) ?? null;
}

type TeamGroup = {
  teamName: string;
  projectTitle: string;
  titleGiven: boolean;
  adviserEmail: string;
  adviser: Doc<"users"> | null;
  existing: Doc<"capstoneProjects"> | null;
  members: {
    row: number;
    name: string;
    email: string;
    studentNo?: string;
    program?: string;
    section?: string;
    alreadyRegistered: boolean;
  }[];
};

// Used by BOTH the preview and the real import, so what the instructor
// confirms is exactly what gets created.
async function validateRoster(
  ctx: QueryCtx | MutationCtx,
  caller: Doc<"users">,
  rows: Row[]
) {
  if (rows.length === 0) throwUserError("The roster is empty.");
  if (rows.length > MAX_ROWS) {
    throwUserError(`Upload at most ${MAX_ROWS} students at a time.`);
  }

  const errors: { row: number; message: string }[] = [];
  const addError = (row: number, message: string) => {
    errors.push({ row, message });
  };

  const allTeams = await ctx.db.query("capstoneProjects").collect();
  const teamOfUser = new Map<string, Doc<"capstoneProjects">>();
  for (const t of allTeams) {
    for (const m of t.members ?? []) teamOfUser.set(m, t);
  }

  const adviserCache = new Map<string, Doc<"users"> | null>();
  const groups = new Map<string, TeamGroup>();
  const emailRow = new Map<string, number>();
  const studentNoRow = new Map<string, number>();

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const rowNo = i + 2; // spreadsheet row (row 1 is the header)

    const teamName = r.teamName.trim();
    const title = r.projectTitle.trim();
    const name = r.memberName.trim();
    const email = r.memberEmail.trim().toLowerCase();
    const adviserEmail = r.adviserEmail.trim().toLowerCase();
    const studentNo = r.studentNo?.trim() || undefined;
    const program = r.program?.trim().toUpperCase() || undefined;
    const section = r.section?.trim() || undefined;

    if (!teamName || teamName.length > 80) {
      addError(rowNo, "Team name is required (80 characters max).");
    }
    if (title.length > 200) addError(rowNo, "Project title is too long.");
    if (!name || name.length > 100) {
      addError(rowNo, "Member name is required (100 characters max).");
    }
    const emailOk =
      EMAIL_RE.test(email) && ALLOWED_DOMAINS.some((d) => email.endsWith(d));
    if (!emailOk) {
      addError(
        rowNo,
        `Member email must end in ${ALLOWED_DOMAINS.join(" or ")}.`
      );
    }
    if (program && !PROGRAMS.includes(program)) {
      addError(rowNo, `Program must be one of ${PROGRAMS.join(", ")}.`);
    }
    if (section && section.length > 10) addError(rowNo, "Section is too long.");

    // Duplicate email inside the file
    if (emailOk) {
      const prev = emailRow.get(email);
      if (prev !== undefined) {
        addError(rowNo, `Duplicate email (already on row ${prev}).`);
      } else {
        emailRow.set(email, rowNo);
      }
    }

    // Student number: unique in the file and in the system
    if (studentNo) {
      const prev = studentNoRow.get(studentNo);
      if (prev !== undefined) {
        addError(rowNo, `Duplicate student number (already on row ${prev}).`);
      } else {
        studentNoRow.set(studentNo, rowNo);
      }
      const holder = await ctx.db
        .query("users")
        .withIndex("by_studentno", (q) => q.eq("studentNo", studentNo))
        .first();
      if (holder && holder.email.trim().toLowerCase() !== email) {
        addError(rowNo, "Student number is registered to another account.");
      }
    }

    // Is this student already in the system?
    let alreadyRegistered = false;
    if (emailOk) {
      const existing = await ctx.db
        .query("users")
        .withIndex("by_email", (q) => q.eq("email", email))
        .first();
      if (existing) {
        alreadyRegistered = true;
        if (existing.role !== "student") {
          addError(rowNo, `This email belongs to a ${existing.role} account.`);
        } else {
          const current = teamOfUser.get(existing._id);
          const sameTeam =
            current &&
            current.instructorId === caller._id &&
            current.teamName.trim().toLowerCase() === teamName.toLowerCase();
          if (current && !sameTeam) {
            addError(rowNo, `Already on team "${current.teamName}".`);
          }
        }
      }
    }

    // Adviser must be an existing, approved adviser account
    let adviser: Doc<"users"> | null = null;
    if (!EMAIL_RE.test(adviserEmail)) {
      addError(rowNo, "Adviser email is required.");
    } else {
      if (!adviserCache.has(adviserEmail)) {
        const found = await ctx.db
          .query("users")
          .withIndex("by_email", (q) => q.eq("email", adviserEmail))
          .first();
        const approved =
          found &&
          found.role === "adviser" &&
          found.status !== "pending" &&
          found.status !== "rejected";
        adviserCache.set(adviserEmail, approved ? found : null);
      }
      adviser = adviserCache.get(adviserEmail) ?? null;
      if (!adviser) {
        addError(rowNo, `${adviserEmail} isn't an approved adviser account.`);
      }
    }

    if (!teamName) continue;
    const key = teamName.toLowerCase();
    let group = groups.get(key);
    if (!group) {
      const existingTeam = await findTeam(ctx, caller._id, teamName);
      if (existingTeam?.stage === "archived") {
        addError(rowNo, "This team is archived.");
      }
      if (
        existingTeam &&
        adviser &&
        existingTeam.adviserId &&
        existingTeam.adviserId !== adviser._id
      ) {
        addError(
          rowNo,
          "This team already exists with a different adviser. Edit it in Team Management."
        );
      }
      group = {
        teamName,
        projectTitle: title || existingTeam?.projectTitle || "Untitled project",
        titleGiven: !!title,
        adviserEmail,
        adviser,
        existing: existingTeam,
        members: [],
      };
      groups.set(key, group);
    } else {
      if (group.adviserEmail !== adviserEmail) {
        addError(rowNo, `Team "${teamName}" has more than one adviser in the file.`);
      }
      if (title && group.titleGiven && title !== group.projectTitle) {
        addError(rowNo, `Team "${teamName}" has more than one project title.`);
      }
      if (title && !group.titleGiven) {
        group.projectTitle = title;
        group.titleGiven = true;
      }
    }
    group.members.push({
      row: rowNo,
      name,
      email,
      studentNo,
      program,
      section,
      alreadyRegistered,
    });
  }

  return { errors, teams: Array.from(groups.values()) };
}

// Passwords are generated ONLY inside actions. Queries and mutations use a
// seeded random generator, which is not safe for secrets.
function generateTempPassword() {
  const upper = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const lower = "abcdefghijkmnpqrstuvwxyz";
  const digits = "23456789";
  const symbols = "!@#$%*?";
  const all = upper + lower + digits + symbols;
  const rand = (max: number) => {
    const buf = new Uint32Array(1);
    crypto.getRandomValues(buf);
    return buf[0] % max;
  };
  const pick = (set: string) => set[rand(set.length)];

  const chars = [pick(upper), pick(lower), pick(digits), pick(symbols)];
  while (chars.length < 14) chars.push(pick(all));
  for (let i = chars.length - 1; i > 0; i--) {
    const j = rand(i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join("");
}

async function clerk(path: string, init?: RequestInit) {
  const key = process.env.CLERK_SECRET_KEY;
  if (!key) throw new Error("CLERK_SECRET_KEY is not set in Convex.");
  const res = await fetch(`https://api.clerk.com/v1${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  const text = await res.text();
  let body: any = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = null;
  }
  if (!res.ok) {
    const first = body?.errors?.[0];
    throw new Error(
      first?.long_message ?? first?.message ?? `Clerk error ${res.status}`
    );
  }
  return body;
}

function escapeHtml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

async function sendWelcomeEmail(p: {
  to: string;
  name: string;
  teamName: string;
  tempPassword: string;
  expiresAt: number;
}): Promise<string | null> {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.ROSTER_FROM_EMAIL;
  const site = (process.env.SITE_URL ?? "").replace(/\/$/, "");
  if (!key || !from || !site) {
    throw new Error(
      "Email isn't configured (RESEND_API_KEY, ROSTER_FROM_EMAIL, SITE_URL)."
    );
  }

  const loginUrl = `${site}/sign-in?role=student`;
  // Philippine time (UTC+8), formatted by hand so it doesn't depend on Intl data
  const expires =
    new Date(p.expiresAt + 8 * 3600 * 1000)
      .toISOString()
      .slice(0, 16)
      .replace("T", " ") + " (PH time)";

  const text = [
    `Hi ${p.name},`,
    ``,
    `You've been added to team "${p.teamName}" on E-Capstone.`,
    ``,
    `Sign in: ${loginUrl}`,
    `Email: ${p.to}`,
    `Temporary password: ${p.tempPassword}`,
    ``,
    `You'll be asked to set your own password right after you sign in.`,
    `This temporary password expires on ${expires}.`,
    `If you weren't expecting this, ignore this email.`,
  ].join("\n");

  const html = `
    <p>Hi ${escapeHtml(p.name)},</p>
    <p>You've been added to team <strong>${escapeHtml(p.teamName)}</strong> on E-Capstone.</p>
    <p><a href="${escapeHtml(loginUrl)}">Sign in here</a></p>
    <p>Email: <strong>${escapeHtml(p.to)}</strong><br/>
    Temporary password: <strong style="font-family:monospace">${escapeHtml(p.tempPassword)}</strong></p>
    <p>You'll be asked to set your own password right after you sign in.
    This temporary password expires on ${escapeHtml(expires)}.</p>
    <p style="color:#666">If you weren't expecting this, ignore this email.</p>`;

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [p.to],
      subject: `Your E-Capstone account (${p.teamName})`,
      html,
      text,
    }),
  });
  const responseBody: unknown = await res.json().catch(() => null);
  if (!res.ok) {
    const detail =
      typeof responseBody === "object" &&
      responseBody !== null &&
      "message" in responseBody &&
      typeof responseBody.message === "string"
        ? responseBody.message.slice(0, 200)
        : `Email provider returned HTTP ${res.status}.`;
    throw new Error(`Email failed (${res.status}): ${detail}`);
  }

  if (
    typeof responseBody === "object" &&
    responseBody !== null &&
    "id" in responseBody &&
    typeof responseBody.id === "string"
  ) {
    return responseBody.id;
  }
  return null;
}

// Turns any thrown value into a short, readable message. Handles plain
// strings, throwUserError's { kind: "user", message } shape, and normal Errors.
function errorMessage(e: unknown) {
  if (e instanceof ConvexError) {
    const data: unknown = e.data;
    if (typeof data === "string") return data;
    if (
      typeof data === "object" &&
      data !== null &&
      "message" in data &&
      typeof (data as { message: unknown }).message === "string"
    ) {
      return (data as { message: string }).message.slice(0, 300);
    }
  }
  if (e instanceof Error) return e.message.slice(0, 300);
  return "Something went wrong.";
}

// Asks Resend what happened to an email. Returns its last_event
// ("sent", "delivered", "bounced", "complained", ...).
async function fetchResendStatus(emailId: string): Promise<string> {
  const key = process.env.RESEND_API_KEY;
  if (!key) throw new Error("RESEND_API_KEY is not set in Convex.");

  const response = await fetch(
    `https://api.resend.com/emails/${encodeURIComponent(emailId)}`,
    { headers: { Authorization: `Bearer ${key}` } }
  );
  const body: unknown = await response.json().catch(() => null);

  if (!response.ok) {
    const message =
      typeof body === "object" &&
      body !== null &&
      "message" in body &&
      typeof body.message === "string"
        ? body.message.slice(0, 200)
        : `Resend returned HTTP ${response.status}.`;
    throw new Error(message);
  }

  return typeof body === "object" &&
    body !== null &&
    "last_event" in body &&
    typeof body.last_event === "string"
    ? body.last_event
    : "unknown";
}

// Events after which the result will not change on its own
const FINAL_EVENTS = new Set([
  "delivered",
  "bounced",
  "complained",
  "failed",
  "suppressed",
  "canceled",
  "opened",
  "clicked",
]);

// ---------------------------------------------------------------------------
// Instructor-facing: preview, import, retry, status
// ---------------------------------------------------------------------------

// Dry run. Creates nothing. Skip this query while no file is chosen.
export const previewRoster = query({
  args: { rows: v.array(rowValidator) },
  handler: async (ctx, args) => {
    const caller = await requireInstructor(ctx);
    const { errors, teams } = await validateRoster(ctx, caller, args.rows);
    return {
      ok: errors.length === 0,
      errors,
      teams: teams.map((t) => ({
        teamName: t.teamName,
        projectTitle: t.projectTitle,
        adviserName: t.adviser?.name ?? t.adviserEmail,
        isExistingTeam: t.existing !== null,
        members: t.members.map((m) => ({
          row: m.row,
          name: m.name,
          email: m.email,
          alreadyRegistered: m.alreadyRegistered,
        })),
      })),
    };
  },
});

// Creates the teams and one roster entry per student, then schedules the
// account creation + email for each one (spaced out to respect rate limits).
export const importRoster = mutation({
  args: { fileName: v.string(), rows: v.array(rowValidator) },
  handler: async (ctx, args) => {
    const caller = await requireInstructor(ctx);
    const { errors, teams } = await validateRoster(ctx, caller, args.rows);
    if (errors.length > 0) {
      throwUserError("Fix the errors in the roster before importing.");
    }

    const now = Date.now();
    const batchId = `${now.toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
    let order = 0;

    for (const t of teams) {
      if (!t.adviser) throwUserError("Adviser missing.");

      if (!t.existing) {
        const teamId = await ctx.db.insert("capstoneProjects", {
          teamName: t.teamName,
          projectTitle: t.projectTitle,
          phase: "Proposal",
          progress: 0,
          approved: 0,
          underReview: 0,
          needsRevision: 0,
          adviserId: t.adviser._id,
          instructorId: caller._id,
          members: [],
        });
        await ctx.db.insert("notifications", {
          userId: t.adviser._id,
          message: `You have been assigned as adviser for team "${t.teamName}" on project "${t.projectTitle}".`,
          read: false,
          type: "team_created",
          relatedId: teamId,
        });
        await logAction(
          ctx,
          caller,
          "Created team (roster import)",
          `${t.teamName}: ${t.projectTitle}`
        );
      }

      for (const m of t.members) {
        const entryId = await ctx.db.insert("rosterEntries", {
          batchId,
          instructorId: caller._id,
          teamName: t.teamName,
          projectTitle: t.projectTitle,
          adviserEmail: t.adviserEmail,
          name: m.name,
          email: m.email,
          studentNo: m.studentNo,
          program: m.program,
          section: m.section,
          status: "pending",
          createdAt: now,
        });
        await ctx.scheduler.runAfter(
          order++ * SEND_SPACING_MS,
          internal.roster.processEntry,
          { entryId }
        );
      }
    }

    await logAction(
      ctx,
      caller,
      "Imported roster",
      `${args.fileName}: ${args.rows.length} student(s), ${teams.length} team(s)`
    );
    return { batchId, count: args.rows.length };
  },
});

// Retry failures, or re-send a fresh temporary password to students who
// haven't changed theirs yet. Accounts that already changed their password
// are never reset (see processEntry).
export const retryEntries = mutation({
  args: { entryIds: v.array(v.id("rosterEntries")) },
  handler: async (ctx, args) => {
    const caller = await requireInstructor(ctx);
    let count = 0;
    for (const entryId of args.entryIds.slice(0, MAX_ROWS)) {
      const entry = await ctx.db.get(entryId);
      if (!entry || entry.instructorId !== caller._id) continue;
      await ctx.db.patch(entryId, {
        status: "pending",
        error: undefined,
        emailId: undefined,
        deliveryStatus: undefined,
      });
      await ctx.scheduler.runAfter(
        count++ * SEND_SPACING_MS,
        internal.roster.processEntry,
        { entryId }
      );
    }
    await logAction(ctx, caller, "Re-sent roster invites", `${count} student(s)`);
    return count;
  },
});

// Remove students from the roster list.
//
// - Accounts this import created that were never used (still on the temporary
//   password) are fully deleted: Clerk user, Convex user, team membership.
//   That also frees the email, so a corrected row can be imported again.
// - Anyone else (already signed in, or an account that existed before the
//   import) keeps their account and team spot. Only the list entry goes away.
//
// This is an action because deleting the Clerk user needs fetch().
export const removeEntries = action({
  args: { entryIds: v.array(v.id("rosterEntries")) },
  returns: v.number(),
  handler: async (ctx, args): Promise<number> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throwUserError("Not signed in");

    const caller = await ctx.runQuery(internal.roster.getUserByClerkId, {
      clerkId: identity.subject,
    });
    if (
      !caller ||
      caller.role !== "instructor" ||
      caller.status === "pending" ||
      caller.status === "rejected" ||
      caller.mustChangePassword === true
    ) {
      throwUserError("Only instructors can remove roster entries.");
    }

    const plan = await ctx.runQuery(internal.roster.planRemoval, {
      instructorId: caller._id,
      entryIds: args.entryIds.slice(0, MAX_ROWS),
    });

    const items: { entryId: Id<"rosterEntries">; userId: Id<"users"> | null }[] =
      [];
    const failures: string[] = [];
    for (const p of plan) {
      if (p.clerkId) {
        try {
          await clerk(`/users/${p.clerkId}`, { method: "DELETE" });
        } catch (e) {
          const msg = errorMessage(e);
          // Already gone in Clerk is fine: carry on and clean up our side.
          if (!/not found|404/i.test(msg)) {
            failures.push(msg);
            continue;
          }
        }
      }
      items.push({ entryId: p.entryId, userId: p.userId });
    }

    if (items.length === 0 && failures.length > 0) {
      throwUserError(`Couldn't delete the account: ${failures[0]}`);
    }
    return await ctx.runMutation(internal.roster.applyRemoval, {
      instructorId: caller._id,
      items,
    });
  },
});

// Decides, per entry, whether the student's account is safe to delete.
export const planRemoval = internalQuery({
  args: {
    instructorId: v.id("users"),
    entryIds: v.array(v.id("rosterEntries")),
  },
  handler: async (ctx, args) => {
    const picked = new Set<string>(args.entryIds);
    const mine = await ctx.db
      .query("rosterEntries")
      .withIndex("by_instructor", (q) => q.eq("instructorId", args.instructorId))
      .collect();

    // A student re-imported after a bounce can have several entries. Never
    // delete an account that an entry we are keeping still points to.
    const usedElsewhere = new Set<string>();
    for (const e of mine) {
      if (!picked.has(e._id) && e.userId) usedElsewhere.add(e.userId);
    }

    const plan: {
      entryId: Id<"rosterEntries">;
      userId: Id<"users"> | null;
      clerkId: string | null;
    }[] = [];
    for (const e of mine) {
      if (!picked.has(e._id)) continue;
      let userId: Id<"users"> | null = null;
      let clerkId: string | null = null;
      if (e.userId && !usedElsewhere.has(e.userId)) {
        const u = await ctx.db.get(e.userId);
        if (
          u &&
          u.role === "student" &&
          u.importedAt !== undefined &&
          u.mustChangePassword === true
        ) {
          userId = u._id;
          clerkId = u.clerkId;
        }
      }
      plan.push({ entryId: e._id, userId, clerkId });
    }
    return plan;
  },
});

export const applyRemoval = internalMutation({
  args: {
    instructorId: v.id("users"),
    items: v.array(
      v.object({
        entryId: v.id("rosterEntries"),
        userId: v.union(v.id("users"), v.null()),
      })
    ),
  },
  returns: v.number(),
  handler: async (ctx, args) => {
    let count = 0;
    for (const item of args.items) {
      const entry = await ctx.db.get(item.entryId);
      if (!entry || entry.instructorId !== args.instructorId) continue;

      if (item.userId) {
        const team = await findTeam(ctx, args.instructorId, entry.teamName);
        if (team) {
          await ctx.db.patch(team._id, {
            members: (team.members ?? []).filter((m) => m !== item.userId),
          });
        }
        await ctx.db.delete(item.userId);
      }
      // processEntry and autoCheckDelivery both stop when the row is gone,
      // so any email job still scheduled for it does nothing.
      await ctx.db.delete(entry._id);
      count++;
    }

    const caller = await ctx.db.get(args.instructorId);
    if (caller && count > 0) {
      await logAction(ctx, caller, "Removed roster entries", `${count} student(s)`);
    }
    return count;
  },
});

export const myRosterEntries = query({
  args: {},
  handler: async (ctx) => {
    const caller = await requireInstructor(ctx);
    const entries = await ctx.db
      .query("rosterEntries")
      .withIndex("by_instructor", (q) => q.eq("instructorId", caller._id))
      .order("desc")
      .take(300);

    return await Promise.all(
      entries.map(async (e) => {
        const user = e.userId ? await ctx.db.get(e.userId) : null;
        return {
          _id: e._id,
          batchId: e.batchId,
          teamName: e.teamName,
          name: e.name,
          email: e.email,
          status: e.status,
          emailId: e.emailId ?? null,
          deliveryStatus: e.deliveryStatus ?? null,
          error: e.error ?? null,
          createdAt: e.createdAt,
          passwordChanged: user ? user.mustChangePassword !== true : false,
        };
      })
    );
  },
});

export const checkDelivery = action({
  args: { entryId: v.id("rosterEntries") },
  returns: v.string(),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throwUserError("Not signed in");

    const [entry, caller] = await Promise.all([
      ctx.runQuery(internal.roster.getEntry, { entryId: args.entryId }),
      ctx.runQuery(internal.roster.getUserByClerkId, {
        clerkId: identity.subject,
      }),
    ]);
    if (
      !entry ||
      !caller ||
      caller.role !== "instructor" ||
      caller._id !== entry.instructorId
    ) {
      throwUserError("Not authorized to check this email.");
    }
    if (!entry.emailId || entry.status !== "emailed") {
      throwUserError("There is no accepted email to check.");
    }

    let deliveryStatus: string;
    try {
      deliveryStatus = await fetchResendStatus(entry.emailId);
    } catch (e) {
      throwUserError(`Couldn't check delivery: ${errorMessage(e)}`);
    }

    await ctx.runMutation(internal.roster.markDelivery, {
      entryId: args.entryId,
      deliveryStatus,
    });
    return deliveryStatus;
  },
});

// ---------------------------------------------------------------------------
// Internal: runs per student, in the background
// ---------------------------------------------------------------------------

export const getEntry = internalQuery({
  args: { entryId: v.id("rosterEntries") },
  handler: async (ctx, args) => await ctx.db.get(args.entryId),
});

export const getUserByEmail = internalQuery({
  args: { email: v.string() },
  handler: async (ctx, args) =>
    await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", args.email))
      .first(),
});

export const getUserByClerkId = internalQuery({
  args: { clerkId: v.string() },
  handler: async (ctx, args) =>
    await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", args.clerkId))
      .unique(),
});

export const markEntry = internalMutation({
  args: {
    entryId: v.id("rosterEntries"),
    status: v.union(
      v.literal("pending"),
      v.literal("created"),
      v.literal("emailed"),
      v.literal("failed")
    ),
    emailId: v.optional(v.string()),
    error: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.entryId, {
      status: args.status,
      emailId: args.emailId,
      error: args.error,
    });
  },
});

// Saves Resend's result. A bounce (address doesn't exist) writes a clear
// message that the Status tab shows under the student's name.
export const markDelivery = internalMutation({
  args: {
    entryId: v.id("rosterEntries"),
    deliveryStatus: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const entry = await ctx.db.get(args.entryId);
    if (!entry) return null;

    let error: string | undefined = entry.error;
    if (args.deliveryStatus === "bounced") {
      error =
        "This email address doesn't exist or can't receive mail. Remove this student, correct the email in your roster, and import again.";
    } else if (args.deliveryStatus === "complained") {
      error = "The recipient marked this email as spam.";
    } else if (args.deliveryStatus === "suppressed") {
      error =
        "Resend blocked this address because earlier emails to it bounced.";
    } else if (args.deliveryStatus === "failed") {
      error = "The email provider couldn't deliver this email.";
    } else if (args.deliveryStatus === "delivered") {
      error = undefined;
    }

    await ctx.db.patch(entry._id, {
      deliveryStatus: args.deliveryStatus,
      error,
    });
    return null;
  },
});

// Creates (or updates) the Convex user and puts them on their team, in one
// transaction. tempPasswordExpiresAt = null means "already active, don't touch".
export const completeEntry = internalMutation({
  args: {
    entryId: v.id("rosterEntries"),
    clerkId: v.string(),
    tempPasswordExpiresAt: v.union(v.number(), v.null()),
  },
  handler: async (ctx, args) => {
    const entry = await ctx.db.get(args.entryId);
    if (!entry) return;

    const team = await findTeam(ctx, entry.instructorId, entry.teamName);
    if (!team) throw new ConvexError("Team not found.");

    let user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", args.clerkId))
      .unique();

    if (!user) {
      const sameEmail = await ctx.db
        .query("users")
        .withIndex("by_email", (q) => q.eq("email", entry.email))
        .first();
      if (sameEmail) {
        throw new ConvexError("A different account already uses this email.");
      }
      const id = await ctx.db.insert("users", {
        clerkId: args.clerkId,
        name: entry.name,
        email: entry.email,
        role: "student",
        status: "approved",
        studentNo: entry.studentNo,
        program: entry.program,
        section: entry.section,
        importedAt: Date.now(),
        mustChangePassword: args.tempPasswordExpiresAt !== null,
        tempPasswordExpiresAt: args.tempPasswordExpiresAt ?? undefined,
      });
      user = await ctx.db.get(id);
    } else if (args.tempPasswordExpiresAt !== null) {
      await ctx.db.patch(user._id, {
        mustChangePassword: true,
        tempPasswordExpiresAt: args.tempPasswordExpiresAt,
      });
    }
    if (!user) throw new ConvexError("Couldn't create the account.");

    // One team per student
    const teams = await ctx.db.query("capstoneProjects").collect();
    const current = teams.find((t) => (t.members ?? []).includes(user._id));
    if (current && current._id !== team._id) {
      throw new ConvexError(`Already on team "${current.teamName}".`);
    }
    if (!current) {
      await ctx.db.patch(team._id, {
        members: [...(team.members ?? []), user._id],
      });
    }

    await ctx.db.patch(entry._id, {
      status: "created",
      userId: user._id,
      error: undefined,
    });
  },
});

export const processEntry = internalAction({
  args: { entryId: v.id("rosterEntries") },
  handler: async (ctx, args): Promise<void> => {
    const entry = await ctx.runQuery(internal.roster.getEntry, {
      entryId: args.entryId,
    });
    if (!entry || entry.status === "emailed") return;

    try {
      const existing = await ctx.runQuery(internal.roster.getUserByEmail, {
        email: entry.email,
      });
      if (existing && existing.role !== "student") {
        throw new Error(`This email belongs to a ${existing.role} account.`);
      }

      // Already active (changed their password): never reset it.
      // Just make sure they're on the team.
      if (existing && existing.mustChangePassword !== true) {
        await ctx.runMutation(internal.roster.completeEntry, {
          entryId: args.entryId,
          clerkId: existing.clerkId,
          tempPasswordExpiresAt: null,
        });
        return;
      }

      const tempPassword = generateTempPassword();
      const expiresAt = Date.now() + TEMP_PASSWORD_HOURS * 3600 * 1000;

      let clerkId: string | undefined = existing?.clerkId;
      if (!clerkId) {
        const found = await clerk(
          `/users?email_address=${encodeURIComponent(entry.email)}&limit=1`
        );
        const list = Array.isArray(found) ? found : (found?.data ?? []);
        clerkId = list[0]?.id;
      }

      if (clerkId) {
        // Account exists (earlier attempt or earlier sign-up): new temp password.
        // Signing out old sessions is right here: the old password is being replaced.
        await clerk(`/users/${clerkId}`, {
          method: "PATCH",
          body: JSON.stringify({
            password: tempPassword,
            sign_out_of_other_sessions: true,
          }),
        });
      } else {
        const [first, ...rest] = entry.name.split(/\s+/);
        const created = await clerk(`/users`, {
          method: "POST",
          body: JSON.stringify({
            email_address: [entry.email],
            password: tempPassword,
            first_name: first,
            last_name: rest.join(" ") || undefined,
            // Clerk rejects backend-created users when "legal consent" is enabled
            // in the dashboard unless this timestamp is sent. The student's real
            // consent to the data privacy notice is recorded in this app
            // (privacyConsentAt) when they first sign in.
            legal_accepted_at: new Date().toISOString(),
          }),
        });
        clerkId = created.id as string;
      }

      await ctx.runMutation(internal.roster.completeEntry, {
        entryId: args.entryId,
        clerkId,
        tempPasswordExpiresAt: expiresAt,
      });

      const emailId = await sendWelcomeEmail({
        to: entry.email,
        name: entry.name,
        teamName: entry.teamName,
        tempPassword,
        expiresAt,
      });

      await ctx.runMutation(internal.roster.markEntry, {
        entryId: args.entryId,
        status: "emailed",
        emailId: emailId ?? undefined,
      });

      // Check the result automatically (a bounce usually shows within seconds)
      if (emailId) {
        try {
          await ctx.scheduler.runAfter(
            15_000,
            internal.roster.autoCheckDelivery,
            { entryId: args.entryId, emailId, attempt: 1 }
          );
        } catch (scheduleError) {
          console.error("Couldn't schedule delivery check:", scheduleError);
        }
      }
    } catch (e) {
      await ctx.runMutation(internal.roster.markEntry, {
        entryId: args.entryId,
        status: "failed",
        error: errorMessage(e),
      });
    }
  },
});

// Runs by itself after an email is accepted. Checks Resend a few times until
// the result is final (delivered / bounced / ...), so the instructor sees a
// bounce without clicking anything.
export const autoCheckDelivery = internalAction({
  args: {
    entryId: v.id("rosterEntries"),
    emailId: v.string(),
    attempt: v.number(),
  },
  handler: async (ctx, args): Promise<void> => {
    const entry = await ctx.runQuery(internal.roster.getEntry, {
      entryId: args.entryId,
    });
    // The row was deleted, or re-sent with a newer message: stop
    if (!entry || entry.emailId !== args.emailId) return;

    let status: string;
    try {
      status = await fetchResendStatus(args.emailId);
    } catch {
      status = "unknown";
    }

    if (status !== "unknown") {
      await ctx.runMutation(internal.roster.markDelivery, {
        entryId: args.entryId,
        deliveryStatus: status,
      });
    }

    // Not final yet (still "sent" or "delivery_delayed"): look again, max 5 tries
    if (!FINAL_EVENTS.has(status) && args.attempt < 5) {
      await ctx.scheduler.runAfter(
        30_000,
        internal.roster.autoCheckDelivery,
        {
          entryId: args.entryId,
          emailId: args.emailId,
          attempt: args.attempt + 1,
        }
      );
    }
  },
});

// ---------------------------------------------------------------------------
// Student: first-login password change
// ---------------------------------------------------------------------------

export const clearMustChange = internalMutation({
  args: {
    userId: v.id("users"),
    privacyConsentVersion: v.literal(PRIVACY_NOTICE_VERSION),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user) return;
    await ctx.db.patch(user._id, {
      mustChangePassword: false,
      tempPasswordExpiresAt: undefined,
      privacyConsentAt: Date.now(),
      privacyConsentVersion: args.privacyConsentVersion,
    });
    await logAction(ctx, user, "Changed temporary password", user.email);
  },
});

// The password is set through Clerk's backend API and the flag is cleared in
// the same server step, so the flag can't be cleared without a real change.
//
// NOTE: no `sign_out_of_other_sessions` here. Called from the backend API it
// signs out ALL of the user's sessions, including the one they are using right
// now, which would bounce them to sign-in the moment they save.
export const changeInitialPassword = action({
  args: {
    newPassword: v.string(),
    privacyConsentVersion: v.literal(PRIVACY_NOTICE_VERSION),
  },
  handler: async (ctx, args): Promise<null> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throwUserError("Not signed in");

    const user = await ctx.runQuery(internal.roster.getUserByClerkId, {
      clerkId: identity.subject,
    });
    if (!user || user.mustChangePassword !== true) {
      throwUserError("Your password doesn't need to be changed.");
    }
    if (user.tempPasswordExpiresAt && user.tempPasswordExpiresAt < Date.now()) {
      throwUserError(
        "Your temporary password expired. Ask your instructor to send a new one."
      );
    }
    if (args.newPassword.length < 8) {
      throwUserError("Your new password must be at least 8 characters.");
    }

    try {
      await clerk(`/users/${identity.subject}`, {
        method: "PATCH",
        body: JSON.stringify({
          password: args.newPassword,
        }),
      });
    } catch (e) {
      throwUserError(errorMessage(e));
    }

    await ctx.runMutation(internal.roster.clearMustChange, {
      userId: user._id,
      privacyConsentVersion: args.privacyConsentVersion,
    });
    return null;
  },
});