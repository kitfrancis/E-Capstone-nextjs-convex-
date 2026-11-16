import { NextResponse } from "next/server";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function failure(status: number, code: string, message: string) {
  return NextResponse.json({ ok: false, code, message }, { status });
}

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return failure(400, "INVALID_REQUEST", "The save request was invalid.");
  }
  if (!isRecord(body) || typeof body.key !== "string" || !body.key.trim()) {
    return failure(400, "INVALID_REQUEST", "The save request was invalid.");
  }

  const server = process.env.ONLYOFFICE_SERVER_URL ?? process.env.NEXT_PUBLIC_ONLYOFFICE_URL;
  if (!server) {
    console.error("OnlyOffice server URL is not configured for force-save.");
    return failure(
      500,
      "SAVE_NOT_CONFIGURED",
      "Document saving is not configured. Contact your administrator."
    );
  }

  try {
    const response = await fetch(`${server.replace(/\/+$/, "")}/command`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ c: "forcesave", key: body.key }),
    });
    const result: unknown = await response.json();

    if (!response.ok || !isRecord(result) || typeof result.error !== "number") {
      console.error("OnlyOffice force-save returned an invalid response.");
      return failure(
        502,
        "SAVE_SERVICE_UNAVAILABLE",
        "The document save service is unavailable. Please try again."
      );
    }
    if (result.error === 0) {
      return NextResponse.json({ ok: true, waitForCallback: true });
    }
    if (result.error === 4) {
      return NextResponse.json({ ok: true, waitForCallback: false });
    }

    console.error("OnlyOffice force-save failed with code:", result.error);
    return failure(
      502,
      "SAVE_REJECTED",
      "The document could not be saved. Please try again."
    );
  } catch (error) {
    console.error("OnlyOffice force-save request failed:", error);
    return failure(
      502,
      "SAVE_SERVICE_UNAVAILABLE",
      "The document save service is unavailable. Please try again."
    );
  }
}