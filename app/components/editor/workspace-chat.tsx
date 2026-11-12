"use client";

import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import { useMutation, usePaginatedQuery, useQuery } from "convex/react";
import { MessageSquare, Send } from "lucide-react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";

const MAX_MESSAGE_LENGTH = 2000;

const roleLabels = {
  student: "Student",
  adviser: "Adviser",
  instructor: "Instructor",
  admin: "Admin",
};

export default function WorkspaceChat({
  capstoneProjectId,
  phase,
}: {
  capstoneProjectId: Id<"capstoneProjects">;
  phase: string;
}) {
  const { results, status, loadMore } = usePaginatedQuery(
    api.workspaceChat.list,
    { capstoneProjectId, phase },
    { initialNumItems: 40 },
  );
  const currentUser = useQuery(api.users.getMe);
  const sendMessage = useMutation(api.workspaceChat.send);
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const latestMessageId = results[0]?._id;

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [latestMessageId]);

  const submitMessage = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmedMessage = message.trim();
    if (!trimmedMessage || sending) return;

    setSending(true);
    setError(null);
    try {
      await sendMessage({ capstoneProjectId, phase, message: trimmedMessage });
      setMessage("");
    } catch (sendError) {
      setError(sendError instanceof Error ? sendError.message : "Couldn't send your message.");
    } finally {
      setSending(false);
    }
  };

  return (
    <aside className="flex min-h-0 min-w-0 flex-col border-l border-slate-200 bg-white text-slate-800 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100">
      <header className="flex min-h-14 items-center gap-2 border-b border-slate-200 px-4 dark:border-slate-700">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-sky-50 text-sky-700 dark:bg-sky-950 dark:text-sky-300">
          <MessageSquare className="h-4 w-4" />
        </span>
        <div className="min-w-0">
          <h2 className="truncate text-sm font-semibold">Team chat</h2>
          <p className="truncate text-[11px] text-slate-500 dark:text-slate-400">
            {phase} · shared with your project
          </p>
        </div>
      </header>

      <div
        className="min-h-0 flex-1 space-y-4 overflow-y-auto bg-slate-50/70 px-3 py-4 dark:bg-slate-950/60"
        aria-live="polite"
        aria-label="Workspace chat messages"
      >
        {status === "LoadingFirstPage" ? (
          <p className="py-4 text-center text-xs text-slate-500 dark:text-slate-400">Loading messages...</p>
        ) : results.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center px-4 text-center">
            <MessageSquare className="mb-2 h-7 w-7 text-slate-300 dark:text-slate-600" />
            <p className="text-sm font-medium text-slate-600 dark:text-slate-300">No messages yet</p>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Start a conversation with your project team.</p>
          </div>
        ) : (
          <>
            {status === "CanLoadMore" && (
              <button
                type="button"
                onClick={() => loadMore(40)}
                className="mx-auto block rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 shadow-sm transition-colors hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
              >
                Load earlier messages
              </button>
            )}
            {[...results].reverse().map((item) => (
              <article
                key={item._id}
                className={`flex ${item.authorId === currentUser?._id ? "justify-end" : "justify-start"}`}
              >
                <div className="flex max-w-[88%] items-end gap-2">
                  {item.authorId !== currentUser?._id && (
                    <span
                      aria-hidden="true"
                      className="mb-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-200 text-[10px] font-semibold text-slate-600 dark:bg-slate-700 dark:text-slate-200"
                    >
                      {item.authorName
                        .split(/\s+/)
                        .slice(0, 2)
                        .map((part) => part[0])
                        .join("")
                        .toUpperCase()}
                    </span>
                  )}
                  <div className="min-w-0">
                    <div
                      className={`mb-1 flex flex-wrap items-baseline gap-x-1.5 px-1 ${
                        item.authorId === currentUser?._id
                          ? "justify-end text-right"
                          : "justify-start"
                      }`}
                    >
                      <p className="max-w-full truncate text-[11px] font-semibold text-slate-700 dark:text-slate-200">
                        {item.authorId === currentUser?._id ? "You" : item.authorName}
                      </p>
                      <span className="text-[10px] text-slate-400 dark:text-slate-500">
                        {roleLabels[item.authorRole]}
                      </span>
                    </div>
                    <div
                      className={`rounded-2xl px-3.5 py-2.5 shadow-sm ${
                        item.authorId === currentUser?._id
                          ? "rounded-br-md bg-sky-700 text-white"
                          : "rounded-bl-md border border-slate-200 bg-white text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                      }`}
                    >
                      <p className="whitespace-pre-wrap break-words text-[13px] leading-5">
                        {item.message}
                      </p>
                    </div>
                    <time
                      className={`mt-1 block px-1 text-[10px] text-slate-400 dark:text-slate-500 ${
                        item.authorId === currentUser?._id ? "text-right" : "text-left"
                      }`}
                      dateTime={new Date(item.createdAt).toISOString()}
                    >
                      {new Date(item.createdAt).toLocaleString(undefined, {
                        month: "short",
                        day: "numeric",
                        hour: "numeric",
                        minute: "2-digit",
                      })}
                    </time>
                  </div>
                </div>
              </article>
            ))}
            {status === "LoadingMore" && (
              <p className="py-2 text-center text-xs text-slate-500 dark:text-slate-400">Loading earlier messages...</p>
            )}
          </>
        )}
        <div ref={messagesEndRef} />
      </div>

      <form onSubmit={submitMessage} className="border-t border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900">
        {error && (
          <p role="alert" className="mb-2 rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-700 dark:bg-rose-950/40 dark:text-rose-300">
            {error}
          </p>
        )}
        <label htmlFor="workspace-chat-message" className="sr-only">
          Write a message
        </label>
        <textarea
          id="workspace-chat-message"
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          maxLength={MAX_MESSAGE_LENGTH}
          rows={4}
          placeholder="Write a message..."
          className="min-h-24 w-full resize-none rounded-xl border border-slate-300 bg-slate-50 px-3 py-3 text-sm leading-5 text-slate-800 outline-none transition-colors placeholder:text-slate-400 focus:border-sky-500 focus:bg-white focus:ring-2 focus:ring-sky-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:bg-slate-800 dark:focus:ring-sky-950"
        />
        <div className="mt-2 flex items-center justify-between gap-2">
          <span className="text-[11px] text-slate-400 dark:text-slate-500" aria-live="polite">
            {message.length}/{MAX_MESSAGE_LENGTH}
          </span>
          <button
            type="submit"
            disabled={!message.trim() || sending || status === "LoadingFirstPage"}
            className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-sky-700 px-4 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-sky-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-600 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Send className="h-4 w-4" />
            {sending ? "Sending…" : "Send message"}
          </button>
        </div>
      </form>
    </aside>
  );
}
