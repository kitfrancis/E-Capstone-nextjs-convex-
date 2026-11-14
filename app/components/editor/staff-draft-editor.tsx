"use client";

import { useEffect, useRef, useState } from "react";
import { useConvex, useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { Loader2 } from "lucide-react";
import { forceSaveDraft } from "@/lib/onlyoffice-draft";
import OnlyOfficeEditor from "./document-editor";

type Deliverable = {
  _id: Id<"deliverables">;
  capstoneProjectId: Id<"capstoneProjects">;
  storageId?: Id<"_storage">;
  fileName: string;
  phase: string;
  version: number;
  fileSize: string;
  uploadedAt: string;
  versionLabel?: string;
  message?: string;
};

type DraftSession = {
  deliverable: Deliverable;
  draftId: Id<"deliverableDrafts">;
  storageId: Id<"_storage">;
  baseVersion: number;
  sessionRevision: number;
};

export default function StaffDraftEditor({
  deliverableId,
  capstoneProjectId,
  deliverables,
  userId,
  userName,
  onClose,
}: {
  deliverableId: Id<"deliverables">;
  capstoneProjectId: Id<"capstoneProjects">;
  deliverables?: Deliverable[];
  userId?: string;
  userName?: string;
  onClose: () => void;
}) {
  const convex = useConvex();
  const startDraft = useMutation(api.drafts.startDraft);
  const [session, setSession] = useState<DraftSession | null>(null);
  const [error, setError] = useState<string | null>(null);
  const initializedDeliverableId = useRef<Id<"deliverables"> | null>(null);
  const initialDeliverable = deliverables?.find((item) => item._id === deliverableId);
  const projectDeliverables = (deliverables ?? []).filter(
    (item) => item.capstoneProjectId === capstoneProjectId,
  );

  const openDraft = async (deliverable: Deliverable) => {
    const draft = await startDraft({ deliverableId: deliverable._id });
    setSession({
      deliverable,
      draftId: draft.draftId,
      storageId: draft.storageId,
      baseVersion: draft.baseVersion,
      sessionRevision: draft.sessionRevision,
    });
  };

  useEffect(() => {
    let cancelled = false;
    if (
      !initialDeliverable ||
      initializedDeliverableId.current === deliverableId
    ) {
      return;
    }

    void startDraft({ deliverableId })
      .then((draft) => {
        if (cancelled) return;
        initializedDeliverableId.current = deliverableId;
        setSession({
          deliverable: initialDeliverable,
          draftId: draft.draftId,
          storageId: draft.storageId,
          baseVersion: draft.baseVersion,
          sessionRevision: draft.sessionRevision,
        });
      })
      .catch((draftError) => {
        if (cancelled) return;
        setError(
          draftError instanceof Error
            ? draftError.message
            : "Couldn't open the team's active draft.",
        );
      });

    return () => {
      cancelled = true;
    };
  }, [deliverableId, initialDeliverable, startDraft]);

  const fileUrl = useQuery(
    api.dashboard.getFileUrl,
    session ? { storageId: session.storageId } : "skip",
  );

  const getCurrentDraft = (id = session?.deliverable._id ?? deliverableId) =>
    convex.query(api.drafts.getWorkingDraft, { deliverableId: id });

  const handleSelectChapter = async (phase: string, hasChanges: boolean) => {
    if (hasChanges && session) {
      await forceSaveDraft(
        `draft-${session.draftId}-${session.sessionRevision}`,
        () => getCurrentDraft(session.deliverable._id),
        session.storageId,
      );
    }
    const latest = projectDeliverables
      .filter(
        (item) =>
          item.phase === phase &&
          item.storageId,
      )
      .reduce<Deliverable | null>(
        (found, item) => (!found || item.version > found.version ? item : found),
        null,
      );
    if (!latest) throw new Error("No submitted file is available for that chapter.");
    setError(null);
    await openDraft(latest);
  };

  const handleCompareVersion = async (
    selectedDeliverableId: string,
    shouldForceSave: boolean,
    draftStorageIdAtSelection: string | null,
  ) => {
    const current = session;
    const selected = projectDeliverables.find((item) => item._id === selectedDeliverableId);
    if (!current || !selected?.storageId) {
      throw new Error("The selected version is no longer available.");
    }

    const getDraft = () => getCurrentDraft(current.deliverable._id);
    const latestDraft = shouldForceSave
      ? await forceSaveDraft(
          `draft-${current.draftId}-${current.sessionRevision}`,
          getDraft,
          draftStorageIdAtSelection ?? current.storageId,
        )
      : await getDraft();
    if (!latestDraft) throw new Error("The current draft could not be loaded.");

    const [selectedFileUrl, comparisonFileUrl] = await Promise.all([
      convex.query(api.dashboard.getFileUrl, { storageId: selected.storageId }),
      convex.query(api.dashboard.getFileUrl, { storageId: latestDraft.storageId }),
    ]);
    if (!selectedFileUrl || !comparisonFileUrl) {
      throw new Error("One of the selected manuscript files is unavailable.");
    }

    return {
      selectedDeliverableId: selected._id,
      selectedVersion: selected.version,
      selectedFileName: selected.fileName,
      selectedFileUrl,
      comparisonFileUrl,
      comparisonStorageId: latestDraft.storageId,
      comparisonFileType:
        current.deliverable.fileName.split(".").pop()?.toLowerCase() ?? "docx",
      comparisonVersion: latestDraft.baseVersion,
      comparisonIsDraft: true,
    };
  };

  const editorError =
    error ??
    (deliverables && !initialDeliverable
      ? "This submitted version is no longer available."
      : null) ??
    (session && fileUrl === null ? "The shared draft file is unavailable." : null);
  const latestForCurrentPhase = session
    ? projectDeliverables
        .filter((item) => item.phase === session.deliverable.phase && item.storageId)
        .reduce<Deliverable | null>(
          (latest, item) => (!latest || item.version > latest.version ? item : latest),
          null,
        )
    : null;
  const latestVersionAvailable =
    latestForCurrentPhase &&
    session &&
    latestForCurrentPhase.version > session.deliverable.version
      ? latestForCurrentPhase.version
      : undefined;

  if (editorError) {
    return (
      <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-4 bg-slate-950/80 px-6 text-center text-white">
        <p role="alert">{editorError}</p>
        <button
          type="button"
          onClick={onClose}
          className="rounded-md bg-white px-4 py-2 text-sm font-semibold text-slate-900"
        >
          Close Editor
        </button>
      </div>
    );
  }

  if (!deliverables || !session || typeof fileUrl !== "string") {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center gap-3 bg-slate-950/80 text-white">
        <Loader2 className="h-5 w-5 animate-spin" />
        <span>Opening the shared draft…</span>
      </div>
    );
  }

  return (
    <OnlyOfficeEditor
      key={`${session.draftId}-${session.sessionRevision}`}
      fileId={`${session.deliverable._id}-${session.draftId}`}
      deliverableId={session.deliverable._id}
      fileName={session.deliverable.fileName}
      fileUrl={fileUrl}
      phase={session.deliverable.phase}
      capstoneProjectId={capstoneProjectId}
      deliverables={projectDeliverables}
      workspaceSidebar
      mode="comment"
      userId={userId}
      userName={userName}
      docKey={`draft-${session.draftId}-${session.sessionRevision}`}
      draftId={session.draftId}
      draftSessionRevision={session.sessionRevision}
      baseVersion={session.baseVersion}
      onSelectChapter={handleSelectChapter}
      onCompareVersion={handleCompareVersion}
      latestVersionAvailable={latestVersionAvailable}
      onOpenLatestVersion={async (hasChanges) => {
        if (!session) return;
        if (hasChanges) {
          await forceSaveDraft(
            `draft-${session.draftId}-${session.sessionRevision}`,
            () => getCurrentDraft(session.deliverable._id),
            session.storageId,
          );
        }
        const freshDeliverables = await convex.query(
          api.dashboard.getDeliverables,
          { capstoneProjectId },
        );
        const latest = freshDeliverables
          .filter(
            (item) =>
              item.phase === session.deliverable.phase && item.storageId,
          )
          .reduce<Deliverable | null>(
            (found, item) =>
              !found || item.version > found.version ? item : found,
            null,
          );
        if (!latest || latest.version <= session.deliverable.version) {
          throw new Error("There is no newer submitted version to open.");
        }
        await openDraft(latest);
      }}
      onGetDraftStorageId={async () =>
        (await getCurrentDraft(session.deliverable._id))?.storageId ?? null
      }
      onClose={onClose}
    />
  );
}
