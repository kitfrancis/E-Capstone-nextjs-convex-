"use client"; // required for client-side components in Next.js 13+

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

interface RoleContext {
  role: "Student" | "Instructor" | "Adviser";
}

// Replace this with your actual context provider or prop
function useRole(): RoleContext {
  return { role: "Student" }; // placeholder
}

type RoleType = "Student" | "Instructor" | "Adviser";

interface MenuItem {
  name: string;
  path: string;
  group?: string[];
  icon?: React.ReactNode;
}

export default function Navbar() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const { role } = useRole();

  const menuData: Record<RoleType, MenuItem[]> = {
    Student: [
      {
        name: "Dashboard",
        path: "/dashboard",
        icon: (
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="lucide lucide-layout-dashboard h-5 w-5"
          >
            <rect width="7" height="9" x="3" y="3" rx="1"></rect>
            <rect width="7" height="5" x="14" y="3" rx="1"></rect>
            <rect width="7" height="9" x="14" y="12" rx="1"></rect>
            <rect width="7" height="5" x="3" y="16" rx="1"></rect>
          </svg>
        ),
        group: ["/dashboard", "/deliverables", "/uploads", "/tasks"],
      },
      {
        name: "Archive",
        path: "/studentArchive",
        icon: (
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="lucide lucide-archive h-5 w-5"
          >
            <rect width="20" height="5" x="2" y="3" rx="1"></rect>
            <path d="M4 8v11a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8"></path>
            <path d="M10 12h4"></path>
          </svg>
        ),
      },
      {
        name: "Profile",
        path: "/Profile",
        icon: (
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="lucide lucide-user h-5 w-5"
          >
            <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"></path>
            <circle cx="12" cy="7" r="4"></circle>
          </svg>
        ),
      },
    ],
    Instructor: [
      {
        name: "Dashboard",
        path: "/instructorDashboard",
        icon: (
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="lucide lucide-layout-dashboard h-5 w-5"
          >
            <rect width="7" height="9" x="3" y="3" rx="1"></rect>
            <rect width="7" height="5" x="14" y="3" rx="1"></rect>
            <rect width="7" height="9" x="14" y="12" rx="1"></rect>
            <rect width="7" height="5" x="3" y="16" rx="1"></rect>
          </svg>
        ),
        group: ["/instructorDashboard", "/instructorTask", "/submission", "/Teams"],
      },
      {
        name: "Archive",
        path: "/studentArchive",
        icon: (
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="lucide lucide-archive h-5 w-5"
          >
            <rect width="20" height="5" x="2" y="3" rx="1"></rect>
            <path d="M4 8v11a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8"></path>
            <path d="M10 12h4"></path>
          </svg>
        ),
      },
      {
        name: "Profile",
        path: "/instructorProfile",
        icon: (
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="lucide lucide-user h-5 w-5"
          >
            <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"></path>
            <circle cx="12" cy="7" r="4"></circle>
          </svg>
        ),
      },
    ],
    Adviser: [
      {
        name: "Dashboard",
        path: "/adviserDashboard",
        icon: (
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="lucide lucide-layout-dashboard h-5 w-5"
          >
            <rect width="7" height="9" x="3" y="3" rx="1"></rect>
            <rect width="7" height="5" x="14" y="3" rx="1"></rect>
            <rect width="7" height="9" x="14" y="12" rx="1"></rect>
            <rect width="7" height="5" x="3" y="16" rx="1"></rect>
          </svg>
        ),
        group: ["/adviserDashboard", "/reviewDeliverables", "/trackProgress"],
      },
      {
        name: "Archive",
        path: "/studentArchive",
        icon: (
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="lucide lucide-archive h-5 w-5"
          >
            <rect width="20" height="5" x="2" y="3" rx="1"></rect>
            <path d="M4 8v11a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8"></path>
            <path d="M10 12h4"></path>
          </svg>
        ),
      },
      {
        name: "Profile",
        path: "/Profile",
        icon: (
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="lucide lucide-user h-5 w-5"
          >
            <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"></path>
            <circle cx="12" cy="7" r="4"></circle>
          </svg>
        ),
      },
    ],
  };

  const menuItems: MenuItem[] = menuData[role as RoleType] || menuData["Student"];

  const getPageTitle = () => {
    if (
      [
        "/dashboard",
        "/deliverablesbutton",
        "/uploadbutton",
        "/taskbutton",
        "/deliverables",
        "/uploads",
        "/tasks",
        "/instructorDashboard",
        "/instructorTask",
        "/submission",
        "/Teams",
        "/adviserDashboard",
        "/reviewDeliverables",
        "/trackProgress",
      ].includes(pathname)
    )
      return "Dashboard";

    if (["/studentArchive"].includes(pathname)) return "Archive";
    if (["/Profile", "/instructorProfile", "/adviserProfile"].includes(pathname))
      return "Profile";

    return "";
  };

  useEffect(() => {
    setIsMenuOpen(false);
  }, [pathname]);

  return (
    <>
      {/* your entire JSX here unchanged, just replace NavLink with Link and isActive logic */}
      <div className="font-Poppins">
        {/* Sidebar and mobile menu... */}
        {/* Replace NavLink with Link: */}
        {menuItems.map((item) => {
          const active = item.group?.includes(pathname) || pathname === item.path;
          return (
            <Link
              key={item.path}
              href={item.path}
              className={`flex items-center gap-2 py-2 px-6 rounded-2xl font-medium text-xl ${
                active
                  ? "bg-blue-600 text-white"
                  : "text-gray-900 hover:bg-gray-100"
              }`}
            >
              {item.icon}
              {item.name}
            </Link>
          );
        })}
      </div>
    </>
  );
}