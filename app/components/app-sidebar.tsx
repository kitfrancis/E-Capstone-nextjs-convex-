"use client";

import {
  Sidebar, SidebarContent, SidebarFooter, SidebarGroup, SidebarGroupContent, SidebarGroupLabel, SidebarHeader, SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarMenuSub, SidebarMenuSubButton, SidebarMenuSubItem,
} from "@/components/ui/sidebar";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
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
  BookOpen,
  CheckSquare,
  ChevronUp,
  ChevronRight,
  User2,
  Loader2,
  Archive,
  User,
  FileText,
  FolderOpen,
} from "lucide-react";

const studentLinks = [
  { label: "Dashboard", href: "/dashboard/student", icon: LayoutDashboard },
  { label: "Archive", href: "/components/Archive", icon: Archive },
  { label: "Profile", href: "/profile/student", icon: User },
];

const instructorLinks = [
  { label: "Dashboard", href: "/dashboard/instructor", icon: LayoutDashboard },
  { label: "Archive", href: "/components/Archive", icon: Archive },
  { label: "Profile", href: "/profile/instructor", icon: User },
];

const adviserLinks = [
  { label: "Dashboard", href: "/dashboard/adviser", icon: LayoutDashboard },
  { label: "Archive", href: "/components/Archive", icon: Archive },
  { label: "Profile", href: "/profile/adviser", icon: User },
];

type LinkItem = {
  label: string;
  icon: React.ElementType;
  href?: string;
  children?: { label: string; href: string; icon: React.ElementType }[];
};

export function AppSidebar() {
  const me = useQuery(api.users.getMe);
  const { signOut } = useClerk();
  const router = useRouter();
  const pathname = usePathname();

  const links: LinkItem[] =
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
    <Sidebar side="left">
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
                <span className="text-base capitalize text-muted-foreground">
                  {me?.role ?? "—"}
                </span>
                </div>
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>


      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Navigation</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {me === undefined ? (
                <div className="flex items-center gap-2 py-1.5 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Loading...</span>
                </div>
              ) : (
                links.map((link) =>
                  link.children ? (
                    <SidebarGroup key={link.label} className="p-0">
                      <SidebarGroupLabel className="flex items-center gap-2 text-xs px-2 py-1">
                        <link.icon className="h-4 w-4" />
                        <span>{link.label}</span>
                      </SidebarGroupLabel>
                      <SidebarGroupContent>
                        <SidebarMenuSub>
                          {link.children.map((child) => (
                           <SidebarMenuSubItem key={child.href}>
                              <SidebarMenuSubButton
                              asChild
                              isActive={pathname === child.href}>
                               <button onClick={() => router.push(child.href)}>
                                 <child.icon />
                             <span>{child.label}</span>
                                </button>
                              </SidebarMenuSubButton>
                            </SidebarMenuSubItem>
                          ))}
                        </SidebarMenuSub>
                      </SidebarGroupContent>
                    </SidebarGroup>
                  ) : (
                    <SidebarMenuItem key={link.href}>
                      <SidebarMenuButton
                        className="text-base py-5"
                        asChild
                        isActive={pathname === link.href}
                      >
                        <button onClick={() => router.push(link.href!)}>
                          <link.icon />
                          <span>{link.label}</span>
                        </button>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  )
                )
              )}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

   
      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <SidebarMenuButton>
                  <User2 />
                  <span className="truncate text-sm font-medium">
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
                   onClick={() => {
                        signOut({ redirectUrl: "/" });
                    }}
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