"use client";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { TabsDemo } from "@/app/components/dashboard-tabs";
import { Id } from "@/convex/_generated/dataModel";

export default function Dashboard() {
  const me = useQuery(api.users.getMe);
  const project = useQuery(api.dashboard.getMyProject,
    me ? { clerkId: me.clerkId } : "skip"
  );

  return (
    <div className="scroll-smooth font-Poppins bg-background">
      <div className="lg:ml-1 mx-3 px-3 max-h-auto lg:px-5">
        <h1 className="text-3xl font-semibold text-primary mt-10">
          Welcome back, {me === undefined ? "Loading..." : me?.name ?? "—"}
        </h1>
        <p className="text-gray-600 dark:text-gray-400 mt-2">
          Track your project progress and manage deliverables.
        </p>

        {project === null ? (
          <div className="bg-sidebar outline-1 rounded-2xl p-8 mt-6 md:mt-10 flex flex-col items-center justify-center text-center gap-3">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-16 w-16 text-gray-300 mb-2">
              <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
              <path d="M22 21v-2a4 4 0 0 0-5-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
            </svg>
            <h1 className="text-xl font-semibold text-gray-700">You're not in a team yet</h1>
            <p className="text-gray-500 text-sm max-w-sm">
              You haven't been assigned to a capstone team. Please wait for your instructor to assign you, or contact your adviser.
            </p>
          </div>

        ) : project === undefined ? (
          <div className="bg-sidebar outline-1 rounded-2xl p-8 mt-6 md:mt-10 flex items-center justify-center">
            <p className="text-gray-500">Loading...</p>
          </div>

        ) : (
          <>
            <div className="bg-sidebar outline-1 rounded-2xl p-1 max-h-auto mt-6 md:mt-10">
              <div className="gap-1 mx-5 my-5">
                <div className="flex flex-col mb-5 md:mb-8">
                  <h1 className="font-semibold text-md">Team Overview</h1>
                  <p className="text-gray-500 text-md">
                    {project.teamName} - {project.projectTitle}
                  </p>
                </div>

                <div className="space-y-4">
                  <div className="flex justify-between items-center mb-2 w-full">
                    <h2 className="text-sm font-medium">
                      Current Phase: <span className="font-semibold">{project.phase}</span>
                    </h2>
                    <span className="text-sm font-semibold">{project.progress}%</span>
                  </div>
                  <div className="bg-gray-300 h-2 rounded-full w-full">
                    <div className="bg-gray-700 h-2 rounded-full" style={{ width: `${project.progress}%` }}></div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                    <div className="text-center bg-green-50 p-3 rounded-xl">
                      <h1 className="text-2xl font-semibold text-green-700">{project.approved}</h1>
                      <h1 className="text-sm text-gray-600">Approved</h1>
                    </div>
                    <div className="text-center bg-blue-50 p-3 rounded-xl">
                      <h1 className="text-2xl font-semibold text-blue-700">{project.underReview}</h1>
                      <h1 className="text-sm text-gray-600">Under Review</h1>
                    </div>
                    <div className="text-center bg-yellow-50 p-3 rounded-xl">
                      <h1 className="text-2xl font-semibold text-yellow-700">{project.needsRevision}</h1>
                      <h1 className="text-sm text-gray-600">Needs Revision</h1>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {project && (
              <div className="flex items-center justify-center ml-auto mt-6">
                <TabsDemo capstoneProjectId={project._id} />
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}