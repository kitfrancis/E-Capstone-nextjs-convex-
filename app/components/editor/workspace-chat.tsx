"use client";

import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import { useMutation, usePaginatedQuery } from "convex/react";
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
    <aside className="flex min-h-0 min-w-0 flex-col border-l border-slate-200 bg-white text-slate-800">
      <header className="flex min-h-14 items-center gap-2 border-b border-slate-200 px-4">
        <MessageSquare className="h-4 w-4 shrink-0 text-sky-600" />
        <div className="min-w-0">
          <h2 className="truncate text-sm font-semibold">Workspace Chat</h2>
          <p className="truncate text-[11px] text-slate-500">{phase} - shared with your project team</p>
        </div>
      </header>

      <div
        className="min-h-0 flex-1 space-y-3 overflow-y-auto p-3"
        aria-live="polite"
        aria-label="Workspace chat messages"
      >
        {status === "LoadingFirstPage" ? (
          <p className="py-4 text-center text-xs text-slate-500">Loading messages...</p>
        ) : results.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center px-4 text-center">
            <MessageSquare className="mb-2 h-7 w-7 text-slate-300" />
            <p className="text-sm font-medium text-slate-600">No messages yet</p>
            <p className="mt-1 text-xs text-slate-500">Start a conversation with your project team.</p>
          </div>
        ) : (
          <>
            {status === "CanLoadMore" && (
              <button
                type="button"
                onClick={() => loadMore(40)}
                className="w-full rounded-md border border-slate-200 px-2 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100"
              >
                Load earlier messages
              </button>
            )}
            {[...results].reverse().map((item) => (
              <article key={item._id} className="rounded-lg bg-slate-50 p-2.5">
                <div className="flex items-start justify-between gap-2">
                  <p className="min-w-0 truncate text-xs font-semibold">{item.authorName}</p>
                  <time
                    className="shrink-0 text-[10px] text-slate-400"
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
                <p className="mt-0.5 text-[10px] text-slate-500">
                  {roleLabels[item.authorRole]}
                </p>
                <p className="mt-2 whitespace-pre-wrap break-words text-sm">{item.message}</p>
              </article>
            ))}
            {status === "LoadingMore" && (
              <p className="py-2 text-center text-xs text-slate-500">Loading earlier messages...</p>
            )}
          </>
        )}
        <div ref={messagesEndRef} />
      </div>

      <form onSubmit={submitMessage} className="border-t border-slate-200 p-3">
        {error && (
          <p role="alert" className="mb-2 text-xs text-rose-600">
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
          rows={3}
          placeholder="Write a message..."
          className="w-full resize-none rounded-md border border-slate-300 bg-white p-2 text-sm outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
        />
        <div className="mt-2 flex items-center justify-between gap-2">
          <span className="text-[10px] text-slate-400">
            {message.length}/{MAX_MESSAGE_LENGTH}
          </span>
          <button
            type="submit"
            disabled={!message.trim() || sending || status === "LoadingFirstPage"}
            className="inline-flex items-center gap-1.5 rounded-md bg-sky-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Send className="h-3.5 w-3.5" />
            {sending ? "Sending…" : "Send"}
          </button>
        </div>
      </form>
    </aside>
  );
}
