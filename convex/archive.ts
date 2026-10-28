import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { Id } from "./_generated/dataModel";
import { requireAdmin, logAction } from "./users";

export const getAll = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("projects").collect();
  },
});

export const getFileUrl = query({
  args: { storageId: v.optional(v.id("_storage")) },
  handler: async (ctx, args) => {
    if (!args.storageId) return null;
    return await ctx.storage.getUrl(args.storageId);
  },
});

// ---------- admin ----------
export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    return await ctx.storage.generateUploadUrl();
  },
});

export const addProject = mutation({
  args: {
    title: v.string(),
    team: v.string(),
    year: v.number(),
    course: v.string(),
    grade: v.string(),
    abstract: v.string(),
    keywords: v.array(v.string()),
    members: v.array(v.string()),
    adviser: v.string(),
    storageId: v.id("_storage"),
  },
  handler: async (ctx, args) => {
    const admin = await requireAdmin(ctx);
    const archivedDate = new Date().toISOString().slice(0, 10);

    await ctx.db.insert("projects", { ...args, archivedDate });
    await logAction(ctx, admin, "Uploaded to archive", args.title);
  },
});

// Admin-only metadata edit. Only these five fields can change.
// The file (storageId) and archivedDate are never touched.
export const updateProject = mutation({
  args: {
    projectId: v.id("projects"),
    title: v.optional(v.string()),
    course: v.optional(v.string()),
    year: v.optional(v.number()),
    team: v.optional(v.string()),
    adviser: v.optional(v.string()),
  },
  handler: async (ctx, { projectId, ...fields }) => {
    const admin = await requireAdmin(ctx);

    const project = await ctx.db.get(projectId);
    if (!project) throw new Error("Project not found");

    const patch: Record<string, string | number> = {};
    for (const [key, value] of Object.entries(fields)) {
      if (value === undefined) continue;
      const clean = typeof value === "string" ? value.trim() : value;
      if (clean === "") continue;
      if ((project as Record<string, unknown>)[key] === clean) continue;
      patch[key] = clean;
    }
    if (Object.keys(patch).length === 0) return;

    await ctx.db.patch(projectId, patch);
    await logAction(
      ctx,
      admin,
      `Edited archived project (${Object.keys(patch).join(", ")})`,
      project.title
    );
  },
});

export const deleteProject = mutation({
  args: { projectId: v.id("projects") },
  handler: async (ctx, args) => {
    const admin = await requireAdmin(ctx);

    const project = await ctx.db.get(args.projectId);
    if (!project) throw new Error("Project not found");
    if (
      project.capstoneProjectId &&
      (project.title.trim().toLowerCase() === "prajik" ||
        project.team.trim().toLowerCase() === "prajik")
    ) {
      throw new Error("Use Reset project process to remove Prajik and clear its student workflow.");
    }

    const storageIds = new Set([
      ...(project.storageId ? [project.storageId] : []),
      ...(project.additionalFiles ?? []).map((file) => file.storageId),
    ]);
    await Promise.all([...storageIds].map((storageId) => ctx.storage.delete(storageId)));
    await ctx.db.delete(args.projectId);
    await logAction(ctx, admin, "Deleted archived project", project.title);
  },
});

export const resetPrajikProjectProcess = mutation({
  args: { projectId: v.id("projects") },
  returns: v.null(),
  handler: async (ctx, { projectId }) => {
    const admin = await requireAdmin(ctx);
    const archiveProject = await ctx.db.get(projectId);
    if (!archiveProject) throw new Error("Archived project not found.");
    if (
      archiveProject.title.trim().toLowerCase() !== "prajik" &&
      archiveProject.team.trim().toLowerCase() !== "prajik"
    ) {
      throw new Error("This action is only available for the Prajik archive entry.");
    }

    if (!archiveProject.capstoneProjectId) {
      throw new Error("This archive entry is not linked to its accepted team.");
    }

    const capstoneProject = await ctx.db.get(archiveProject.capstoneProjectId);
    if (!capstoneProject) throw new Error("The accepted team for this archive entry was not found.");

    const archiveEntries = await ctx.db
      .query("projects")
      .withIndex("by_capstone_project", (q) =>
        q.eq("capstoneProjectId", capstoneProject._id)
      )
      .take(50);
    if (archiveEntries.length === 50) {
      throw new Error("Too many archive records are linked to this team to reset safely.");
    }

    const submissions = await ctx.db
      .query("imradSubmissions")
      .withIndex("by_project", (q) =>
        q.eq("capstoneProjectId", capstoneProject._id)
      )
      .take(10);
    if (submissions.length === 10) {
      throw new Error("Too many IMRaD submissions are linked to this team to reset safely.");
    }

    const deliverables = await ctx.db
      .query("deliverables")
      .withIndex("by_capstone_project", (q) =>
        q.eq("capstoneProjectId", capstoneProject._id)
      )
      .take(500);
    if (deliverables.length === 500) {
      throw new Error("Too many deliverables are linked to this team to reset safely.");
    }

    const workingDocuments = await ctx.db
      .query("imradWorkingDocuments")
      .withIndex("by_project", (q) =>
        q.eq("projectId", capstoneProject._id)
      )
      .take(50);
    if (workingDocuments.length === 50) {
      throw new Error("Too many working documents are linked to this team to reset safely.");
    }

    const storageIds = new Set<Id<"_storage">>([
      ...(capstoneProject.finalFileId ? [capstoneProject.finalFileId] : []),
      ...archiveEntries.flatMap((entry) => [
        ...(entry.storageId ? [entry.storageId] : []),
        ...(entry.additionalFiles ?? []).map((file) => file.storageId),
      ]),
      ...submissions.flatMap((submission) =>
        submission.evaluationFiles.map((file) => file.storageId)
      ),
      ...deliverables.flatMap((deliverable) =>
        deliverable.storageId ? [deliverable.storageId] : []
      ),
      ...workingDocuments.map((document) => document.storageId),
    ]);

    const drafts = [];
    const comments = [];
    let relatedRecordCount =
      archiveEntries.length +
      submissions.length +
      deliverables.length +
      workingDocuments.length;
    for (const deliverable of deliverables) {
      const deliverableDrafts = await ctx.db
        .query("deliverableDrafts")
        .withIndex("by_deliverable", (q) =>
          q.eq("deliverableId", deliverable._id)
        )
        .take(50);
      if (deliverableDrafts.length === 50) {
        throw new Error("Too many drafts are linked to this team to reset safely.");
      }
      drafts.push(...deliverableDrafts);
      relatedRecordCount += deliverableDrafts.length;
      for (const draft of deliverableDrafts) storageIds.add(draft.storageId);

      const deliverableComments = await ctx.db
        .query("pdfComments")
        .withIndex("by_deliverable", (q) =>
          q.eq("deliverableId", deliverable._id)
        )
        .take(500);
      if (deliverableComments.length === 500) {
        throw new Error("Too many document comments are linked to this team to reset safely.");
      }
      comments.push(...deliverableComments);
      relatedRecordCount += deliverableComments.length;
      if (relatedRecordCount > 500) {
        throw new Error("This project has too much history to reset in one operation.");
      }
    }

    await Promise.all([...storageIds].map((storageId) => ctx.storage.delete(storageId)));
    for (const document of workingDocuments) {
      await ctx.db.delete(document._id);
    }
    for (const submission of submissions) {
      await ctx.db.delete(submission._id);
    }
    for (const comment of comments) {
      await ctx.db.delete(comment._id);
    }
    for (const draft of drafts) {
      await ctx.db.delete(draft._id);
    }
    for (const deliverable of deliverables) {
      await ctx.db.delete(deliverable._id);
    }
    for (const entry of archiveEntries) {
      await ctx.db.delete(entry._id);
    }

    await ctx.db.patch(capstoneProject._id, {
      phase: "Proposal",
      progress: 0,
      approved: 0,
      underReview: 0,
      needsRevision: 0,
      stage: undefined,
      endorsedAt: undefined,
      defenseDate: undefined,
      defenseVenue: undefined,
      defensePanel: undefined,
      defenseResult: undefined,
      finalGrade: undefined,
      archivedAt: undefined,
      finalFileId: undefined,
    });
    await logAction(
      ctx,
      admin,
      "Reset Prajik project process for evaluation",
      `${capstoneProject.teamName}: removed ${deliverables.length} deliverables`
    );
    return null;
  },
});

export const seed = mutation({
  args: {},
  handler: async (ctx) => {
    const projects = [
      {
        title: "UNIVERSITY OF ANTIQUE RFID-BASED VEHICLE ENTRY SYSTEM",
        team: "Team Codevenger(sample groupname)",
        year: 2026,
        course: "Information Technology",
        grade: "A",
        abstract: "This study developed a web-based RFID-Based Vehicle Entry System for the University of Antique to improve vehicle access control, reduce delays caused by manual verification, and strengthen campus security operations. The system utilizes Radio Frequency Identification (RFID) technology integrated with a web-based management platform and centralized database to automate vehicle authentication, monitor vehicle movement, and record entry and exit activities. The system includes modules for vehicle registration, RFID scanning, administration management, real-time monitoring, and log generation to support security personnel in managing authorized vehicle access.",
        archivedDate: "2026-05-10",
        keywords: ["RFID Technology", "Vehicle Entry System", "Access Control","Vehicle Monitoring", "ISO/IEC 25010", "McCall’s Quality Model"],
        members: ["Abby Kent Esmael", "Divine Boston", "Chris Shaina Zamora", "Rhea Rubiano", "Dixie Jade Laurezo"],
        adviser: "Ma'am Keller(sample adviser name)",
        storageId: "kg28326szwbg2a30gfvjdx3ed987wpxs" as Id<"_storage">,
      },
      {
        title: "Health Clinic Management Information System withTreatment Demand Forecasting",
        team: "Team Innovators(sample groupname)",
        year: 2026,
        course: "Computer Science",
        grade: "A+",
        abstract: "Healthcare institutions continue to face challenges in managing patient records, streamlining clinic operations, and anticipating future treatment demand. Traditional paper-based systems often lead to delays in information retrieval, inefficient resource allocation, and difficulties in monitoring patient trends. This study developed a web-based Health Clinic Management Information System (HC-MIS) with Treatment Demand Forecasting for Fama ENT–NHS Medical Clinic. The system integrates patient record management, appointment scheduling, and predictive analytics using a Time Series forecasting approach with Multiple Linear Regression. Historical clinic operational data and patient consultation records were utilized to generate three-month treatment demand forecasts categorized into five anatomical areas: Ear, Nose, Throat, Neck, and Head. The predictive model incorporated temporal and operational variables such as year, month, appointment volume, holiday indicators, and lagged consultation values. System evaluation was conducted using the ISO/IEC 25010 software quality model, assessing functional suitability, performance efficiency, compatibility, usability, reliability, security, maintainability, and portability. Predictive accuracy was measured using Mean Absolute Error (MAE) and Root Mean Squared Error (RMSE). Findings revealed that the system effectively streamlined clinical data management while providing reliable demand forecasts to support evidence-based resource planning and operational decision-making. The developed HC-MIS demonstrates the potential of predictive analytics in improving healthcare efficiency and supporting data-driven clinical management..",
        archivedDate: "2026-05-10",
        keywords: ["health clinic management information system,", "treatment demand forecasting", "predictive analytics", "time series forecasting", " multiple linear regression"],
        members: ["Ylyzah Una P. Angaray", " Rhyns Eric Cabios", "Jerald T. Sibugan", " John Jowil D. Orquia"],
        adviser: "Prof. John Jowil(sample adviser name)",
        storageId: "kg2a08xs8h60syq1fnzf417brn87w0pf" as Id<"_storage">,
      },
      {
        title: "TVulcaFinder: A Mobile Application for Vehicle Servicing",
        team: "DDivas(sample groupname)",
        year: 2026,
        course: "Information Technology",
        grade: "A",
        abstract: "Drivers traveling through the southern municipalities of Antique often face difficulties when encountering vehicle emergencies like flat tires. While vulcanizing shops provide essential roadside repairs, most lack an online presence and are missing from major digital maps. This study addresses this gap by developing VulcaFinder, a GPS-enabled Android mobile application designed to connect motorists with nearby vehicle service providers. Built using Agile methodology, the app features frontend development via React Native, backend services managed through Node.js and Express.js, and real-time synchronization using Firebase and WebSockets. Most importantly, VulcaFinder integrates an offline mode using AsyncStorage and SQLite to keep preloaded map listings accessible in areas with weak internet connectivity. The system was evaluated using two industry-recognized quality standards: the ISO/IEC 25010 model and McCall’s Software Quality Model. Testing with 30 university students yielded an overall mean ISO score of 4.24 ('Very High'), while evaluation by 8 IT experts resulted in a McCall's score of 4.45 ('Very High'). The results prove that VulcaFinder is a stable, reliable, and user-friendly solution that effectively reduces vehicle downtime, enhances road safety, and promotes digital inclusion for small local businesses. ",
        archivedDate: "2026-05-10",
        keywords: ["Mobile Applications", " Digital Inclusion", "Roadside Assistance", "Geolocation Services","ISO/IEC 25010."],
        members: ["Ma. Theresa O. Buston, Angelah S. Jauod", "John Royce Millamena", " Irene Ubaldo", "Kate Villaflor"],
        adviser: "Sir Carl(sample adviser name)",
        storageId: "kg21s7325f3942e1tme642p61587w0cq" as Id<"_storage">,
      },
    ];

    for (const project of projects) {
      await ctx.db.insert("projects", project);
    }
  },
});