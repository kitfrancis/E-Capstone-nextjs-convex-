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
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ key }),
  });
  const result: unknown = await response.json();

  if (
    !response.ok ||
    !isRecord(result) ||
    result.ok !== true ||
    typeof result.waitForCallback !== "boolean"
  ) {
    throw new Error("Couldn't save your latest edits. Try again.");
  }

  if (result.waitForCallback) {
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
