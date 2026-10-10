"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import Link from "next/link";
import { Users, FileText, Clock, Calendar, ChevronRight, ArrowRight } from "lucide-react";
import { DialogDemo } from "@/app/components/createTeam";
import { TaskDialogDemo } from "@/app/components/createTask";
import { InstructorTabsDemo } from "@/app/components/instructorDashboard-tabs";

export default function InstructorDashboard() {
  const me = useQuery(api.users.getMe);
  const myId = me?._id as string | undefined;
  const router = useRouter();
  const dashboardData = useQuery(
    api.dashboard.getInstructorDashboardData,
    myId ? { instructorId: myId } : "skip"
  );

  useEffect(() => {
    if (me === undefined || me === null) return;
    if (me.role !== "instructor") router.push("/unauthorized");
  }, [me, router]);

  if (me === undefined || dashboardData === undefined) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
      </div>
    );
  }

  const firstName = me?.name?.split(" ")[0] ?? "";

  // TODO: change the hrefs to your real routes
  const stats = [
    {
      label: "Total Teams",
      value: dashboardData.totalTeams,
      icon: Users,
      href: "/instructor/teams",
      linkText: "View all teams",
      card: "bg-blue-50 dark:bg-blue-950/30",
      iconWrap: "bg-blue-100 text-blue-600 dark:bg-blue-900/50 dark:text-blue-400",
      link: "text-blue-700 dark:text-blue-300",
    },
    {
      label: "Active Projects",
      value: dashboardData.activeProjects,
      icon: FileText,
      href: "/instructor/projects",
      linkText: "View projects",
      card: "bg-green-50 dark:bg-green-950/30",
      iconWrap: "bg-green-100 text-green-600 dark:bg-green-900/50 dark:text-green-400",
      link: "text-green-700 dark:text-green-300",
    },
    {
      label: "Pending Review",
      value: dashboardData.pendingReviews,
      icon: Clock,
      href: "/instructor/tasks",
      linkText: "View tasks",
      card: "bg-amber-50 dark:bg-amber-950/30",
      iconWrap: "bg-amber-100 text-amber-600 dark:bg-amber-900/50 dark:text-amber-400",
      link: "text-amber-700 dark:text-amber-300",
    },
    {
      label: "Overdue Tasks",
      value: dashboardData.overdueTasks,
      icon: Calendar,
      href: "/instructor/tasks",
      linkText: "View tasks",
      card: "bg-red-50 dark:bg-red-950/30",
      iconWrap: "bg-red-100 text-red-600 dark:bg-red-900/50 dark:text-red-400",
      link: "text-red-700 dark:text-red-300",
    },
  ];

  return (
    <div className="scroll-smooth bg-background">
      <div className="px-0 lg:px-5 space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-4">
          <div className="rounded-2xl bg-linear-to-r from-blue-100 via-blue-50 to-sky-100 dark:from-blue-950/60 dark:via-blue-950/30 dark:to-slate-900 p-6 lg:p-8 flex flex-col justify-center">
            <h1 className="text-2xl lg:text-3xl font-semibold text-foreground">
              Good day, Prof. {firstName}! 👋
            </h1>
            <p className="text-sm lg:text-base text-muted-foreground mt-2">
              Here&apos;s an overview of your teams, projects, and tasks.
            </p>
            <p className="text-sm text-muted-foreground/80 mt-1">
              Together, we make academic dreams happen!
            </p>
          </div>

          {/* These keep your existing dialogs. See note about restyling their triggers. */}
          <div className="flex flex-col gap-3 justify-center">
            <DialogDemo />
            <TaskDialogDemo />
          </div>
        </div>

        {/* Stat cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4">
          {stats.map((s) => {
            const Icon = s.icon;
            return (
              <Link
                key={s.label}
                href={s.href}
                className={`${s.card} rounded-2xl p-4 lg:p-5 flex flex-col gap-3 transition hover:shadow-md hover:-translate-y-0.5`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`${s.iconWrap} h-12 w-12 rounded-full flex items-center justify-center`}>
                      <Icon className="h-6 w-6" />
                    </div>
                    <div>
                      <p className="text-3xl font-semibold text-foreground leading-none">{s.value}</p>
                      <p className="text-sm text-muted-foreground mt-1">{s.label}</p>
                    </div>
                  </div>
                  <ChevronRight className="h-5 w-5 text-muted-foreground" />
                </div>
                <span className={`${s.link} text-xs font-medium inline-flex items-center gap-1`}>
                  {s.linkText} <ArrowRight className="h-3 w-3" />
                </span>
              </Link>
            );
          })}
        </div>

        {/* Teams / Submissions / Tasks */}
        <div>
          <InstructorTabsDemo />
        </div>
      </div>
    </div>
  );
}