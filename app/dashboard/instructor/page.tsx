"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useClerk } from "@clerk/nextjs";
import { Button } from "@/components/ui/button";
import { Plus, Calendar } from "lucide-react";
import { DialogDemo } from "@/app/components/createTeam";
import { TaskDialogDemo } from "@/app/components/createTask";
import { InstructorTabsDemo } from "@/app/components/instructorDashboard-tabs";

export default function InstructorDashboard() {
  const me = useQuery(api.users.getMe);
  const router = useRouter();
  const { signOut } = useClerk();


useEffect(() => {
  if (me === undefined) return;

  if (me === null) return; 

  if (me.role !== "instructor") { 
    router.push("/unauthorized");
  }
}, [me, router]);

  if (me === undefined) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
      </div>
    );
  }

  return (
    <div className="scroll-smooth bg-background">
      <div className="lg:ml-1 mx-3 px-3 max-h-auto lg:px-5">
        <div className="grid grid-cols-1 md:grid-cols-2 gap6 ">
          <div>
              <h1 className="text-3xl font-semibold text-primary mt-10">
          Instructor Dashboard
        </h1>
        <p className="text-gray-600 dark:text-gray-400 mt-2">
          Manage teams, assign tasks, and track project progress.
        </p>
          </div>
          <div className="flex items-center md:justify-end mt-3 flex-row gap-3">
                <DialogDemo />  
                <TaskDialogDemo />
          </div>
        </div>


          <div className="grid grid-cols-1 md:grid-cols-4  gap-4 mt-5 md:mt-10">
              <div className="bg-muted gap-1  flex flex-col items-center justify-center rounded-lg p-4 px-6">
                <div className="text-center my-2">
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-users h-8 w-8 mx-auto mb-2 text-blue-600"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M22 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>
                <h1 className="text-2xl font-semibold text-foreground">2</h1>
                <p className="text-sm text-muted-foreground">Total Teams</p>
                </div>
              </div>
              <div className="bg-muted gap-1  flex flex-col items-center justify-center rounded-lg p-4 px-6">
                <div className="text-center my-2">
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-file-text h-8 w-8 mx-auto mb-2 text-green-600"><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"></path><path d="M14 2v4a2 2 0 0 0 2 2h4"></path><path d="M10 9H8"></path><path d="M16 13H8"></path><path d="M16 17H8"></path></svg>
                <h1 className="text-2xl font-semibold text-foreground">2</h1>
                <p className="text-sm text-muted-foreground">Active Projects</p>
                </div>
              </div>
              <div className="bg-muted gap-1  flex flex-col items-center justify-center rounded-lg  p-4 px-6">
                <div className="text-center my-2">
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-clock h-8 w-8 mx-auto mb-2 text-yellow-600"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
                <h1 className="text-2xl font-semibold text-foreground">1</h1>
                <p className="text-sm text-muted-foreground">Pending Review</p>
                </div>
              </div>
              <div className="bg-muted rounded-lg p-4">
                <div className="text-center my-2">
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-calendar h-8 w-8 mx-auto mb-2 text-red-600"><path d="M8 2v4"></path><path d="M16 2v4"></path><rect width="18" height="18" x="3" y="4" rx="2"></rect><path d="M3 10h18"></path></svg>
                <h1 className="text-2xl font-semibold text-foreground">1</h1>
                <p className="text-sm text-muted-foreground">Overdue Tasks</p>
                </div>

              </div>
            </div>
            <div className="flex items-center justify-center ml-auto mt-6">
              <InstructorTabsDemo />
            </div>
        
      </div>
    </div>
  );
}