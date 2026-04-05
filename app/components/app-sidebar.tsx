"use client";

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useClerk } from "@clerk/nextjs";
import { useRouter, usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Upload,
  ClipboardList,
  Users,
  FileText,
  BookOpen,
  CheckSquare,
  ChevronUp,
  User2,
  Loader2,
} from "lucide-react";

const studentLinks = [
  { label: "Dashboard", href: "/dashboard/student", icon: LayoutDashboard },
  { label: "Upload Deliverables", href: "/dashboard/student/upload", icon: Upload },
  { label: "My Submissions", href: "/dashboard/student/submissions", icon: ClipboardList },
  { label: "Feedback", href: "/dashboard/student/feedback", icon: FileText },
];

const instructorLinks = [
  { label: "Dashboard", href: "/dashboard/instructor", icon: LayoutDashboard },
  { label: "Manage Teams", href: "/dashboard/instructor/teams", icon: Users },
  { label: "Submissions", href: "/dashboard/instructor/submissions", icon: ClipboardList },
  { label: "Tasks", href: "/dashboard/instructor/tasks", icon: CheckSquare },
];

const adviserLinks = [
  { label: "Dashboard", href: "/dashboard/adviser", icon: LayoutDashboard },
  { label: "My Students", href: "/dashboard/adviser/students", icon: Users },
  { label: "Review Papers", href: "/dashboard/adviser/review", icon: BookOpen },
  { label: "Approvals", href: "/dashboard/adviser/approvals", icon: CheckSquare },
];

export function AppSidebar() {
  const me = useQuery(api.users.getMe);
  const { signOut } = useClerk();
  const router = useRouter();
  const pathname = usePathname();

    console.log("me:", me); 
  console.log("me.name:", me?.name);

  const links =
    me === undefined
      ? [] 
      : me?.role === "student"
      ? studentLinks
      : me?.role === "instructor"
      ? instructorLinks
      : me?.role === "adviser"
      ? adviserLinks
      : [];

  return (
    <Sidebar>
      {/* Header */}
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild>
              <div className="cursor-default">
                <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
                  <LayoutDashboard className="size-4" />
                </div>
                <div className="flex flex-col gap-0.5 leading-none">
                  <span className="font-semibold text-lg">E-Capstone</span>
                  <span className="text-base text-medium capitalize text-muted-foreground">
                    {me?.role ?? "—"}
                  </span>
                </div>
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      {/* Content */}
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Navigation</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {me === undefined ? (
                <div className="flex items-center gap-2 px-2 py-1.5 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Loading...</span>
                </div>
              ) : (
                links.map((link) => (
                  <SidebarMenuItem key={link.href}>
                    <SidebarMenuButton
                    className="text-base py-5"
                      asChild
                      isActive={pathname === link.href}
                    >
                      <button onClick={() => router.push(link.href)}>
                        <link.icon />
                        <span>{link.label}</span>
                      </button>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))
              )}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      {/* Footer */}
      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <SidebarMenuButton>
                  <User2 />
                  <span className="truncate text-sm font-medium ">
                    {me === undefined ? "Loading..." : me?.name ?? "—"}
                  </span>
                  <ChevronUp className="ml-auto" />
                </SidebarMenuButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                side="top"
                className="w-[--radix-popper-anchor-width]"
              >
                <DropdownMenuItem disabled>
                  <span className="text-sm font-semibold truncate">
                    {me?.email ?? "—"}
                  </span>
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => signOut({ redirectUrl: "/" })}
                  className="text-red-500 cursor-pointer text-sm font-medium"
                >
                  <span>Sign out</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}