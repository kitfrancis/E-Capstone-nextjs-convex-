type DraftSaveState = {
  updatedAt: number;
  saveRevision?: number;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function validateOnlyOfficeCallbackTarget() {
  if (typeof window === "undefined") return;

  const callbackUrl = process.env.NEXT_PUBLIC_ONLYOFFICE_CALLBACK_URL?.trim();
  if (!callbackUrl) return;

  let callbackOrigin: string;
  try {
    callbackOrigin = new URL(callbackUrl).origin;
  } catch {
    throw new Error("The OnlyOffice save callback URL is invalid.");
  }

  const localAliases = new Set(["host.docker.internal", "localhost", "127.0.0.1"]);
  const usesLocalDockerAlias =
    ["localhost", "127.0.0.1"].includes(window.location.hostname) &&
    localAliases.has(new URL(callbackUrl).hostname);

  if (callbackOrigin !== window.location.origin && !usesLocalDockerAlias) {
    throw new Error(
      "The OnlyOffice save callback points to a different site than this editor. Open the matching deployed site, or configure a callback URL that reaches this app.",
    );
  }
}

export async function forceSaveDraft<T extends DraftSaveState>(
  key: string,
  getDraft: () => Promise<T | null>,
): Promise<T> {
  validateOnlyOfficeCallbackTarget();

  const before = await getDraft();
  if (!before) throw new Error("Draft not found.");

  const response = await fetch("/api/onlyoffice/forcesave", {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ key }),
  });
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) {
    if (response.redirected || response.url.includes("/sign-in")) {
      throw new Error(
        "Your sign-in session expired. Sign in again, then reopen your draft and submit it.",
      );
    }

    throw new Error(
      `Couldn't save your latest edits (HTTP ${response.status}). Refresh the page and try again.`,
    );
  }

  let result: unknown;
  try {
    result = await response.json();
  } catch {
    throw new Error("The save service returned an invalid response. Try again.");
  }

  if (
    !response.ok ||
    !isRecord(result) ||
    result.ok !== true ||
    typeof result.waitForCallback !== "boolean"
  ) {
    throw new Error("Couldn't save your latest edits. Try again.");
  }

  if (result.waitForCallback === true) {
    const deadline = Date.now() + 30_000;
    while (Date.now() < deadline) {
      await new Promise((resolve) => setTimeout(resolve, 500));
      const current = await getDraft();
      if (
        current &&
        ((current.saveRevision ?? 0) > (before.saveRevision ?? 0) ||
          current.updatedAt > before.updatedAt)
      ) {
        return current;
      }
    }

    throw new Error(
      "OnlyOffice did not confirm the latest save. Keep the editor open and try again.",
    );
  }

  const latest = await getDraft();
  if (!latest) throw new Error("Draft not found.");
  return latest;
}
