type DraftSaveState = { storageId: string };

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
  initialStorageId: string,
): Promise<T> {
  validateOnlyOfficeCallbackTarget();

  const before = await getDraft();
  if (!before) throw new Error("Draft not found.");
  if (before.storageId !== initialStorageId) return before;

  const deadline = Date.now() + 30_000;
  const hasDraftAdvanced = (draft: T | null) =>
    !!draft && draft.storageId !== initialStorageId;

  while (Date.now() < deadline) {
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
      const message =
        isRecord(result) && typeof result.message === "string"
          ? result.message
          : "Couldn't save your latest edits. Try again.";
      throw new Error(message);
    }

    if (result.waitForCallback) {
      while (Date.now() < deadline) {
        await new Promise((resolve) => setTimeout(resolve, 500));
        const current = await getDraft();
        if (current && hasDraftAdvanced(current)) return current;
      }

      break;
    }

    const latest = await getDraft();
    if (latest && hasDraftAdvanced(latest)) return latest;
    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  throw new Error(
    "OnlyOffice has not confirmed your latest edits yet. Keep the editor open, wait for them to sync, and try submitting again.",
  );
}
