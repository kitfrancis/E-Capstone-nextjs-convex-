"use client";

import { useUser, useClerk } from "@clerk/nextjs";
import { useQuery, useMutation, useConvexAuth } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { getConvexErrorMessage } from "@/lib/convex-errors";
import { DataPrivacyConsent } from "@/components/data-privacy-consent";
import { Button } from "@/components/ui/button";
import {
  PRIVACY_CONSENT_SESSION_KEY,
  PRIVACY_NOTICE_VERSION,
} from "@/lib/privacy-consent";
import { dashboardRouteForRole } from "@/lib/dashboard-routes";

const ROLES = ["student", "instructor", "adviser", "coordinator", "admin"] as const;
type Role = (typeof ROLES)[number];

type Outcome = "pending" | "ok" | "denied";

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/* ---------- E-Research logo intro screen ---------- */

const BRAND = "E-Research";
const LOGO_SRC = "/CCISnewlogo.jpg"; // put the file in /public

const LOGO_CSS = `
.vl{--vl-bg:#f6f5fb;--vl-fg:#0f1020;--vl-muted:#5b5d72;--vl-line:#e2dff0;
  --vl-navy:#2b2f86;--vl-red:#c8282d;--vl-ok:#16a34a;--vl-bad:#dc2626;--vl-glow:rgba(43,47,134,.25);
  min-height:100vh;display:flex;align-items:center;justify-content:center;background:var(--vl-bg);color:var(--vl-fg);position:relative;overflow:hidden}
.dark .vl{--vl-bg:#0c0b14;--vl-fg:#f4f3fb;--vl-muted:#a3a1ba;--vl-line:#2a2840;
  --vl-navy:#8e94ff;--vl-ok:#4ade80;--vl-bad:#f87171;--vl-glow:rgba(142,148,255,.28)}
.vl::before{content:"";position:absolute;inset:0;pointer-events:none;background:radial-gradient(50% 36% at 50% 42%,var(--vl-glow),transparent 70%)}
.vl-main{position:relative;display:flex;flex-direction:column;align-items:center;text-align:center;padding:0 20px}
.vl-mark{position:relative;width:180px;height:180px;display:grid;place-items:center}
.vl-halo{position:absolute;inset:-10px;border-radius:50%;background:var(--vl-glow);filter:blur(26px);opacity:0}
.vl-orbit{position:absolute;inset:0;width:100%;height:100%;transform:rotate(-90deg);opacity:0}
.vl-track{fill:none;stroke:var(--vl-line);stroke-width:1.5}
.vl-arc{fill:none;stroke:var(--vl-navy);stroke-width:2.5;stroke-linecap:round;stroke-dasharray:60 260;
  transform-origin:50% 50%;transition:stroke-dasharray .6s ease,stroke .4s}
.vl-disc{position:relative;width:144px;height:144px;border-radius:50%;background:#fff;overflow:hidden;
  box-shadow:0 8px 30px rgba(20,20,60,.18);clip-path:circle(0%);transform:scale(.85);filter:blur(6px)}
.vl-disc img{position:absolute;left:50%;top:50%;width:122%;height:auto;max-width:none;transform:translate(-50%,-50%);display:block}
.vl-disc::after{content:"";position:absolute;top:-20%;bottom:-20%;width:35%;left:-60%;transform:skewX(-20deg);
  background:linear-gradient(90deg,transparent,rgba(255,255,255,.75),transparent);opacity:0}
.vl-word{margin-top:26px;font-size:36px;font-weight:800;letter-spacing:-.03em;display:flex;line-height:1.1;overflow:hidden;padding-bottom:4px}
.vl-word span{display:inline-block;transform:translateY(110%);opacity:0}
.vl-word .vl-dash{color:var(--vl-red)}
.vl-tag{margin-top:6px;font-size:14px;color:var(--vl-muted);opacity:0;min-height:21px;transition:color .3s}
.vl-line{margin-top:24px;width:132px;height:3px;border-radius:3px;background:var(--vl-line);overflow:hidden;opacity:0}
.vl-line i{display:block;height:100%;width:42%;border-radius:3px;background:linear-gradient(90deg,var(--vl-navy),var(--vl-red));animation:vl-slide 1.2s ease-in-out infinite}

/* intro sequence */
.vl-disc{animation:vl-reveal 1s cubic-bezier(.2,.8,.2,1) .15s forwards}
.vl-orbit{animation:vl-fade .5s .5s forwards}
.vl-arc{animation:vl-spin 1.6s linear 1s infinite}
.vl-halo{animation:vl-halo 2.4s .8s ease-in-out infinite}
.vl-disc::after{animation:vl-shine 1s 1.2s ease forwards}
.vl-word span{animation:vl-rise .55s cubic-bezier(.2,.8,.2,1) forwards;animation-delay:calc(1.3s + var(--i)*55ms)}
.vl-tag{animation:vl-fade .5s 2s forwards}
.vl-line{animation:vl-fade .5s 2.1s forwards}

/* results */
.vl-ok .vl-disc,.vl-denied .vl-disc{animation:none;clip-path:circle(50%);transform:none;filter:none}
.vl-ok .vl-orbit,.vl-denied .vl-orbit{animation:none;opacity:1}
.vl-ok .vl-arc,.vl-denied .vl-arc{animation:none;stroke-dasharray:260 0}
.vl-ok .vl-arc{stroke:var(--vl-ok)}
.vl-ok .vl-halo{background:rgba(22,163,74,.35)}
.vl-ok .vl-line i,.vl-denied .vl-line i{animation:none;width:100%;transition:width .6s;background:var(--vl-ok)}
.vl-denied .vl-arc{stroke:var(--vl-bad)}
.vl-denied .vl-halo{background:rgba(220,38,38,.3)}
.vl-denied .vl-tag{color:var(--vl-bad)}
.vl-denied .vl-line i{background:var(--vl-bad)}
.vl-denied .vl-mark{animation:vl-shake .5s}

@keyframes vl-reveal{to{clip-path:circle(50%);transform:none;filter:none}}
@keyframes vl-halo{0%,100%{opacity:.35;transform:scale(.95)}50%{opacity:.9;transform:scale(1.08)}}
@keyframes vl-shine{0%{left:-60%;opacity:1}100%{left:130%;opacity:1}}
@keyframes vl-spin{to{transform:rotate(360deg)}}
@keyframes vl-rise{to{transform:none;opacity:1}}
@keyframes vl-fade{to{opacity:1}}
@keyframes vl-slide{0%{transform:translateX(-110%)}100%{transform:translateX(260%)}}
@keyframes vl-shake{20%{transform:translateX(-6px)}40%{transform:translateX(6px)}60%{transform:translateX(-4px)}80%{transform:translateX(4px)}}
@media (max-width:480px){.vl-word{font-size:30px}}
@media (prefers-reduced-motion:reduce){.vl *,.vl *::before,.vl *::after{animation-duration:.01ms!important;animation-delay:0s!important;animation-iteration-count:1!important;transition-duration:.01ms!important}}
`;

function LogoScreen({ outcome }: { outcome: Outcome }) {
  // Replay the intro every few seconds while we're still verifying.
  const [cycle, setCycle] = useState(0);
  useEffect(() => {
    if (outcome !== "pending") return;
    const t = setInterval(() => setCycle((c) => c + 1), 5600);
    return () => clearInterval(t);
  }, [outcome]);

  const text =
    outcome === "ok"
      ? "You’re verified"
      : outcome === "denied"
        ? "Role doesn’t match"
        : "Verifying your role…";

  return (
    <div className={`vl ${outcome === "pending" ? "" : `vl-${outcome}`}`}>
      <style>{LOGO_CSS}</style>
      <main
        key={outcome === "pending" ? cycle : "done"}
        className="vl-main"
        aria-live="polite"
      >
        <div className="vl-mark">
          <div className="vl-halo" />
          <svg className="vl-orbit" viewBox="0 0 104 104" aria-hidden="true">
            <circle className="vl-track" cx="52" cy="52" r="50" />
            <circle className="vl-arc" cx="52" cy="52" r="50" />
          </svg>
          <div className="vl-disc">
            <img
              src={LOGO_SRC}
              alt="College of Computing and Information Sciences, University of Antique"
            />
          </div>
        </div>

        <div className="vl-word" aria-label={BRAND}>
          {BRAND.split("").map((ch, i) => (
            <span
              key={i}
              className={ch === "-" ? "vl-dash" : undefined}
              style={{ "--i": i } as React.CSSProperties}
            >
              {ch}
            </span>
          ))}
        </div>
        <p className="vl-tag">{text}</p>
        <div className="vl-line">
          <i />
        </div>
      </main>
    </div>
  );
}

/* ---------- Page ---------- */

export default function AuthCallback() {
  const { user, isLoaded } = useUser();
  const { signOut } = useClerk();
  const { isAuthenticated, isLoading } = useConvexAuth();

  const me = useQuery(api.users.getMe, isAuthenticated ? {} : "skip");

  const registerStaff = useMutation(api.users.registerStaff);
  const syncMe = useMutation(api.users.syncMe);

  const router = useRouter();
  const handled = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [registrationRole, setRegistrationRole] = useState<
    "instructor" | "adviser" | "coordinator" | null
  >(null);
  const [privacyAccepted, setPrivacyAccepted] = useState(false);
  const [outcome, setOutcome] = useState<Outcome>("pending");

  useEffect(() => {
    if (!isLoaded || !user || isLoading || !isAuthenticated) return;
    if (me === undefined) return;
    if (handled.current) return;

    // Show the result briefly so the animation state is visible
    // before we navigate away.
    const settle = async (kind: "ok" | "denied") => {
      setOutcome(kind);
      await sleep(kind === "ok" ? 700 : 900);
    };

    // Validate instead of casting: sessionStorage can hold anything.
    const raw = sessionStorage.getItem("intendedRole");
    const intendedRole: Role | null = ROLES.find((r) => r === raw) ?? null;

    // Signed in with Clerk (for example Google) but there is no E-Research
    // account for them. Sign out and explain, instead of leaving a half-signed-in
    // session. A leftover Clerk user is harmless: the roster import reuses it.
    const noAccount = async (role?: Role) => {
      await settle("denied");
      const email = user.primaryEmailAddress?.emailAddress ?? "";
      const params = new URLSearchParams({ email });
      if (role === "coordinator") params.set("role", role);
      await signOut(() =>
        router.replace(`/no-account?${params.toString()}`)
      );
    };

    // Where a registered user belongs.
    const destinationFor = (u: NonNullable<typeof me>) =>
      u.mustChangePassword
        ? "/change-password"
        : u.status === "pending"
          ? "/pending-approval"
          : dashboardRouteForRole(u.role);

    if (!intendedRole) {
      handled.current = true;
      if (me) {
        const target = destinationFor(me);
        void (async () => {
          await settle("ok");
          router.replace(target);
        })();
        return;
      }
      void noAccount();
      return;
    }

    handled.current = true;

    const handle = async () => {
      // Admin is assigned by the system owner, never self-registered.
      if (intendedRole === "admin") {
        sessionStorage.removeItem("intendedRole");

        if (!me) {
          await settle("denied");
          await signOut(() => router.replace("/unauthorized"));
          return;
        }
        if (me.role !== intendedRole) {
          await settle("denied");
          router.replace("/unauthorized");
          return;
        }
        if (me.status === "rejected") {
          await settle("denied");
          await signOut(() => router.replace("/unauthorized"));
          return;
        }
        await settle("ok");
        router.replace(destinationFor(me));
        return;
      }

      // ---------- NEW USER ----------
      if (!me) {
        // Students never register themselves: their account comes from the
        // instructor's roster import.
        if (intendedRole === "student") {
          sessionStorage.removeItem("intendedRole");
          await noAccount();
          return;
        }

        // Coordinators and instructors await admin approval; advisers await instructor verification.
        const privacyConsentVersion = sessionStorage.getItem(
          PRIVACY_CONSENT_SESSION_KEY
        );
        if (privacyConsentVersion !== PRIVACY_NOTICE_VERSION) {
          setRegistrationRole(intendedRole);
          return;
        }

        try {
          await registerStaff({
            name: user.fullName ?? "Unknown",
            email: user.primaryEmailAddress?.emailAddress ?? "",
            role: intendedRole,
            ...(intendedRole === "coordinator"
              ? {
                  coordinatorOrganization:
                    sessionStorage.getItem("coordinatorOrganization") ?? "",
                  coordinatorReason:
                    sessionStorage.getItem("coordinatorReason") ?? "",
                }
              : {}),
            privacyConsentVersion,
          });
        } catch (err) {
          console.error("registerStaff failed:", err);
          setError(
            getConvexErrorMessage(
              err,
              "We couldn't finish setting up your account."
            )
          );
          handled.current = false;
          return; // keep intendedRole so a retry still works
        }

        sessionStorage.removeItem("intendedRole");
        sessionStorage.removeItem(PRIVACY_CONSENT_SESSION_KEY);
        sessionStorage.removeItem("coordinatorOrganization");
        sessionStorage.removeItem("coordinatorReason");
        await settle("ok");
        router.replace("/pending-approval");
        return;
      }

      // ---------- EXISTING USER ----------
      sessionStorage.removeItem("intendedRole");

      // Keep email/image in step with Clerk (server uses the verified identity).
      try {
        await syncMe({ image: user.imageUrl });
      } catch (err) {
        console.error("syncMe failed:", err);
      }

      if (me.role !== intendedRole) {
        await settle("denied");
        router.replace("/unauthorized");
        return;
      }

      if (me.status === "rejected") {
        await settle("denied");
        await signOut(() => router.replace("/unauthorized"));
        return;
      }

      await settle("ok");
      router.replace(destinationFor(me));
    };

    handle();
  }, [
    isLoaded,
    user,
    isLoading,
    isAuthenticated,
    me,
    router,
    registerStaff,
    syncMe,
    signOut,
    attempt,
  ]);

  if (registrationRole) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100 px-4 py-8">
        <div className="w-full max-w-md space-y-4 rounded-lg bg-background p-6 shadow">
          <div className="space-y-2 text-center">
            <h1 className="text-lg font-semibold">Finish account setup</h1>
            <p className="text-sm text-muted-foreground">
              Review and accept the privacy notice to create your{" "}
              {registrationRole} account. It will be pending{" "}
              {registrationRole === "adviser" ? "instructor" : "admin"} approval.
            </p>
          </div>
          <DataPrivacyConsent
            role={registrationRole}
            accepted={privacyAccepted}
            onAcceptedChange={setPrivacyAccepted}
          />
          <Button
            className="w-full"
            disabled={!privacyAccepted}
            onClick={() => {
              sessionStorage.setItem(
                PRIVACY_CONSENT_SESSION_KEY,
                PRIVACY_NOTICE_VERSION
              );
              setRegistrationRole(null);
              handled.current = false;
              setAttempt((n) => n + 1);
            }}
          >
            Continue
          </Button>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="text-center">
          <p className="text-red-600 font-medium">{error}</p>
          <button
            className="mt-4 rounded bg-blue-600 px-4 py-2 text-white"
            onClick={() => {
              setError(null);
              setAttempt((n) => n + 1);
            }}
          >
            Try again
          </button>
        </div>
      </div>
    );
  }

  return <LogoScreen outcome={outcome} />;
}