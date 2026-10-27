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

    const storageIds = new Set([
      ...(project.storageId ? [project.storageId] : []),
      ...(project.additionalFiles ?? []).map((file) => file.storageId),
    ]);
    await Promise.all([...storageIds].map((storageId) => ctx.storage.delete(storageId)));
    await ctx.db.delete(args.projectId);
    await logAction(ctx, admin, "Deleted archived project", project.title);
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