import { ConvexError } from "convex/values";

export function getConvexErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && !(error instanceof ConvexError)) {
    const message = error.message.trim();
    return message && !message.startsWith("[CONVEX ") ? message : fallback;
  }
  if (!(error instanceof ConvexError)) return fallback;

  const { data } = error;
  if (
    typeof data === "object" &&
    data !== null &&
    !Array.isArray(data) &&
    "kind" in data &&
    data.kind === "user" &&
    "message" in data &&
    typeof data.message === "string" &&
    data.message.trim().length > 0
  ) {
    return data.message;
  }

  return fallback;
}
