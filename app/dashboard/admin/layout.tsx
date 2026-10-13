"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const me = useQuery(api.users.getMe);

  useEffect(() => {
    if (me === undefined) return;
    if (!me || me.role !== "admin") {
      router.replace("/unauthorized");
    }
  }, [me, router]);

  if (me === undefined || !me || me.role !== "admin") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
      </div>
    );
  }

  return <>{children}</>;
}