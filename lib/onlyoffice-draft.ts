type DraftSaveState = {
  updatedAt: number;
  saveRevision?: number;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export async function forceSaveDraft<T extends DraftSaveState>(
  key: string,
  getDraft: () => Promise<T | null>,
): Promise<T> {
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
