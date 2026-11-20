"use client";

import { useEffect } from "react";
import { useQuery, useConvexAuth } from "convex/react";
import { api } from "@/convex/_generated/api";
import { AppSidebar } from "@/app/components/app-sidebar";
import { Separator } from "@/components/ui/separator";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
} from "@/components/ui/breadcrumb";
import { usePathname, useRouter } from "next/navigation";
import Notification from "../components/notification-sidebar";
import { DropdownMenuAvatar } from "@/app/components/avatar";
import { NotificationProvider } from "@/app/components/notification-context";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const page = pathname.split("/").pop() ?? "Dashboard";
  const formatted = page.charAt(0).toUpperCase() + page.slice(1);

  // Imported students must set their own password before using the app.
  // Convex already blocks their data; this sends them to the right page.
  const { isAuthenticated } = useConvexAuth();
  const me = useQuery(api.users.getMe, isAuthenticated ? {} : "skip");
  const mustChangePassword = me?.mustChangePassword === true;

  useEffect(() => {
    if (mustChangePassword) router.replace("/change-password");
  }, [mustChangePassword, router]);

  if (mustChangePassword) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
      </div>
    );
  }

  return (
    <NotificationProvider>
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset className="min-w-0 overflow-x-clip">
        <header className="sticky top-0 z-10 flex h-16 w-full items-center gap-2 border-b bg-background px-4">
          <SidebarTrigger className="-ml-1 scale-150" />
          <Separator orientation="vertical" className="mr-2 h-4" />
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem>
                <BreadcrumbPage className="text-lg font-medium">{formatted}</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
              <div className="ml-auto flex items-center gap-3 pr-2">
                <div className=" flex items-center gap-2  ">
                <Notification />
                <DropdownMenuAvatar />
                </div>
             </div>
        </header>
        <div className="flex flex-1 flex-col gap-4 p-4">
          {children}
        </div>
      </SidebarInset>
    </SidebarProvider>
    </NotificationProvider>
  );
}