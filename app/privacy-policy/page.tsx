import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacy Policy | E-Research Portal",
  description:
    "Learn how the E-Research Portal collects, uses, shares, and retains personal information.",
};

const sections = [
  {
    title: "Information we collect",
    paragraphs: [
      "When you register, we collect the information you provide, which may include your name, email address, student number, academic program, section, and team invite code. Adviser and instructor accounts may include role and institutional profile information.",
      "When you use the portal, it may also process account activity, team and project information, uploaded capstone files, comments, reviews, notifications, and related academic records.",
    ],
  },
  {
    title: "How we use information",
    paragraphs: [
      "The portal uses information to create and secure accounts, connect students with capstone teams, manage submissions and reviews, support collaboration, maintain academic records, provide notifications, and operate and improve the service.",
      "The institution operating the portal determines the applicable lawful basis for processing under the Data Privacy Act of 2012 (Republic Act No. 10173), its implementing rules, and institutional policies. Consent is used as a lawful basis only where applicable.",
    ],
  },
  {
    title: "Access and sharing",
    paragraphs: [
      "Information is available to authorized students, advisers, instructors, and administrators who need it for academic and operational purposes. The portal uses Clerk for authentication and Convex for application data and backend services; those providers may process information needed to provide their services.",
      "We do not sell personal information. Information may be disclosed when required by law or institutional policy, or to service providers supporting the portal.",
    ],
  },
  {
    title: "Storage, security, and retention",
    paragraphs: [
      "Records are stored using systems configured for the portal. Appropriate safeguards should be applied to protect personal information, although no online service can guarantee absolute security.",
      "Information is retained only for as long as reasonably necessary for academic, operational, security, audit, or legal purposes, subject to the institution's retention policy.",
    ],
  },
  {
    title: "Your privacy rights",
    paragraphs: [
      "Subject to applicable law and institutional procedures, you may request access to or correction of your personal information, ask questions about its processing, or raise a concern about how it is handled. Some requests may be limited by legal, academic-record, or institutional requirements.",
      "For privacy requests or complaints, contact the institution's Data Protection Officer or designated privacy office through the institution's official channels.",
    ],
  },
  {
    title: "Changes to this policy",
    paragraphs: [
      "This policy may be updated when the portal or its data practices change. The institution should make the current version available through this page and communicate material changes through appropriate channels.",
    ],
  },
];

export default function PrivacyPolicyPage() {
  return (
    <main className="min-h-screen bg-background px-4 py-12 text-foreground sm:px-6">
      <article className="mx-auto max-w-3xl">
        <header className="mb-8">
          <Link href="/" className="text-sm text-primary hover:underline">
            E-Research Portal
          </Link>
          <h1 className="mt-4 text-3xl font-bold tracking-tight sm:text-4xl">
            Privacy Policy
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Last updated: November 16, 2026
          </p>
        </header>

        <aside className="mb-8 rounded-lg border border-amber-500/40 bg-amber-500/10 p-4 text-sm leading-relaxed">
          This policy is a draft based on the information shown during student
          registration. Before using it as the institution&apos;s official policy,
          have the institution&apos;s Data Protection Officer or legal adviser
          review it and confirm the applicable lawful basis, retention policy,
          service-provider arrangements, and official privacy contact.
        </aside>

        <p className="mb-8 leading-7 text-muted-foreground">
          This policy explains how the institution operating the E-Research
          Portal handles personal information when you register for or use the
          portal.
        </p>

        <div className="space-y-8">
          {sections.map((section) => (
            <section key={section.title}>
              <h2 className="text-xl font-semibold">{section.title}</h2>
              <div className="mt-3 space-y-3 leading-7 text-muted-foreground">
                {section.paragraphs.map((paragraph) => (
                  <p key={paragraph}>{paragraph}</p>
                ))}
              </div>
            </section>
          ))}
        </div>

        <nav className="mt-10 flex flex-wrap gap-x-6 gap-y-2 border-t pt-6 text-sm">
          <Link href="/terms-of-service" className="text-primary hover:underline">
            Terms of Service
          </Link>
          <Link href="/" className="text-muted-foreground hover:text-foreground">
            Back to home
          </Link>
        </nav>
      </article>
    </main>
  );
}
