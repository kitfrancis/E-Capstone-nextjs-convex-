import { NextResponse } from "next/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isAllowedOnlyOfficeFileUrl(value: string) {
  const configuredServer =
    process.env.NEXT_PUBLIC_ONLYOFFICE_URL ?? process.env.ONLYOFFICE_SERVER_URL;
  if (!configuredServer) return false;

  try {
    const fileUrl = new URL(value);
    const serverUrl = new URL(configuredServer);
    return (
      fileUrl.origin === serverUrl.origin &&
      fileUrl.username === "" &&
      fileUrl.password === "" &&
      (fileUrl.protocol === "https:" ||
        (fileUrl.protocol === "http:" &&
          ["localhost", "127.0.0.1"].includes(fileUrl.hostname)))
    );
  } catch {
    return false;
  }
}

export async function POST(req: Request) {
  let parsedBody: unknown;
  try {
    parsedBody = await req.json();
  } catch {
    return NextResponse.json({ error: 1 }, { status: 400 });
  }
  if (!isRecord(parsedBody)) {
    return NextResponse.json({ error: 1 }, { status: 400 });
  }
  const body = parsedBody;
  const params = new URL(req.url).searchParams;
  const draftId = params.get("draftId");
  const adminImradSubmissionId = params.get("adminImradSubmissionId");
  console.log("OO callback", draftId, body.status);

  if (adminImradSubmissionId) {
    if (body.status === 2 || body.status === 6) {
      if (
        typeof body.url !== "string" ||
        !isAllowedOnlyOfficeFileUrl(body.url) ||
        !process.env.ONLYOFFICE_SECRET
      ) {
        console.error("Admin IMRaD callback is missing a valid OnlyOffice file URL or secret.");
        return NextResponse.json({ error: 1 });
      }
      try {
        const documentResponse = await fetch(body.url, {
          redirect: "error",
          signal: AbortSignal.timeout(30_000),
        });
        if (!documentResponse.ok) throw new Error("OnlyOffice PDF download failed.");
        const pdf = await documentResponse.arrayBuffer();
        const secret = process.env.ONLYOFFICE_SECRET;
        const uploadUrl = await convex.mutation(
          api.imrad.generateAdminWorkingDocumentUploadUrl,
          { secret },
        );
        const uploadResponse = await fetch(uploadUrl, {
          method: "POST",
          headers: { "Content-Type": "application/pdf" },
          body: pdf,
        });
        if (!uploadResponse.ok) throw new Error("Convex PDF upload failed.");
        const result: unknown = await uploadResponse.json();
        if (
          !isRecord(result) ||
          typeof result.storageId !== "string"
        ) {
          throw new Error("Convex returned an invalid storage ID.");
        }
        await convex.mutation(api.imrad.saveAdminWorkingDocumentFile, {
          secret,
          submissionId: adminImradSubmissionId as Id<"imradSubmissions">,
          storageId: result.storageId as Id<"_storage">,
        });
      } catch (error) {
        console.error("Admin IMRaD PDF save failed:", error);
        return NextResponse.json({ error: 1 });
      }
    }
    return NextResponse.json({ error: 0 });
  }

  // Draft edits: save into the draft only, never touch the original deliverable.
  if (draftId) {
    if (body.status === 2 || body.status === 6) {
      if (typeof body.url !== "string" || !isAllowedOnlyOfficeFileUrl(body.url)) {
        console.error("Draft callback is missing a valid OnlyOffice file URL.");
        return NextResponse.json({ error: 1 });
      }
      try {
        const secret = process.env.ONLYOFFICE_SECRET!;
        const documentResponse = await fetch(body.url, {
          redirect: "error",
          signal: AbortSignal.timeout(30_000),
        });
        if (!documentResponse.ok) throw new Error("OnlyOffice draft download failed.");
        const buf = await documentResponse.arrayBuffer();

        const uploadUrl = await convex.mutation(api.drafts.generateDraftUploadUrl, { secret });
        const uploadResponse = await fetch(uploadUrl, {
          method: "POST",
          headers: {
            "Content-Type":
              documentResponse.headers.get("content-type") ?? "application/octet-stream",
          },
          body: buf,
        });
        if (!uploadResponse.ok) throw new Error("Convex draft upload failed.");
        const uploadResult: unknown = await uploadResponse.json();
        if (!isRecord(uploadResult) || typeof uploadResult.storageId !== "string") {
          throw new Error("Convex returned an invalid draft storage ID.");
        }

        await convex.mutation(api.drafts.saveDraftFile, {
          secret,
          draftId: draftId as Id<"deliverableDrafts">,
          storageId: uploadResult.storageId as Id<"_storage">,
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