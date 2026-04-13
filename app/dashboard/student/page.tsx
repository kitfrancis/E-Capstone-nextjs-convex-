"use client";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { TabsDemo } from "@/app/components/dashboard-tabs";
import { Separator } from "@/components/ui/separator"
 
export default function Dashboard() {
  const me = useQuery(api.users.getMe);
    const advisers = useQuery(api.users.getAdvisers);
  const project = useQuery(
    api.dashboard.getMyProject,
    me ? { clerkId: me.clerkId } : "skip"
  );
 
  return (
    <div className="scroll-smooth font-Poppins bg-background min-h-screen">
      <div className="mx-3 px-3 lg:ml-1 lg:px-5 pb-10">
 
        {/* Header */}
        <div className="mt-10 mb-6">
          <h1 className="text-2xl font-semibold text-foreground">
            Welcome back,{" "}
            {me === undefined ? (
              <span className="text-muted-foreground">Loading...</span>
            ) : (
              me?.name ?? "—"
            )}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Track your project progress and manage deliverables.
          </p>
        </div>
 
        {/* Not in a team */}
        {project === null ? (
          <div className="border border-border rounded-2xl p-10 mt-4 flex flex-col items-center justify-center text-center gap-3 bg-muted/30">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-14 w-14 text-muted-foreground mb-1"
            >
              <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M22 21v-2a4 4 0 0 0-5-3.87" />
              <path d="M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
            <h2 className="text-lg font-semibold text-foreground">
              You're not in a team yet
            </h2>
            <p className="text-sm text-muted-foreground max-w-sm">
              You haven't been assigned to a capstone team. Please wait for
              your instructor to assign you, or contact your adviser.
            </p>
          </div>
 
        ) : project === undefined ? (
          <div className="border border-border rounded-2xl p-10 mt-4 flex items-center justify-center bg-muted/30">
            <p className="text-sm text-muted-foreground animate-pulse">Loading...</p>
          </div>
 
        ) : (
          <>
            <div className="border border-border rounded-2xl bg-card p-5 mb-6">
 
            
              <div className="flex items-start justify-between gap-3 mb-5">
                <div>
                  <h2 className="text-base font-semibold text-foregrou nd leading-tight">
                    {project.teamName}
                  </h2>
                  <p className="text-sm text-muted-foreground mt-0.5">
                    {project.projectTitle}
                  </p>
                </div>
                <span className="shrink-0 text-xs px-2.5 py-1 rounded-full bg-green-50 dark:bg-green-950 text-green-700 dark:text-green-400 border border-green-200 dark:border-green-800">
                  Enrolled
                </span>
              </div>

              <div className="mb-5">
                <div className="flex justify-between items-center mb-2">
                  <p className="text-sm text-muted-foreground">
                    Current phase:{" "}
                    <span className="font-medium text-foreground">
                      {project.phase}
                    </span>
                  </p>
                  <span className="text-sm font-semibold text-foreground">
                    {project.progress}%
                  </span>
                </div>
                <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-1.5 rounded-full bg-violet-600 dark:bg-violet-500 transition-all duration-500"
                    style={{ width: `${project.progress}%` }}
                  />
                </div>
              </div>
 
              <div className="grid grid-cols-3 gap-3">
                <div className="rounded-xl bg-muted/60 p-3 text-center">
                <p className="text-xs text-muted-foreground mt-0.5">Approved</p>
                  <p className="text-xl font-semibold text-green-700 dark:text-green-400">
                    {project.approved}
                  </p>
                  
                </div>
                <div className="rounded-xl bg-muted/60 p-3 text-center">
                  <p className="text-xs text-muted-foreground mt-0.5">Under review</p>
                  <p className="text-xl font-semibold text-blue-700 dark:text-blue-400">
                    {project.underReview}
                  </p>
                </div>
                <div className="rounded-xl bg-muted/60 p-3 text-center">
                  <p className="text-xs text-muted-foreground mt-0.5">Needs revision</p>
                  <p className="text-xl font-semibold text-amber-700 dark:text-amber-400">
                    {project.needsRevision}
                  </p>
                </div>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="flex flex-col">
                   <h1 className="text-xs font-semibold text-foreground mb-3">ADVISER</h1>
                    <div className="border border-border rounded-2xl bg-card p-5 mb-6">
                      <div className="flex flex-row items-center gap-3">
                        <div className="w-13 h-13 rounded-full bg-muted flex items-center justify-center text-sm font-medium text-foreground">
                          {advisers === undefined ? (
                            <span className="text-muted-foreground">?</span>
                          ) : advisers.length === 0 ? ( 
                            <span className="text-muted-foreground">-</span>
                          ) : (
                            advisers[0].name.charAt(0)
                          )}
                        </div>
                        <div className="">
                          <p className="text-base font-medium text-foreground">
                            {advisers === undefined ? (
                              <span className="text-muted-foreground">Loading...</span>
                            ) : advisers.length === 0 ? (
                              <span className="text-muted-foreground">No advisers found</span>
                            ) : (
                              advisers[0].name
                            )}
                          </p>
                          <p className="text-sm font-medium text-muted-foreground">
                            {advisers === undefined ? (
                              <span className="text-muted-foreground">Loading...</span>
                            ) : advisers.length === 0 ? (
                              <span className="text-muted-foreground">No advisers found</span>
                            ) : (
                              advisers[0].course
                            )}
                          </p>
                          <p className="text-sm font font-medium text-muted-foreground">
                            {advisers === undefined ? (
                              <span className="text-muted-foreground">Loading...</span>
                            ): advisers.length === 0 ? (
                              <span className="text-muted-foreground">No advisers found</span>
                            ) : (
                              advisers[0].email
                            )}
                          </p>
                        </div>
                        </div>
                        <Separator className="mt-5"/>

                        <div className="flex flex-row gap-4 mt-5 items-center">
                            <p className="p-2 rounded-full bg-muted flex items-center justify-center text-xs font-medium text-foreground">
                              Adviser
                            </p>
                            <p className="text-sm font-medium text-muted-foreground">
                              Room
                            </p>
                        </div>
                    </div> 
              </div>
             
             <div className="flex flex-col">
                    <h1 className="text-xs font-semibold text-foreground mb-3">TEAM MEMBERS</h1>
                    <div className="border border-border rounded-2xl bg-card p-5 mb-6">
                      {/* {project.members.map((member) => 
                        <div key={member.id} className="flex flex-row items-center gap-3 mb-4">
                          <div className="w-13 h-13 rounded-full bg-muted flex items-center justify-center text-sm font-medium text-foreground">
                            {member.name.charAt(0)}
                          </div>
                          <div className="">
                            <p className="text-base font-medium text-foreground">
                              {member.name}
                            </p>
                            <p className="text-sm font-medium text-muted-foreground">
                              {member.course}
                            </p>
                            <p className="text-sm font font-medium text-muted-foreground">
                              {member.email}
                            </p>
                          </div>
                        </div> */}
                        
                        <div className="flex flex-col gap-3 mb-4">
                          <div className="flex flex-row gap-6 items-center">
                            <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center text-sm font-medium text-foreground">
                              {me === undefined ? (
                                <span className="text-muted-foreground">?</span>
                              ) : me ? (
                               me.name
                                .split(" ")
                                .filter(Boolean) 
                                .map((n) => n[0])
                                .join("")
                                .slice(0, 2)
                              ) : (
                                <span className="text-muted-foreground">-</span>
                              )}

                          </div>
                            <div>
                              <div className="flex item-center justify-center gap-1">
                                  <p className="text-base font-medium text-foreground">
                                {me === undefined ? (
                                  <span className="text-muted-foreground">Loading...</span>
                                ) : (
                                  me?.name ?? "—"
                                )}
                              </p>

                                <p className="py-1.5 px-3 flex items-center justify-center rounded-full bg-muted text-xs font-medium text-foreground">
                                You
                              </p>
                              </div>
                              
                              <p className="text-sm font-medium text-muted-foreground ">
                                {me?.role ?? "—"}
                              </p>
                            </div>
                              
                          
                          </div>

                          
                        </div>
                        <Separator className="mt-5"/>

                        <div className="mt-5 flex flex-col gap-4">
                            <div className="flex flex-row gap-6 items-center ">
                            <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center text-sm font-medium text-foreground">
                              {me === undefined ? (
                                <span className="text-muted-foreground">?</span>
                              ) : me ? (
                               me.name
                                .split(" ")
                                .filter(Boolean) 
                                .map((n) => n[0])
                                .join("")
                                .slice(0, 2)
                              ) : (
                                <span className="text-muted-foreground">-</span>
                              )}

                          </div>
                            <div>
                              <div className="flex item-center justify-center gap-1">
                                  <p className="text-base font-medium text-foreground">
                                {me === undefined ? (
                                  <span className="text-muted-foreground">Loading...</span>
                                ) : (
                                  me?.name ?? "—"
                                )}
                              </p>
                              </div>
                              
                              <p className="text-sm font-medium text-muted-foreground ">
                                {me?.role ?? "—"}
                              </p>
                            </div>
                              
                          
                          </div>

                          <div className="flex flex-row gap-6 items-center ">
                            <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center text-sm font-medium text-foreground">
                              {me === undefined ? (
                                <span className="text-muted-foreground">?</span>
                              ) : me ? (
                               me.name
                                .split(" ")
                                .filter(Boolean) 
                                .map((n) => n[0])
                                .join("")
                                .slice(0, 2)
                              ) : (
                                <span className="text-muted-foreground">-</span>
                              )}

                          </div>
                            <div>
                              <div className="flex item-center justify-center gap-1">
                                  <p className="text-base font-medium text-foreground">
                                {me === undefined ? (
                                  <span className="text-muted-foreground">Loading...</span>
                                ) : (
                                  me?.name ?? "—"
                                )}
                              </p>
                              </div>
                              
                              <p className="text-sm font-medium text-muted-foreground ">
                                {me?.role ?? "—"}
                              </p>
                            </div>
                              
                          
                          </div>
                          <div className="flex flex-row gap-6 items-center ">
                            <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center text-sm font-medium text-foreground">
                              {me === undefined ? (
                                <span className="text-muted-foreground">?</span>
                              ) : me ? (
                               me.name
                                .split(" ")
                                .filter(Boolean) 
                                .map((n) => n[0])
                                .join("")
                                .slice(0, 2)
                              ) : (
                                <span className="text-muted-foreground">-</span>
                              )}

                          </div>
                            <div>
                              <div className="flex item-center justify-center gap-1">
                                  <p className="text-base font-medium text-foreground">
                                {me === undefined ? (
                                  <span className="text-muted-foreground">Loading...</span>
                                ) : (
                                  me?.name ?? "—"
                                )}
                              </p>
                              </div>
                              
                              <p className="text-sm font-medium text-muted-foreground ">
                                {me?.role ?? "—"}
                              </p>
                            </div>
                              
                          
                          </div>

                        </div>

                        
                          
                          
                    </div>
             </div>
            </div>
 
            <TabsDemo capstoneProjectId={project._id} />
            
          </>
        )}
      </div>
    </div>
  );
}