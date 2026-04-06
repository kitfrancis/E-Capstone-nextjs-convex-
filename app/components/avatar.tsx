"use client";

import {
  BadgeCheckIcon,
  BellIcon,
  CreditCardIcon,
  LogOutIcon,
  Users,
  User2,
  User,
  Users2,
} from "lucide-react"

import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useQuery } from "convex/react";
import { useClerk } from "@clerk/nextjs";
import { api } from "@/convex/_generated/api";


const roleColors: Record<string, string> = {
  student: "bg-blue-500",
  instructor: "bg-purple-500",
  adviser: "bg-green-500",
};


export function DropdownMenuAvatar() {
  const me = useQuery(api.users.getMe);
  const { signOut } = useClerk();

   const initials = me?.name
  ? me.name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2)
  : "?";

  const bgColor = me?.role ? roleColors[me.role] : "bg-gray-400";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="rounded-full">
          <Avatar>
            <AvatarImage  src={me?.image ?? ""} alt={me?.name ?? "User"} />
            <AvatarFallback className={`text-white text-sm font-semibold ${bgColor}`}>{initials}</AvatarFallback>
          </Avatar>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuGroup>
          <DropdownMenuItem>
            <User />
            Edit Profile
          </DropdownMenuItem>
          <DropdownMenuItem>
            <BellIcon />
            Notifications
          </DropdownMenuItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
         <DropdownMenuItem
          onClick={() => signOut({ redirectUrl: "/" })}
          className="text-red-500 cursor-pointer focus:text-red-500"
        >
          <LogOutIcon className="h-4 w-4" />
          Sign Out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
