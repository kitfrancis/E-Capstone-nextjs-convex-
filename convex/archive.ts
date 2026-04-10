import { mutation, query } from "./_generated/server";

export const getAll = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("projects").collect();
  },
});

export const seed = mutation({
  args: {},
  handler: async (ctx) => {
    const projects = [
      {
        title: "E-Capstone: Thesis Management System",
        team: "Team Codevenger",
        year: 2026,
        course: "Information Technology",
        grade: "A",
        abstract: "Lorem ipsum dolor sit amet consectetur adipisicing elit.",
        archivedDate: "2026-05-10",
        keywords: ["Web-Base", "Real-time", "Campus"],
        members: ["Kit Francis S. Besa", "Carl Andrei Diomon", "Stephen Gabarda", "Kyle Steven Morillo"],
        adviser: "Ma'am Keller",
      },
      {
        title: "Smart Campus Navigation System",
        team: "Team Innovators",
        year: 2026,
        course: "Information Technology",
        grade: "A+",
        abstract: "Lorem ipsum dolor sit amet consectetur adipisicing elit.",
        archivedDate: "2026-05-10",
        keywords: ["Campus", "Navigation", "Mobile"],
        members: ["Kit Francis S. Besa", "Carl Andrei Diomon", "Stephen Gabarda", "Kyle Steven Morillo"],
        adviser: "Prof. Michael Chen",
      },
      {
        title: "TraceSync UA: Web-based Alumni Tracking and Event Engagement System",
        team: "buto",
        year: 2026,
        course: "Information Technology",
        grade: "A",
        abstract: "A web-based Alumni Tracking and Event Engagement System.",
        archivedDate: "2026-05-10",
        keywords: ["Campus", "Web-Base", "Mobile", "Responsive"],
        members: ["Chinnie Aira S. Calibjo", "Niel Benedic S. Dayoja", "Charles Justin N. Samindih", "Clyde Dextler D. Fradrillan"],
        adviser: "Sir Carl",
      },
    ];

    for (const project of projects) {
      await ctx.db.insert("projects", project);
    }
  },
});