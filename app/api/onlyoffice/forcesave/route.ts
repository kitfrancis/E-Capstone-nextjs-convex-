import { NextResponse } from "next/server";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}


export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { ok: false, message: "Invalid force-save request." },
      { status: 400 },
    );
  }
  if (!isRecord(body) || typeof body.key !== "string" || !body.key) {
    return NextResponse.json(
      { ok: false, message: "A document key is required." },
      { status: 400 },
    );
  }

  const server = process.env.ONLYOFFICE_SERVER_URL ?? process.env.NEXT_PUBLIC_ONLYOFFICE_URL;
  if (!server) {
    console.error("OnlyOffice force-save failed: no document server URL is configured.");
    return NextResponse.json(
      {
        ok: false,
        message: "The OnlyOffice save service is not configured on the server.",
      },
      { status: 503 },
    );
  }

  try {
    const commandUrl = new URL("/command", server);
    const response = await fetch(commandUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ c: "forcesave", key: body.key }),
      signal: AbortSignal.timeout(10_000),
    });

    if (!response.ok) {
      console.error("OnlyOffice force-save endpoint returned HTTP", response.status);
      return NextResponse.json(
        {
          ok: false,
          message:
            "The OnlyOffice save service could not process the request. Check the server-side OnlyOffice URL and deployment logs.",
        },
        { status: 502 },
      );
    }

    let result: unknown;
    try {
      result = await response.json();
    } catch {
      console.error("OnlyOffice force-save endpoint returned invalid JSON.");
      return NextResponse.json(
        {
          ok: false,
          message:
            "The OnlyOffice save service returned an invalid response. Check its URL and deployment logs.",
        },
        { status: 502 },
      );
    }

    if (!isRecord(result) || typeof result.error !== "number") {
      console.error("OnlyOffice force-save endpoint returned an unexpected response.");
      return NextResponse.json(
        {
          ok: false,
          message: "The OnlyOffice save service returned an unexpected response.",
        },
        { status: 502 },
      );
    }
    if (result.error === 0) {
      return NextResponse.json({ ok: true, waitForCallback: true });
    }
    if (result.error === 4) {
      return NextResponse.json({ ok: true, waitForCallback: false });
    }

    console.error("OnlyOffice force-save command returned error", result.error);
    return NextResponse.json(
      {
        ok: false,
        message: `OnlyOffice could not start saving this document (error ${result.error}).`,
      },
      { status: 502 },
    );
  } catch (error) {
    console.error("OnlyOffice force-save request failed:", error);
    return NextResponse.json(
      {
        ok: false,
        message:
          "The server could not reach OnlyOffice to save this document. Configure ONLYOFFICE_SERVER_URL to an address reachable from the deployed app.",
      },
      { status: 502 },
    );
  }
}