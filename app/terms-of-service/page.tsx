import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Terms of Service | E-Research Portal",
  description:
    "Review the terms for using the E-Research Portal for thesis and capstone work.",
};

const sections = [
  {
    title: "About the portal",
    paragraphs: [
      "The E-Research Portal supports academic work by helping students, advisers, instructors, and authorized administrators manage capstone teams, submissions, feedback, and related project activity.",
      "These terms apply to your use of the portal. Institutional academic rules, privacy policies, and other applicable requirements continue to apply and take precedence where they govern academic matters.",
    ],
  },
  {
    title: "Accounts and access",
    paragraphs: [
      "Provide accurate registration information and use only the account and role assigned to you. Some roles or features may require an invitation, verification, or institutional approval.",
      "Keep your sign-in credentials and verification codes secure. Do not share your account or attempt to access another person's account or information. Notify the institution through its official channels if you believe your account has been used without authorization.",
    ],
  },
  {
    title: "Acceptable use",
    paragraphs: [
      "Use the portal only for authorized academic and institutional purposes. Do not use it to violate another person's rights, upload material you are not permitted to share, bypass access controls, interfere with the service, or introduce malicious code.",
      "Respect the confidentiality of student information, unpublished research, feedback, and other materials available through the portal. Access or use information only as permitted by your role and institutional rules.",
    ],
  },
  {
    title: "Your content and academic work",
    paragraphs: [
      "You or the applicable rights holder retain rights in material you submit, subject to institutional policies and any rights held by others. By submitting material, you authorize the institution and the portal's service providers to store, process, and display it as needed to operate the portal and support the relevant academic activities.",
      "Do not submit confidential or personal information about another person unless you are authorized to do so and it is appropriate for the academic purpose. Institutional policies govern ownership, assessment, and retention of academic work and records.",
    ],
  },
  {
    title: "Third-party services and availability",
    paragraphs: [
      "The portal relies on third-party services, including Clerk for authentication and Convex for application data and backend services. Their services may be subject to their own terms and privacy practices.",
      "The portal may be changed, interrupted, or unavailable for maintenance or other reasons. The institution may update features or restrict access where needed for security, academic, or operational purposes.",
    ],
  },
  {
    title: "Suspension and termination",
    paragraphs: [
      "Access may be suspended or removed when required by institutional policy, security concerns, a change in eligibility, or misuse of the portal. Ending portal access does not remove obligations that continue under institutional rules or applicable law.",
    ],
  },
  {
    title: "Changes and contact",
    paragraphs: [
      "These terms may be updated as the portal or institutional requirements change. The current version will be posted on this page.",
      "For questions about these terms or access to the portal, contact the institution through its official administrative channels.",
    ],
  },
];

export default function TermsOfServicePage() {
  return (
    <main className="min-h-screen bg-background px-4 py-12 text-foreground sm:px-6">
      <article className="mx-auto max-w-3xl">
        <header className="mb-8">
          <Link href="/" className="text-sm text-primary hover:underline">
            E-Research Portal
          </Link>
          <h1 className="mt-4 text-3xl font-bold tracking-tight sm:text-4xl">
            Terms of Service
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Last updated: November 16, 2026
          </p>
        </header>

        <aside className="mb-8 rounded-lg border border-amber-500/40 bg-amber-500/10 p-4 text-sm leading-relaxed">
          This is a draft for institutional review, not legal advice. The
          institution should approve these terms and confirm they align with its
          academic, privacy, and acceptable-use policies before publishing them
          as final.
        </aside>

        <p className="mb-8 leading-7 text-muted-foreground">
          By accessing or using the E-Research Portal, you agree to follow these
          terms and the institutional rules that apply to your account and
          academic work.
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
          <Link href="/privacy-policy" className="text-primary hover:underline">
            Privacy Policy
          </Link>
          <Link href="/" className="text-muted-foreground hover:text-foreground">
            Back to home
          </Link>
        </nav>
      </article>
    </main>
  );
}
