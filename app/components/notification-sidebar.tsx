"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation } from "convex/react";
import {
    Bell,
    CheckCircle2,
    ClipboardCheck,
    ClipboardPlus,
    FileUp,
    MessageSquare,
    Undo2,
    Users,
    X,
    type LucideIcon,
} from "lucide-react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { useNotification } from "./notification-context";

type Kind =
    | "task_assigned"
    | "task_submitted"
    | "task_returned"
    | "task_completed"
    | "team_created"
    | "comment_added"
    | "deliverable_uploaded"
    | "other";

type NotificationDoc = {
    _id: Id<"notifications">;
    _creationTime: number;
    type: string;
    message: string;
    read: boolean;
    link?: string;
};


function resolveKind(n: NotificationDoc): Kind {
    if (n.type === "task_confirmed") return "task_completed";
    if (n.type === "task_revision") return "task_returned";
    switch (n.type) {
        case "task_submitted":
        case "task_assigned":
        case "task_returned":
        case "task_completed":
        case "team_created":
        case "comment_added":
        case "deliverable_uploaded":
            return n.type;
    }
    if (/sent the task .* back/i.test(n.message)) return "task_returned";
    if (/confirmed the task/i.test(n.message)) return "task_completed";
    return "other";
}

const KIND_CONFIG: Record<
    Kind,
    {
        title: string;
        action?: string;
        icon: LucideIcon;
        iconClass: string;
        taskBased: boolean; 
    }
> = {
    task_assigned: {
        title: "New task assigned",
        action: "View task",
        icon: ClipboardPlus,
        iconClass: "bg-blue-500/15 text-blue-600 dark:text-blue-400",
        taskBased: true,
    },
    task_returned: {
        title: "Task sent back for revision",
        action: "Review & resubmit",
        icon: Undo2,
        iconClass: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
        taskBased: true,
    },
    task_completed: {
        title: "Task completed",
        icon: CheckCircle2,
        iconClass: "bg-green-500/15 text-green-600 dark:text-green-400",
        taskBased: true,
    },
    task_submitted: {
        title: "Task ready for review",
        action: "Review task",
        icon: ClipboardCheck,
        iconClass: "bg-indigo-500/15 text-indigo-600 dark:text-indigo-400",
        taskBased: true,
    },
    team_created: {
        title: "Team created",
        icon: Users,
        iconClass: "bg-violet-500/15 text-violet-600 dark:text-violet-400",
        taskBased: false,
    },
    comment_added: {
        title: "New comment",
        action: "View comment",
        icon: MessageSquare,
        iconClass: "bg-sky-500/15 text-sky-600 dark:text-sky-400",
        taskBased: false,
    },
    deliverable_uploaded: {
        title: "New deliverable",
        action: "View deliverable",
        icon: FileUp,
        iconClass: "bg-teal-500/15 text-teal-600 dark:text-teal-400",
        taskBased: false,
    },
    other: {
        title: "Notification",
        icon: Bell,
        iconClass: "bg-muted text-muted-foreground",
        taskBased: false,
    },
};

const TASK_BODY: Partial<Record<Kind, string>> = {
    task_assigned: "A new task was assigned to your team.",
    task_returned: "Your instructor returned this task. Review the feedback and resubmit.",
    task_completed: "Your instructor confirmed this task. It is now marked as completed.",
};

/* ------------------------------------------------------------------ */
/* Message + date helpers                                              */
/* ------------------------------------------------------------------ */

/** Pulls the task name (between straight or curly quotes) out of the message. */
function parseTaskName(message: string): string | null {
    const m = message.match(/["“]([^"”]+)["”]/);
    return m ? m[1] : null;
}

/** Pulls "Due date: 2026-09-30" out of the message. */
function parseDueDate(message: string): Date | null {
    const m = message.match(/Due date:\s*(\d{4})-(\d{2})-(\d{2})/i);
    return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : null;
}

const DAY_MS = 24 * 60 * 60 * 1000;

function startOfDay(d: Date) {
    return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

function daysBetween(from: Date, to: Date) {
    return Math.round((startOfDay(to) - startOfDay(from)) / DAY_MS);
}

function groupLabel(timestamp: number, now: Date) {
    const ago = daysBetween(new Date(timestamp), now);
    if (ago <= 0) return "Today";
    if (ago === 1) return "Yesterday";
    if (ago <= 7) return `${ago} days ago`;
    return "Earlier";
}

function formatTime(timestamp: number) {
    const diffMinutes = (Date.now() - timestamp) / 60000;
    if (diffMinutes < 1) return "Just now";
    if (diffMinutes < 60) return `${Math.floor(diffMinutes)}m ago`;
    if (diffMinutes < 60 * 24) return `${Math.floor(diffMinutes / 60)}h ago`;
    if (diffMinutes < 60 * 24 * 7) return `${Math.floor(diffMinutes / (60 * 24))}d ago`;
    return new Date(timestamp).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function dueChip(due: Date, now: Date) {
    const diff = daysBetween(now, due); // negative = overdue
    const date = due.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    if (diff < 0) {
        const n = Math.abs(diff);
        return {
            text: `Overdue by ${n} day${n === 1 ? "" : "s"}`,
            className: "border-red-500/40 bg-red-500/15 text-red-600 dark:text-red-300",
        };
    }
    if (diff <= 7) {
        return {
            text: diff === 0 ? "Due today" : `Due ${date} · in ${diff} day${diff === 1 ? "" : "s"}`,
            className: "border-amber-500/40 bg-amber-500/15 text-amber-700 dark:text-amber-300",
        };
    }
    return {
        text: `Due ${date} · in ${diff} days`,
        className: "border-border text-muted-foreground",
    };
}

/* ------------------------------------------------------------------ */
/* Component                                                           */
/* ------------------------------------------------------------------ */

type Tab = "all" | "unread";

export default function Notification() {
    const { open, setOpen } = useNotification();
    const router = useRouter();

    const notifications = useQuery(api.notifications.myNotifications);
    const unreadCount = useQuery(api.notifications.myUnreadCount) ?? 0;

    const markAsRead = useMutation(api.notifications.markNotificationAsRead);
    const markAsUnread = useMutation(api.notifications.markNotificationAsUnread);
    const markAllAsRead = useMutation(api.notifications.markAllNotificationsAsRead);

    const [tab, setTab] = useState<Tab>("all");

    const visible = useMemo(() => {
        if (!notifications) return [];
        return tab === "all" ? notifications : notifications.filter((n) => !n.read);
    }, [notifications, tab]);

    const handleNotificationClick = async (n: NotificationDoc) => {
        try {
            if (!n.read) {
                await markAsRead({ notificationId: n._id });
            }
            if (n.link) {
                setOpen(false);
                router.push(n.link);
            }
        } catch (error) {
            console.error("Failed to handle notification click:", error);
        }
    };

    const handleToggleRead = async (n: NotificationDoc) => {
        try {
            if (n.read) {
                await markAsUnread({ notificationId: n._id });
            } else {
                await markAsRead({ notificationId: n._id });
            }
        } catch (error) {
            console.error("Failed to update notification:", error);
        }
    };

    const handleMarkAllAsRead = async () => {
        try {
            await markAllAsRead();
        } catch (error) {
            console.error("Failed to mark all notifications as read:", error);
        }
    };

    const now = new Date();

    const tabClass = (active: boolean) =>
        `flex min-h-9 items-center gap-2 rounded-full border px-3.5 text-[13px] font-medium ${
            active
                ? "border-blue-500 bg-blue-500/15 text-blue-700 dark:text-blue-200"
                : "text-muted-foreground hover:bg-muted"
        }`;

    return (
        <div className="relative">
            {/* Bell button */}
            <button
                type="button"
                aria-label={`Notifications${unreadCount > 0 ? `, ${unreadCount} unread` : ""}`}
                onClick={() => setOpen(true)}
                className="relative rounded-xl p-2 hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 dark:hover:bg-gray-700"
            >
                <Bell className="h-6 w-6 text-gray-600 dark:text-gray-400" aria-hidden />
                {unreadCount > 0 && (
                    <span className="absolute right-0.5 top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-semibold leading-none text-white">
                        {unreadCount > 9 ? "9+" : unreadCount}
                    </span>
                )}
            </button>

            {open && (
                <div
                    className="fixed inset-0 z-40 bg-black/20 dark:bg-black/40"
                    onClick={() => setOpen(false)}
                />
            )}

            {/* Panel */}
            <aside
                aria-label="Notifications"
                aria-hidden={!open}
                className={`fixed right-0 top-0 z-50 flex h-full w-full max-w-95 flex-col border-l bg-sidebar shadow-xl transition-transform duration-300 ${
                    open ? "translate-x-0" : "translate-x-full"
                }`}
            >
                {/* Header */}
                <div className="flex items-center justify-between px-5 pb-3.5 pt-5">
                    <div>
                        <h2 className="text-xl font-semibold text-foreground">Notifications</h2>
                        <p className="text-sm text-muted-foreground">
                            {unreadCount === 0 ? "All caught up" : `${unreadCount} unread`}
                        </p>
                    </div>
                    <button
                        type="button"
                        aria-label="Close notifications"
                        onClick={() => setOpen(false)}
                        className="flex h-10 w-10 items-center justify-center rounded-xl border text-muted-foreground hover:bg-muted"
                    >
                        <X className="h-4.5 w-4.5" aria-hidden />
                    </button>
                </div>

                {/* Tabs */}
                <div className="flex gap-2 border-b px-5 pb-3.5" role="tablist">
                    <button
                        type="button"
                        role="tab"
                        aria-selected={tab === "all"}
                        onClick={() => setTab("all")}
                        className={tabClass(tab === "all")}
                    >
                        All
                    </button>
                    <button
                        type="button"
                        role="tab"
                        aria-selected={tab === "unread"}
                        onClick={() => setTab("unread")}
                        className={tabClass(tab === "unread")}
                    >
                        Unread
                        <span
                            className={`min-w-4.5 rounded-full px-1.5 py-px text-center text-[11px] font-semibold ${
                                unreadCount === 0
                                    ? "bg-muted text-muted-foreground"
                                    : "bg-blue-600 text-white"
                            }`}
                        >
                            {unreadCount}
                        </span>
                    </button>
                </div>

                {/* List */}
                <div className="flex-1 overflow-y-auto">
                    {notifications === undefined && (
                        <p className="px-7 py-16 text-center text-sm text-muted-foreground">Loading…</p>
                    )}

                    {notifications !== undefined && visible.length === 0 && (
                        <p className="px-7 py-16 text-center text-sm text-muted-foreground">
                            {tab === "unread"
                                ? "You're all caught up. No unread notifications."
                                : "No notifications yet."}
                        </p>
                    )}

                    {visible.map((n, i) => {
                        const kind = resolveKind(n);
                        const cfg = KIND_CONFIG[kind];
                        const Icon = cfg.icon;

                        const label = groupLabel(n._creationTime, now);
                        const showHeader =
                            i === 0 || groupLabel(visible[i - 1]._creationTime, now) !== label;

                        const taskName = cfg.taskBased ? parseTaskName(n.message) : null;
                        const dueDate = kind === "task_assigned" ? parseDueDate(n.message) : null;
                        const due = dueDate ? dueChip(dueDate, now) : null;
                        // Clean sentence when the task name could be extracted,
                        // otherwise show the original message untouched.
                        const body = taskName && TASK_BODY[kind] ? TASK_BODY[kind] : n.message;

                        return (
                            <div key={n._id}>
                                {showHeader && (
                                    <div className="px-5 pb-2 pt-3.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                                        {label}
                                    </div>
                                )}

                                <div
                                    onClick={() => handleNotificationClick(n)}
                                    className={`flex cursor-pointer gap-2.5 border-b py-3.5 pl-2.5 pr-5 hover:bg-muted/60 ${
                                        n.read ? "" : "bg-blue-500/[0.07]"
                                    }`}
                                >
                                    <div className="w-2 pt-3.5">
                                        <div
                                            className={`h-2 w-2 rounded-full ${n.read ? "bg-transparent" : "bg-blue-500"}`}
                                        />
                                    </div>

                                    <div
                                        className={`flex h-8 w-8 flex-none items-center justify-center rounded-[9px] ${cfg.iconClass} ${
                                            n.read ? "opacity-70" : ""
                                        }`}
                                    >
                                        <Icon className="h-4 w-4" aria-hidden />
                                    </div>

                                    <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                                        <div className="flex items-baseline justify-between gap-2.5">
                                            <span
                                                className={`text-sm ${
                                                    n.read
                                                        ? "font-medium text-foreground/80"
                                                        : "font-semibold text-foreground"
                                                }`}
                                            >
                                                {cfg.title}
                                            </span>
                                            <span className="whitespace-nowrap text-xs text-muted-foreground">
                                                {formatTime(n._creationTime)}
                                            </span>
                                        </div>

                                        <p
                                            className={`text-[13px] leading-normal ${
                                                n.read ? "text-muted-foreground/80" : "text-muted-foreground"
                                            }`}
                                        >
                                            {body}
                                        </p>

                                        {(taskName || due) && (
                                            <div className="flex flex-wrap items-center gap-1.5">
                                                {taskName && (
                                                    <span
                                                        title={taskName}
                                                        className="max-w-37.5 truncate rounded-full border bg-muted px-2.5 py-0.5 text-xs text-foreground/80"
                                                    >
                                                        {taskName}
                                                    </span>
                                                )}
                                                {due && (
                                                    <span
                                                        className={`rounded-full border px-2.5 py-0.5 text-xs ${due.className}`}
                                                    >
                                                        {due.text}
                                                    </span>
                                                )}
                                            </div>
                                        )}

                                        <div className="flex items-center gap-1.5 pt-0.5">
                                            {cfg.action && n.link && (
                                                <button
                                                    type="button"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleNotificationClick(n);
                                                    }}
                                                    className={`min-h-9 rounded-lg px-3 text-[13px] ${
                                                        kind === "task_returned"
                                                            ? "bg-amber-600 font-semibold text-amber-950 hover:bg-amber-500"
                                                            : "border border-blue-500 font-medium text-blue-600 hover:bg-blue-500/10 dark:text-blue-300"
                                                    }`}
                                                >
                                                    {cfg.action}
                                                </button>
                                            )}
                                            <button
                                                type="button"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleToggleRead(n);
                                                }}
                                                className="min-h-9 px-1 text-xs text-muted-foreground hover:text-foreground"
                                            >
                                                {n.read ? "Mark as unread" : "Mark as read"}
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>

                {/* Footer */}
                <div className="flex items-center border-t px-5 py-3">
                    <button
                        type="button"
                        onClick={handleMarkAllAsRead}
                        disabled={unreadCount === 0}
                        className="min-h-11 rounded-xl bg-blue-700 px-4 text-sm font-medium text-white hover:bg-blue-600 disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground"
                    >
                        Mark all as read
                    </button>
                </div>
            </aside>
        </div>
    );
}