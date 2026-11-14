import { NextResponse } from "next/server";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function failure(status: number) {
  return NextResponse.json({ ok: false }, { status });
}

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return failure(400);
  }
  if (!isRecord(body) || typeof body.key !== "string" || !body.key.trim()) {
    return failure(400);
  }

  const server = process.env.ONLYOFFICE_SERVER_URL ?? process.env.NEXT_PUBLIC_ONLYOFFICE_URL;
  if (!server) {
    console.error("OnlyOffice server URL is not configured for force-save.");
    return failure(500);
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
      return failure(502);
    }
    if (result.error === 0) {
      return NextResponse.json({ ok: true, waitForCallback: true });
    }
    if (result.error === 4) {
      return NextResponse.json({ ok: true, waitForCallback: false });
    }

    console.error("OnlyOffice force-save failed with code:", result.error);
    return failure(502);
  } catch (error) {
    console.error("OnlyOffice force-save request failed:", error);
    return failure(502);
  }
}