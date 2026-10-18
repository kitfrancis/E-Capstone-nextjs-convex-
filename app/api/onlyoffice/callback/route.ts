import { NextResponse } from "next/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

const DOCX_MIME =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

export async function POST(req: Request) {
  const body = await req.json();
  const params = new URL(req.url).searchParams;
  const draftId = params.get("draftId");
  console.log("OO callback", draftId, body.status, body.url);

  // Draft edits: save into the draft only, never touch the original deliverable.
  if (draftId) {
    if (body.status === 2 || body.status === 6) {
      try {
        const secret = process.env.ONLYOFFICE_SECRET!;
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
        return NextResponse.json({ error: 1 });
      }
    }
    return NextResponse.json({ error: 0 });
  }

  // Adviser / instructor comment sessions: tell the students when the document
  // is saved with changes (status 2 = closed after edits, 6 = force-save while
  // still open). A failed notification never makes OnlyOffice show an error.
  const fileId = params.get("fileId");
  if (
    params.get("notify") === "1" &&
    (body.status === 2 || body.status === 6) &&
    fileId
  ) {
    const clerkIds: string[] = Array.isArray(body.users) ? body.users : [];
    for (const clerkId of clerkIds) {
      try {
        // The mutation ignores anyone who isn't an adviser/instructor on this team
        await convex.mutation(api.dashboard.notifyOfficeComment, {
          secret: process.env.ONLYOFFICE_SECRET!,
          deliverableId: fileId as Id<"deliverables">,
          clerkId,
        });
      } catch (err) {
        console.error("Comment notification failed:", err);
      }
    }
  }

  return NextResponse.json({ error: 0 });
}