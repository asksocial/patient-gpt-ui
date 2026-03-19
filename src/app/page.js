import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { SignInButton, SignUpButton, UserButton } from "@clerk/nextjs";

export default async function Home() {
  const { userId } = await auth();
  const isSignedIn = !!userId;

  return (
    <main className="min-h-screen bg-black text-white">
      <section className="border-b border-white/10">
        <div className="mx-auto max-w-6xl px-6 py-6 flex items-center justify-between">
          <div className="text-2xl font-semibold tracking-tight">
            AskSocial
          </div>

          <div className="flex items-center gap-3">
            {!isSignedIn ? (
              <>
                <SignInButton mode="modal">
                  <button className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 font-medium hover:bg-white/10">
                    Login
                  </button>
                </SignInButton>

                <SignUpButton mode="modal">
                  <button className="rounded-xl bg-white text-black px-4 py-2 font-medium">
                    Sign up
                  </button>
                </SignUpButton>
              </>
            ) : (
              <>
                <Link
                  href="/workspace"
                  className="rounded-xl bg-white text-black px-4 py-2 font-medium"
                >
                  Open Workspace
                </Link>
                <UserButton />
              </>
            )}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-20">
        <div className="max-w-3xl">
          <div className="inline-flex items-center rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/60">
            AI-powered patient social intelligence
          </div>

          <h1 className="mt-6 text-5xl font-semibold leading-tight tracking-tight">
            Turn patient conversations into actionable intelligence.
          </h1>

          <p className="mt-6 text-lg leading-8 text-white/70">
            AskSocial helps pharma and biotech teams interrogate social listening
            insights through natural language. Understand barriers, emotions,
            misconceptions, and real patient voices—instantly.
          </p>

          <div className="mt-8 flex gap-3">
            {!isSignedIn ? (
              <SignUpButton mode="modal">
                <button className="rounded-xl bg-white text-black px-5 py-3 font-medium">
                  Get Started
                </button>
              </SignUpButton>
            ) : (
              <Link
                href="/workspace"
                className="rounded-xl bg-white text-black px-5 py-3 font-medium"
              >
                Launch AskSocial
              </Link>
            )}

            <a
              href="#how-it-works"
              className="rounded-xl border border-white/10 bg-white/5 px-5 py-3 font-medium hover:bg-white/10"
            >
              How it works
            </a>
          </div>
        </div>

        <div className="mt-16 grid gap-6 md:grid-cols-3">
          <FeatureCard
            title="Ask strategic questions"
            text="Identify barriers to treatment, patient concerns, emotional drivers, and unmet needs instantly."
          />
          <FeatureCard
            title="Grounded in real evidence"
            text="Every answer is backed by curated insights and representative patient voices."
          />
          <FeatureCard
            title="Built for pharma teams"
            text="Organize intelligence by therapeutic area and scale across brands and portfolios."
          />
        </div>
      </section>

      <section
        id="how-it-works"
        className="border-t border-white/10 bg-white/[0.02]"
      >
        <div className="mx-auto max-w-6xl px-6 py-20">
          <div className="max-w-2xl">
            <div className="text-sm uppercase tracking-wide text-white/50">
              How it works
            </div>

            <h2 className="mt-3 text-3xl font-semibold tracking-tight">
              From reports to intelligence in seconds
            </h2>

            <p className="mt-4 text-white/70 leading-7">
              AskSocial transforms curated social listening reports into a
              searchable intelligence layer. Ask questions and receive grounded,
              source-backed answers instantly.
            </p>
          </div>

          <div className="mt-12 grid gap-6 md:grid-cols-3">
            <StepCard
              number="01"
              title="Ingest"
              text="Upload reports and convert them into structured, searchable intelligence."
            />
            <StepCard
              number="02"
              title="Retrieve"
              text="AI finds the most relevant insights, voices, and recommendations."
            />
            <StepCard
              number="03"
              title="Answer"
              text="Get clear, evidence-backed answers to complex strategic questions."
            />
          </div>
        </div>
      </section>

      <section className="border-t border-white/10">
        <div className="mx-auto max-w-6xl px-6 py-20">
          <div className="rounded-3xl border border-white/10 bg-white/5 p-10">
            <h3 className="text-3xl font-semibold tracking-tight">
              Start exploring patient intelligence with AskSocial.
            </h3>

            <p className="mt-4 text-white/70">
              Launch the workspace to query your data, uncover insights, and
              explore patient voices.
            </p>

            <div className="mt-8">
              {!isSignedIn ? (
                <SignUpButton mode="modal">
                  <button className="rounded-xl bg-white text-black px-5 py-3 font-medium">
                    Create Account
                  </button>
                </SignUpButton>
              ) : (
                <Link
                  href="/workspace"
                  className="rounded-xl bg-white text-black px-5 py-3 font-medium"
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
      <div className="text-lg font-medium">{title}</div>
      <div className="mt-3 text-sm text-white/65">{text}</div>
    </div>
  );
}

function StepCard({ number, title, text }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/40 p-6">
      <div className="text-xs text-white/40">{number}</div>
      <div className="mt-3 text-xl font-medium">{title}</div>
      <div className="mt-3 text-sm text-white/65">{text}</div>
    </div>
  );
}