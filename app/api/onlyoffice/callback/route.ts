import { NextResponse } from "next/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

const DOCX_MIME =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

export async function POST(req: Request) {
  const body = await req.json();
  const draftId = new URL(req.url).searchParams.get("draftId");

  // Draft edits: save into the draft only, never touch the original deliverable.
  if (draftId) {
    if (body.status === 2 || body.status === 6) {
      try {
        const secret = process.env.ONLYOFFICE_CALLBACK_SECRET!;
        const buf = await (await fetch(body.url)).arrayBuffer();

        const uploadUrl = await convex.mutation(api.drafts.generateDraftUploadUrl, { secret });
        const up = await fetch(uploadUrl, {
          method: "POST",
          headers: { "Content-Type": DOCX_MIME },
          body: buf,
        });
        const { storageId } = await up.json();

        await convex.mutation(api.drafts.saveDraftFile, {
          secret,
          draftId: draftId as Id<"deliverableDrafts">,
          storageId,
        });
      } catch (err) {
        console.error("Draft save failed:", err);
        return NextResponse.json({ error: 1 }); // tells OnlyOffice the save failed
      }
    }
    return NextResponse.json({ error: 0 });
  }

  // Non-draft callbacks (your existing behavior) go here.
  // Until you paste that logic in, just acknowledge so the editor doesn't show an error.
  return NextResponse.json({ error: 0 });
}