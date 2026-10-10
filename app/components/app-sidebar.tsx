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
import Image from "next/image";
import {
  LayoutDashboard,
  Upload,
  ClipboardList,
  Loader2,
  Archive,
  User,
  FileText,
  User2,
  ChevronUp,
  GraduationCap,
} from "lucide-react";

const studentLinks = [
  { label: "Dashboard", href: "/dashboard/student", icon: LayoutDashboard, children: [
    { label: "Deliverables", href: "/dashboard/student?tab=deliverables", icon: FileText },
    { label: "Upload", href: "/dashboard/student?tab=uploads", icon: Upload },
    { label: "Tasks", href: "/dashboard/student?tab=tasks", icon: ClipboardList },
  ]},
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

// Active pill: solid blue with white text, like the design
const ACTIVE =
  "data-[active=true]:bg-blue-500 data-[active=true]:text-white data-[active=true]:font-medium data-[active=true]:shadow-sm data-[active=true]:hover:bg-blue-600 data-[active=true]:hover:text-white";

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
      {/* Logo */}
      <SidebarHeader className="px-4 pt-5 pb-2">
        <div className="flex items-center gap-3 cursor-default">
          <Image src="/CCS.png" alt="Logo" width={44} height={44} className="rounded-lg" />
          <div className="flex flex-col leading-tight">
            <span className="font-semibold text-lg text-foreground">E-Capstone</span>
            <span className="text-[11px] text-muted-foreground">Thesis &amp; Capstone Management</span>
          </div>
        </div>
      </SidebarHeader>

      {/* Navigation */}
      <SidebarContent className="px-2">
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu className="gap-1.5">
              {me === undefined ? (
                <div className="flex items-center gap-2 px-2 py-1.5 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Loading...</span>
                </div>
              ) : (
                links.map((link) =>
                  link.children ? (
                    <SidebarGroup key={link.label} className="p-0">
                      <SidebarMenuItem>
                        <SidebarMenuButton
                          className={`h-11 rounded-xl text-[15px] ${ACTIVE}`}
                          asChild
                          isActive={pathname === link.href}
                        >
                          <button onClick={() => router.push(link.href!)}>
                            <link.icon className="h-5 w-5" />
                            <span>{link.label}</span>
                          </button>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                      <SidebarGroupContent>
                        <SidebarMenuSub>
                          {link.children.map((child) => (
                            <SidebarMenuSubItem key={child.href}>
                              <SidebarMenuSubButton
                                asChild
                                isActive={pathname === child.href}
                                className="rounded-lg data-[active=true]:bg-blue-50 data-[active=true]:text-blue-700 dark:data-[active=true]:bg-blue-950/50 dark:data-[active=true]:text-blue-300"
                              >
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
                        className={`h-11 rounded-xl text-[15px] ${ACTIVE}`}
                        asChild
                        isActive={pathname === link.href}
                      >
                        <button onClick={() => router.push(link.href!)}>
                          <link.icon className="h-5 w-5" />
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

      {/* Footer: motivational card + log out */}
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