import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { SignInButton, SignUpButton, UserButton } from "@clerk/nextjs";

export default async function Home() {
  const { userId } = await auth();
  const isSignedIn = !!userId;

  return (
    <main className="min-h-screen bg-black text-white">
      <section className="sticky top-0 z-30 border-b border-white/10 bg-black/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <div>
            <div className="text-2xl font-semibold tracking-tight">
              AskSocial
            </div>
            <div className="text-[11px] uppercase tracking-[0.2em] text-white/40">
              AI-powered social intelligence
            </div>
          </div>

          <div className="flex items-center gap-3">
            {!isSignedIn ? (
              <>
                <SignInButton mode="modal">
                  <button className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-white hover:bg-white/10">
                    Login
                  </button>
                </SignInButton>

                <SignUpButton mode="modal">
                  <button className="rounded-xl bg-white px-4 py-2 text-sm font-medium text-black">
                    Sign up
                  </button>
                </SignUpButton>
              </>
            ) : (
              <>
                <Link
                  href="/workspace"
                  className="rounded-xl bg-white px-4 py-2 text-sm font-medium text-black"
                >
                  Open Workspace
                </Link>
                <UserButton />
              </>
            )}
          </div>
        </div>
      </section>

      <section className="border-b border-white/10">
        <div className="mx-auto max-w-7xl px-6 py-20">
          <div className="max-w-3xl">
            <div className="inline-flex items-center rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/60">
              Report-backed intelligence + live emerging narratives
            </div>

            <h1 className="mt-6 text-5xl font-semibold leading-tight tracking-tight text-white md:text-6xl">
              Turn social data into strategic answers.
            </h1>

            <p className="mt-6 max-w-2xl text-lg leading-8 text-white/70">
              AskSocial helps teams move beyond dashboards and static reports
              by combining curated intelligence with live narrative discovery
              in one conversational experience.
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              {!isSignedIn ? (
                <SignUpButton mode="modal">
                  <button className="rounded-xl bg-white px-5 py-3 text-sm font-medium text-black">
                    Get Started
                  </button>
                </SignUpButton>
              ) : (
                <Link
                  href="/workspace"
                  className="rounded-xl bg-white px-5 py-3 text-sm font-medium text-black"
                >
                  Launch Workspace
                </Link>
              )}
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 py-16">
        <div className="grid gap-6 md:grid-cols-3">
          <FeatureCard
            title="Ask strategic questions"
            text="Understand barriers, motivations, concerns, misconceptions, and unmet needs through plain-language questions."
          />
          <FeatureCard
            title="Blend baseline and live context"
            text="Start from expert-curated report themes, then layer in what is emerging right now from live conversation."
          />
          <FeatureCard
            title="Surface narratives, not just volume"
            text="Reveal trust signals, autonomy concerns, backlash, and belief-driven themes that often hide in low-density data."
          />
        </div>
      </section>

      <section id="how-it-works" className="bg-black">
        <div className="mx-auto max-w-7xl px-6 py-16">
          <div className="max-w-2xl">
            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-white/40">
              How it works
            </div>

            <h2 className="mt-3 text-3xl font-semibold tracking-tight text-white">
              From report baseline to living intelligence
            </h2>

            <p className="mt-4 text-base leading-7 text-white/70">
              AskSocial combines curated intelligence with live narrative
              detection so teams can understand both the baseline and what is
              changing now.
            </p>
          </div>

          <div className="mt-12 grid gap-6 md:grid-cols-4">
            <StepCard
              number="01"
              title="Curate"
              text="Transform social listening reports into structured baseline themes."
            />
            <StepCard
              number="02"
              title="Detect"
              text="Analyze live conversation to surface structured topics and lower-density emerging narratives."
            />
            <StepCard
              number="03"
              title="Compare"
              text="Align live themes to baseline themes as covered, partial, or emerging."
            />
            <StepCard
              number="04"
              title="Answer"
              text="Generate a blended response that explains what is happening and why it matters."
            />
          </div>
        </div>
      </section>

      <section className="border-t border-white/10">
        <div className="mx-auto max-w-7xl px-6 py-16">
          <div className="rounded-3xl border border-white/10 bg-white/5 p-10">
            <h3 className="text-3xl font-semibold tracking-tight text-white">
              Build faster from social intelligence.
            </h3>

            <p className="mt-4 max-w-2xl text-base leading-7 text-white/70">
              AskSocial gives teams a report-backed, live-enhanced intelligence
              layer that helps them understand what people are saying, what is
              changing, and what it means.
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              {!isSignedIn ? (
                <SignUpButton mode="modal">
                  <button className="rounded-xl bg-white px-5 py-3 text-sm font-medium text-black">
                    Create Account
                  </button>
                </SignUpButton>
              ) : (
                <Link
                  href="/workspace"
                  className="rounded-xl bg-white px-5 py-3 text-sm font-medium text-black"
                >
                  Open Workspace
                </Link>
              )}
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}

function FeatureCard({ title, text }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
      <div className="text-lg font-medium text-white">{title}</div>
      <div className="mt-3 text-sm leading-6 text-white/65">{text}</div>
    </div>
  );
}

function StepCard({ number, title, text }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
      <div className="text-xs font-semibold uppercase tracking-[0.18em] text-white/40">
        {number}
      </div>
      <div className="mt-3 text-xl font-medium text-white">{title}</div>
      <div className="mt-3 text-sm leading-6 text-white/65">{text}</div>
    </div>
  );
}