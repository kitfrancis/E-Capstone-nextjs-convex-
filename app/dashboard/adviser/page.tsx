"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { Id } from "@/convex/_generated/dataModel";

export default function AdviserDashboard() {
  const me = useQuery(api.users.getMe);
  const project = useQuery(
    api.dashboard.getMyProject,
    me ? { clerkId: me.clerkId } : "skip"
  );

   const teamMembers = useQuery(
      api.dashboard.getProjectMembers,
      project ? { capstoneProjectId: project._id as Id<"capstoneProjects"> } : "skip"
    );
  const router = useRouter();

  


  const allTeams = useQuery(api.dashboard.getTeams, {});
  const allDeliverables = useQuery(api.dashboard.getAllDeliverables, {});

  
  const teamsCount = allTeams?.length ?? 0;
  const waitingReview = allDeliverables?.filter(d => d.status === "under_review").length ?? 0;
  const approved = allDeliverables?.filter(d => d.status === "approved").length ?? 0;
  const needRevision = allDeliverables?.filter(d => d.status === "needs_revision").length ?? 0;

  useEffect(() => {
    if (me === undefined) return;
    if (!me || me.role !== "adviser") {
      router.push("/unauthorized");
    }
  }, [me]);

  if (me === undefined) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
      </div>
    );
  }

  const initials = me?.name
    ? me.name.split(" ").filter(Boolean).map((n: string) => n[0]).join("").slice(0, 2).toUpperCase()
    : "?";

  return (
    <div className="scroll-smooth bg-background">
      <div className="lg:ml-1 px-0 max-h-auto lg:px-5">

        {/* Header */}
        <div className="flex items-center">
          <div>
            <h1 className="text-2xl font-semibold text-foreground">Adviser Dashboard</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Manage teams, review deliverables, and guide project development.
            </p>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 lg:gap-4 mt-3 lg:mt-5 md:mt-10">
          <div className="bg-muted gap-1 flex flex-col items-center justify-center rounded-lg">
            <div className="text-center my-1 lg:my-2">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-8 w-8 mx-auto mb-2 text-blue-600">
                <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
              </svg>
              <h1 className="text-lg lg:text-xl font-semibold text-foreground">{allTeams === undefined ? "—" : teamsCount}</h1>
              <p className="text-xs lg:text-sm text-muted-foreground">Teams under supervision</p>
            </div>
          </div>

          <div className="bg-muted gap-1 flex flex-col items-center justify-center rounded-lg p-4 px-6">
            <div className="text-center my-2">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-8 w-8 mx-auto mb-2 text-orange-600">
                <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
              </svg>
              <h1 className="text-lg lg:text-xl font-semibold text-foreground">{allDeliverables === undefined ? "—" : waitingReview}</h1>
              <p className="text-xs lg:text-sm text-muted-foreground">Awaiting Review</p>
            </div>
          </div>

          <div className="bg-muted gap-1 flex flex-col items-center justify-center rounded-lg p-4 px-6">
            <div className="text-center my-2">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-8 w-8 mx-auto mb-2 text-green-600">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>
              </svg>
              <h1 className="text-lg lg:text-xl font-semibold text-foreground">{allDeliverables === undefined ? "—" : approved}</h1>
              <p className="text-xs lg:text-sm text-muted-foreground">Approved</p>
            </div>
          </div>

          <div className="bg-muted rounded-lg p-4">
            <div className="text-center my-2">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-8 w-8 mx-auto mb-2 text-red-600">
                <path d="M8 2v4"/><path d="M16 2v4"/><rect width="18" height="18" x="3" y="4" rx="2"/><path d="M3 10h18"/>
              </svg>
              <h1 className="text-lg lg:text-xl font-semibold text-foreground">{allDeliverables === undefined ? "—" : needRevision}</h1>
              <p className="text-xs lg:text-sm text-muted-foreground">Need Revision</p>
            </div>
          </div>
        </div>

       
        {/* Teams tabs */}
        <div className="flex items-center justify-between mt-3 mb-2">
          <h1 className="text-xs font-semibold text-foreground">YOUR TEAMS</h1>
          <Button variant="link" className="gap-1 text-xs p-0 h-auto">
            <ArrowLeft className="h-3 w-3" /> View All
          </Button>
        </div>

        <div className="flex items-center mb-3">
          <Button variant='outline' className="rounded-full">CodeVenger</Button>
        </div>
        

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="flex flex-col">
              <div className="border border-border rounded-2xl bg-card p-3.5 lg:p-5 mb-5">
          <div className="flex flex-row items-center gap-3">
            <div className="w-11 h-11 rounded-full bg-muted flex items-center justify-center text-sm font-medium text-foreground">
              {initials}
            </div>
            <div>
              <div className="flex flex-start gap-3">
              <p className="text-sm lg:text-base font-medium text-foreground">{me?.name ?? "—"}</p>
                  <p className="py-1 lg:py-1.5 px-2 lg:px-3 flex items-center justify-center rounded-full bg-muted text-xs font-medium text-foreground">
                     You
                   </p>
              </div>
              <p className="text-xs lg:text-sm font-medium text-muted-foreground">{me?.role ?? "—"}</p>
              <p className="text-xs lg:text-sm font-medium text-muted-foreground">{me?.email ?? "—"}</p>
            </div>
          </div>
          <Separator className="mt-5" />
          <div className="flex flex-row gap-2 lg:gap-4 mt-3 lg:mt-5 items-center">
            <p className="p-1.5 lg:p-2 rounded-full bg-muted flex items-center justify-center text-xs font-medium text-foreground">
              Adviser
            </p>
            <p className="text-xs lg:text-sm font-medium text-muted-foreground">Room</p>
          </div>
        </div>
          </div>


          <div className="flex flex-col">
            <div className="border border-border rounded-2xl bg-card p-3.5 lg:p-5 mb-6">
                <div className="flex flex-col gap-4">
                      {teamMembers === undefined ? (
    <p className="text-sm text-muted-foreground">Loading members...</p>
  ) : (
    teamMembers.map((member) => (
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
                                </div>
                                <p className="text-xs lg:text-sm font-medium text-muted-foreground">
                                  {member.role}
                                </p>
                                <p className="text-xs lg:text-sm font-medium text-muted-foreground">
                                  {member.email}
                                </p>
                              </div>
                            </div>
                          ))
                          )}
                        </div>
            </div>

          </div>
    
        </div>

        


      </div>
    </div>
  );
}