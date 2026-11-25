"use client";

import { useState } from "react";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

type RegistrationRole = "student" | "adviser" | "instructor" | "coordinator";

type DataPrivacyConsentProps = {
  role: RegistrationRole;
  accepted: boolean;
  onAcceptedChange: (accepted: boolean) => void;
};

const collectedInformation: Record<RegistrationRole, string> = {
  student:
    "your name, email address, student number, program, section, and team invite code",
  adviser: "your name, email address, and adviser role information",
  instructor: "your name, email address, and instructor role information",
  coordinator:
    "your name, email address, department or organization, and reason for a research coordinator access request",
};

export function DataPrivacyConsent({
  role,
  accepted,
  onAcceptedChange,
}: DataPrivacyConsentProps) {
  const [dialogOpen, setDialogOpen] = useState(false);

  return (
    <>
      <div className="flex items-start gap-2 text-xs text-muted-foreground">
        <input
          id="data-privacy-consent"
          type="checkbox"
          checked={accepted}
          onChange={(event) => onAcceptedChange(event.target.checked)}
          required
          className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer accent-blue-600"
        />
        <span>
          <label htmlFor="data-privacy-consent" className="cursor-pointer">
            I agree to the collection and processing of my information.
          </label>{" "}
          <button
            type="button"
            className="font-medium text-primary underline underline-offset-2 hover:text-primary/80"
            onClick={() => setDialogOpen(true)}
          >
            Read the Data Privacy Notice
          </button>
        </span>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Data Privacy Notice and Consent</DialogTitle>
            <DialogDescription>
              Please review this notice before creating your E-Capstone account.
            </DialogDescription>
          </DialogHeader>

          <div className="max-h-[55vh] space-y-3 overflow-y-auto pr-2 text-xs leading-relaxed text-muted-foreground">
            <p>
              <strong className="text-foreground">Information collected.</strong>{" "}
              We collect the information you provide during registration,
              including {collectedInformation[role]}. The system may also store
              account activity, uploaded capstone files, comments, reviews, and
              related academic records.
            </p>
            <p>
              <strong className="text-foreground">Purpose and lawful basis.</strong>{" "}
              We process this information to create and secure your account,
              connect students with capstone teams, manage submissions and
              reviews, support collaboration, maintain academic records, and
              operate the E-Capstone service. Processing should be based on the
              lawful basis identified by the institution under the Data Privacy
              Act of 2012 (Republic Act No. 10173) and its implementing rules.
            </p>
            <p>
              <strong className="text-foreground">Access and sharing.</strong>{" "}
              Information is available only to authorized students, advisers,
              instructors, administrators, and service providers who need it for
              the purposes described above. We do not sell your personal
              information. Disclosures required by law or institutional policy
              may still apply.
            </p>
            <p>
              <strong className="text-foreground">Storage and retention.</strong>{" "}
              Records are stored using the systems configured by the institution
              and retained only as long as reasonably necessary for academic,
              operational, security, audit, or legal purposes, subject to the
              institution&apos;s retention policy.
            </p>
            <p>
              <strong className="text-foreground">Your rights.</strong>{" "}
              Subject to applicable law and institutional procedures, you may
              request access to, correction of, or information about the
              processing of your personal data, and may raise concerns about its
              handling. Contact the institution&apos;s Data Protection Officer
              or designated privacy office for requests and complaints.
            </p>
            <p>
              By selecting{" "}
              <strong className="text-foreground">I Understand and Agree</strong>,
              or by ticking the consent checkbox, you confirm that you have read
              this notice and consent to the processing described above, to the
              extent consent is the applicable lawful basis.
            </p>
          </div>

          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline">
                Close
              </Button>
            </DialogClose>
            <Button
              type="button"
              onClick={() => {
                onAcceptedChange(true);
                setDialogOpen(false);
              }}
            >
              I Understand and Agree
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}