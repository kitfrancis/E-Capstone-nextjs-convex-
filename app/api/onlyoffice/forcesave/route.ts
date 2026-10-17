import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const { key } = await req.json();
  const server = process.env.ONLYOFFICE_SERVER_URL ?? process.env.NEXT_PUBLIC_ONLYOFFICE_URL;
  const r = await fetch(`${server}/command`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ c: "forcesave", key }),
  }).then((res) => res.json());

  if (r.error === 0) return NextResponse.json({ ok: true, waitForCallback: true });
  if (r.error === 4) return NextResponse.json({ ok: true, waitForCallback: false }); // no changes since last save
  return NextResponse.json({ ok: false, error: r.error }, { status: 502 });
}