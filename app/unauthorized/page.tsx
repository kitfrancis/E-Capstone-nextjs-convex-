// app/unauthorized/page.tsx
"use client";

import { useRouter } from "next/navigation";

export default function Unauthorized() {
  const router = useRouter();

  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4">
      <h1 className="text-3xl font-bold text-red-600">Access Denied</h1>
      <p className="text-gray-600">
        You are not authorized to access this role.
      </p>
      <button
        onClick={() => router.push("/")}
        className="bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700"
      >
        Back to Landing Page
      </button>
    </div>
  );
}