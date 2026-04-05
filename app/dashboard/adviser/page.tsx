"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useClerk } from "@clerk/nextjs";

export default function AdviserDashboard() {
  const me = useQuery(api.users.getMe);
  const router = useRouter();
  const { signOut } = useClerk();

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

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col items-center justify-center gap-4">
      <h1 className="text-3xl font-bold text-green-600">Adviser Dashboard</h1>
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