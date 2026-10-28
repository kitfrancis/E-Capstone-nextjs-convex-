import { NextResponse } from "next/server";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, message: "Invalid request body." }, { status: 400 });
  }

  if (!isRecord(body) || typeof body.key !== "string" || !body.key.trim()) {
    return NextResponse.json({ ok: false, message: "A document key is required." }, { status: 400 });
  }

  const server = (
    process.env.ONLYOFFICE_SERVER_URL ?? process.env.NEXT_PUBLIC_ONLYOFFICE_URL
  )?.trim().replace(/\/+$/, "");
  if (!server) {
    console.error("OnlyOffice server URL is not configured.");
    return NextResponse.json({ ok: false, message: "OnlyOffice is not configured." }, { status: 500 });
  }

  let commandResponse: Response;
  try {
    commandResponse = await fetch(`${server}/coauthoring/CommandService.ashx`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ c: "forcesave", key: body.key }),
      signal: AbortSignal.timeout(15_000),
    });
  } catch (error) {
    console.error("OnlyOffice force-save request failed:", error);
    return NextResponse.json(
      { ok: false, message: "Could not reach the OnlyOffice save service." },
      { status: 502 },
    );
  }

  if (!commandResponse.ok) {
    console.error("OnlyOffice force-save service returned HTTP", commandResponse.status);
    return NextResponse.json(
      { ok: false, message: "OnlyOffice rejected the save request." },
      { status: 502 },
    );
  }

  let result: unknown;
  try {
    result = await commandResponse.json();
  } catch {
    console.error("OnlyOffice force-save service returned a non-JSON response.");
    return NextResponse.json(
      { ok: false, message: "OnlyOffice returned an invalid save response." },
      { status: 502 },
    );
  }

  if (!isRecord(result) || typeof result.error !== "number") {
    console.error("OnlyOffice force-save service returned an unexpected response.");
    return NextResponse.json(
      { ok: false, message: "OnlyOffice returned an invalid save response." },
      { status: 502 },
    );
  }

  if (result.error === 0) {
    return NextResponse.json({ ok: true, waitForCallback: true });
  }
  if (result.error === 4) {
    return NextResponse.json({ ok: true, waitForCallback: false });
  }

  console.error("OnlyOffice force-save command failed with error", result.error);
  return NextResponse.json(
    { ok: false, message: "OnlyOffice could not save the latest edits.", error: result.error },
    { status: 502 },
  );
}
