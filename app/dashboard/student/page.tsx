  "use client";
  import { useQuery, useMutation } from "convex/react";
  import { api } from "@/convex/_generated/api";
  import { TabsDemo } from "@/app/components/dashboard-tabs";
  import { Separator } from "@/components/ui/separator"
  import { Id } from "@/convex/_generated/dataModel";
import { useState, useEffect } from "react";          
import { useSearchParams } from "next/navigation"; 
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Suspense } from "react";

 function DashboardContent() {


  const searchParams = useSearchParams();                                       
  const deliverableIdFromUrl = searchParams.get("deliverableId") as Id<"deliverables"> | null;
  const pageFromUrl = searchParams.get("page") || "1";
  const highlightPageFromUrl = pageFromUrl ? parseInt(pageFromUrl) : null;


console.log("pageFromUrl:", pageFromUrl);  
console.log("highlightPageFromUrl:", highlightPageFromUrl);
    //for code
    const [code, setCode] = useState("");
    const [error, setError] = useState("");
    const [isLoading, setIsLoading] = useState(false);


    
    const me = useQuery(api.users.getMe);


  const joinTeam = useMutation(api.dashboard.joinTeamByInviteCode);


    const project = useQuery(
      api.dashboard.getMyProject,
      me ? { clerkId: me.clerkId } : "skip"
    );
    const dashboardData = useQuery(
      api.dashboard.getDashboardData,
      project ? { capstoneProjectId: project._id as Id<"capstoneProjects"> } : "skip"
    );

    const teamMembers = useQuery(
      api.dashboard.getProjectMembers,
      project ? { capstoneProjectId: project._id as Id<"capstoneProjects"> } : "skip"
    );

    const projectAdviser = useQuery(
      api.dashboard.getProjectAdviser,
      project ? { capstoneProjectId: project._id as Id<"capstoneProjects"> } : "skip"
    );

    const handleJoin = async () => {
    const trimmed = code.trim().toUpperCase();
    if (!trimmed) {
      setError("Please enter an invite code.");
      return;
    }
    if (!me?.clerkId) {
      setError("Could not identify your account. Please try again.");
      return;
    }
    setIsLoading(true);
    setError("");
    try {
      await joinTeam({ clerkId: me.clerkId, inviteCode: trimmed });
    } catch {
      setError("Invalid invite code. Please check and try again.");
    } finally {
      setIsLoading(false);
    }
  };
  
    return (
      <div className="scroll-smooth font-Poppins bg-background min-h-screen">
        <div className=" lg:ml-1 lg:px-5 pb-5">
  
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
               <p className="text-sm text-muted-foreground max-w-sm mt-1">
                Enter the invite code your instructor gave you to join your capstone team.
              </p>

               <div className="flex flex-col items-center gap-2 w-full max-w-xs">
              <Input
                type="text"
                placeholder="e.g. ECAP-XXXX-XXXX"
                value={code}
                onChange={(e) => {
                  setCode(e.target.value.toUpperCase());
                  setError("");
                }}
                className="w-full text-center font-mono tracking-widest text-sm px-4 py-2.5 rounded-lg border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              />
              {error && (
                <p className="text-xs text-red-500">{error}</p>
              )}
              <Button
                onClick={handleJoin}
                disabled={isLoading || !me?.clerkId}
                className="w-full py-2.5 rounded-lg bg-black dark:bg-white text-white dark:text-black text-sm font-medium hover:opacity-80 transition-opacity disabled:opacity-50"
              >
                {isLoading ? "Joining..." : "Join Team"}
              </Button>
            </div>
              <p className="text-xs text-muted-foreground">
                Don't have a code? Contact your instructor.
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
                    <p className="text-xs lg:text-sm text-muted-foreground mt-1 lg:mt-0.5">
                      {project.projectTitle}
                    </p>
                  </div>
                  <span className="shrink-0 text-xs px-2.5 py-1 rounded-full bg-green-50 dark:bg-green-950 text-green-700 dark:text-green-400 border border-green-200 dark:border-green-800">
                    Enrolled
                  </span>
                </div>

                <div className="mb-5">
                  <div className="flex justify-between items-center mb-2">
                    <p className="text-xs lg:text-sm text-muted-foreground">
                      Current phase:{" "}
                      <span className="font-medium text-foreground text-xs lg:text-sm">
                        {project.phase}
                      </span>
                    </p>
                    <span className="text-sm font-semibold text-foreground ">
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
                  <div className="flex flex-col items-center justify-center rounded-xl bg-muted/60 p-3 ">
                  <p className="text-xs text-muted-foreground mt-0.5">Approved</p>
                    <p className="text-xl font-semibold text-green-700 dark:text-green-400">
                      {dashboardData?.approvedCount}
                    </p>
                    
                  </div>
                  <div className="flex flex-col items-center justify-center rounded-xl bg-muted/60 p-3">
                    <p className="text-xs text-muted-foreground mt-0.5">Under_review</p>
                    <p className="text-xl font-semibold text-blue-700 dark:text-blue-400">
                      {dashboardData?.underReviewCount}
                    </p>
                  </div>
                  <div className="flex flex-col items-center justify-center rounded-xl bg-muted/60 p-3">
                    <p className="text-xs text-muted-foreground mt-0.5">Needs_revision</p>
                    <p className="text-xl font-semibold text-amber-700 dark:text-amber-400">
                      {dashboardData?.needsRevisionCount}
                    </p>
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="flex flex-col">
                    <h1 className="text-xs font-semibold text-foreground mb-2 lg:mb-3">ADVISER</h1>
                      <div className="border border-border rounded-2xl bg-card p-3.5 lg:p-5 mb-1 lg:mb-6">
                        <div className="flex flex-row items-center gap-3">
                          <div className="w-11 h-11 lg:w-13 lg:h-13 rounded-full bg-muted flex items-center justify-center text-sm font-medium text-foreground">
                            {projectAdviser === undefined ? (
                              <span className="text-muted-foreground">?</span>
                            ) : projectAdviser === null ? ( 
                              <span className="text-muted-foreground">-</span>
                            ) : (
                              projectAdviser.name.charAt(0)
                            )}
                          </div>
                          <div className="">
                            <p className="text-sm lg:text-base font-medium text-foreground">
                              {projectAdviser === undefined ? (
                                <span className="text-muted-foreground">Loading...</span>
                              ) : projectAdviser === null ? (
                                <span className="text-muted-foreground">No adviser assigned</span>
                              ) : (
                                projectAdviser.name
                              )}
                            </p>
                            <p className="text-xs lg:text-sm font-medium text-muted-foreground">
                              {projectAdviser === undefined ? (
                                <span className="text-muted-foreground">Loading...</span>
                              ) : projectAdviser === null ? (
                                <span className="text-muted-foreground">—</span>
                              ) : (
                                projectAdviser.role
                              )}
                            </p>
                            <p className=" text-xs lg:text-sm font-medium text-muted-foreground">
                              {projectAdviser === undefined ? (
                                <span className="text-muted-foreground">Loading...</span>
                              ): projectAdviser === null ? (
                                <span className="text-muted-foreground">—</span>
                              ) : (
                                projectAdviser.email
                              )}
                            </p>
                          </div>
                          </div>
                          <Separator className="mt-5"/>

                          <div className="flex flex-row gap-2 lg:gap-4 mt-3 lg:mt-5 items-center">
                              <p className="p-1.5 lg:p-2 rounded-full bg-muted flex items-center justify-center text-xs lg:text-xs font-medium text-foreground">
                                Adviser
                              </p>
                              <p className="text-xs lg:text-sm font-medium text-muted-foreground">
                                Room
                              </p>
                          </div>
                      </div> 
                </div>
              
              <div className="flex flex-col">
                      <h1 className="text-xs font-semibold text-foreground mb-3">TEAM MEMBERS</h1>
                      <div className="border border-border rounded-2xl bg-card p-3.5 lg:p-5 mb-6">
                        {teamMembers === undefined ? (
                          <div className="flex flex-col gap-3">
                            <p className="text-xs lg:text-sm text-muted-foreground animate-pulse">Loading members...</p>
                          </div>
                        ) : teamMembers.length === 0 ? (
                          <p className="text-sm text-muted-foreground">No team members found</p>
                        ) : (
                          <div className="flex flex-col gap-4">
                            {teamMembers.map((member) => (
                              <div key={member._id} className="flex flex-row gap-3 lg:gap-6 items-center">
                                <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center text-sm font-medium text-foreground">
                                  {member.name
                                    .split(" ")
                                    .filter(Boolean)
                                    .map((n: string) => n[0])
                                    .join("")
                                    .slice(0, 2)}
                                </div>
                                <div>
                                  <div className="flex items-center justify-start gap-1">
                                    <p className="text-sm lg:text-base font-medium text-foreground">
                                      {member.name}
                                    </p>
                                    {me?._id === member._id && (
                                      <p className="py-1 lg:py-1.5 px-2 lg:px-3 flex items-center justify-center rounded-full bg-muted text-xs font-medium text-foreground">
                                        You
                                      </p>
                                    )}
                                  </div>
                                  <p className="text-xs lg:text-sm font-medium text-muted-foreground">
                                    {member.role}
                                  </p>
                                  <p className="text-xs lg:text-sm font-medium text-muted-foreground">
                                    {member.email}
                                  </p>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
              </div>
              </div>
  
              <TabsDemo capstoneProjectId={project._id} highlightDeliverableId={deliverableIdFromUrl} highlightPage={highlightPageFromUrl} />
              
            </>
          )}
        </div>
      </div>
    );
  }

  export default function Dashboard() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-sm text-muted-foreground animate-pulse">Loading...</p>
      </div>
    }>
      <DashboardContent />
    </Suspense>
  );
}