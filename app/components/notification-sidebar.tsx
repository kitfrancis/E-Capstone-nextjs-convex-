import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";

export default function Notification() {
    const [open, setOpen] = useState(false);
    const notifications = useQuery(api.notifications.myUnreadNotifications);
    const markAsRead = useMutation(api.notifications.markNotificationAsRead);

    const unreadCount = notifications?.length || 0;

    const handleMarkAsRead = async (notificationId: Id<"notifications">) => {
        try {
            await markAsRead({ notificationId });
        } catch (error) {
            console.error("Failed to mark notification as read:", error);
        }
    };

    const handleMarkAllAsRead = async () => {
        if (!notifications) return;
        
        try {
            await Promise.all(
                notifications.map(n => markAsRead({ notificationId: n._id }))
            );
        } catch (error) {
            console.error("Failed to mark all notifications as read:", error);
        }
    };

    const formatTime = (timestamp: number) => {
        const date = new Date(timestamp);
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const diffHours = diffMs / (1000 * 60 * 60);
        const diffDays = diffMs / (1000 * 60 * 60 * 24);
        
        const diffMinutes = diffMs / (1000 * 60); 

if (diffMinutes < 1) {
    return "Just now";
} else if (diffMinutes < 60) {
    return `${Math.floor(diffMinutes)}m ago`;  
} else if (diffHours < 24) {
    return `${Math.floor(diffHours)}h ago`;
} else if (diffDays < 7) {
    return `${Math.floor(diffDays)}d ago`;
} else {
    return date.toLocaleDateString();
}
    };
return (
    <div className="relative">
       <button onClick={() => setOpen(true)} className="p-2 rounded-xl hover:bg-gray-200 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary relative" > <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-gray-600 dark:text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"> <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.341 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" /> </svg>
         {unreadCount > 0 && (
         <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full" />
            )}
       </button>
         {open && (
           <div className="fixed inset-0 z-40 bg-black/20 dark:bg-black/40" onClick={() => setOpen(false)} />
            )}
            <div className={`fixed top-0 right-0 h-full w-80 z-50 bg-sidebar shadow-xl flex flex-col transition-transform duration-300 ${ open ? "translate-x-0" : "translate-x-full"}`}  >
              <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 dark:border-gray-700">
                <div>
                  <h2 className="text-base font-semibold text-gray-900 dark:text-white">Notifications</h2>
                 <p className="text-xs text-gray-500 dark:text-gray-400">{unreadCount} unread</p>
                    </div>
                    <button onClick={() => setOpen(false)} className="p-1.5 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 dark:text-gray-400"  > <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"> <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /> </svg>
                    </button>
                </div>
                <div className="flex-1 overflow-y-auto divide-y divide-gray-100 dark:divide-gray-800">
                    {notifications && notifications.length > 0 ? (
                        notifications.map(n => (
                         <div key={n._id} className={`px-5 py-4 hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer ${ !n.read ? "bg-blue-50/50 dark:bg-blue-900/10" : ""}`} onClick={() => !n.read && handleMarkAsRead(n._id)} >
                            <div className="flex items-start gap-3">
                              {!n.read && (
                                 <span className="mt-1.5 w-2 h-2 shrink-0 bg-blue-500 rounded-full" />
                               )}
                                <div className={!n.read ? "" : "pl-5"}>
                                   <p className="text-sm font-medium text-gray-900 dark:text-white">
                                      {n.type === "team_created" ? "Team Created" : n.type === "task_assigned" ? "New Task" : "Notification"}
                                  </p>
                                   <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{n.message}</p>
                                   
                                   <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">{formatTime(n._creationTime)}</p>
                                </div>
                                </div>
                            </div>
                        ))
                    ) : (
                        <div className="px-5 py-8 text-center text-gray-500 dark:text-gray-400">
                            <p className="text-sm">No notifications</p>
                        </div>
                    )}
                </div>

                <div className="px-5 py-3 border-t border-gray-200 dark:border-gray-700">
                    <button onClick={handleMarkAllAsRead} disabled={!notifications || notifications.length === 0}
                        className="text-sm text-blue-600 dark:text-blue-400 hover:underline disabled:text-gray-400 disabled:cursor-not-allowed"
                    >
                        Mark all as read
                    </button>
                </div>
            </div>
        </div>
    );
}