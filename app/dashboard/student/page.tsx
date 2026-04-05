"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useClerk } from "@clerk/nextjs";

export default function StudentDashboard() {
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

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center gap-6 p-4">
      <div className="bg-white p-8 rounded-xl shadow-sm border border-gray-200 text-center">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Student Dashboard</h1>
        <p className="text-gray-500 mb-6">Welcome back, <span className="font-semibold text-blue-600">Master</span>! 👋</p>
        
        <button
          onClick={() => signOut({ redirectUrl: "/" })}
          className="w-full bg-red-500 text-white font-medium px-6 py-2.5 rounded-lg hover:bg-red-600 transition-colors shadow-sm"
        >
          Sign Out
        </button>
      </div>
    </div>
  );
}