"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useClerk } from "@clerk/nextjs";

export default function InstructorDashboard() {
  const me = useQuery(api.users.getMe);
  const router = useRouter();
  const { signOut } = useClerk();

useEffect(() => {
  if (me === undefined) return;

  if (me === null) return; 

  if (me.role !== "student") { 
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
    <div className="min-h-screen bg-gray-100 flex flex-col items-center justify-center gap-4">
      <h1 className="text-3xl font-bold text-purple-600">Instructor Dashboard</h1>
      <p className="text-gray-600">Welcome, {me?.name}! 👋</p>
      <button
        onClick={() => signOut({ redirectUrl: "/" })}
        className="bg-red-500 text-white px-4 py-2 rounded-md hover:bg-red-600"
      >
        Sign Out
      </button>
    </div>
  );
}