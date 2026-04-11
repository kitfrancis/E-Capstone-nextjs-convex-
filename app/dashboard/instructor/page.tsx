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
          Welcome back, {me === undefined ? "Loading..." : me?.name ?? "—"}
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
        
      </div>
    </div>
  );
}