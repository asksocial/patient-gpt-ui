import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { SignInButton, SignUpButton, UserButton } from "@clerk/nextjs";

const FEATURES = [
  {
    icon: "conversation",
    tone: "mint",
    title: "Ask strategic questions",
    text: "Understand barriers, motivations, concerns, misconceptions, and unmet needs through plain-language questions.",
  },
  {
    icon: "layers",
    tone: "blue",
    title: "Blend baseline and live context",
    text: "Start from expert-curated report themes, then layer in what is emerging right now from social conversation.",
  },
  {
    icon: "spark",
    tone: "gold",
    title: "Surface narratives, not just volume",
    text: "Reveal trust signals, autonomy concerns, backlash, and belief-driven themes that often hide in low-density data.",
  },
];

const STEPS = [
  ["01", "Curate", "Transform social listening reports into structured baseline themes."],
  ["02", "Detect", "Analyze social conversation to surface structured topics and lower-density emerging narratives."],
  ["03", "Compare", "Align social themes to baseline themes as covered, partial, or emerging."],
  ["04", "Answer", "Generate a blended response that explains what is happening and why it matters."],
];

export default async function Home() {
  const { userId } = await auth();
  const isSignedIn = Boolean(userId);

  return (
    <main className="min-h-screen bg-[#edf3f0] text-[#0c2923]">
      <header className="mx-auto flex w-full max-w-[1480px] items-center justify-between gap-5 px-5 py-6 sm:px-8 lg:px-10">
        <LandingWordmark />
        <div className="flex shrink-0 items-center rounded-full bg-white p-1.5 shadow-[0_8px_26px_rgba(12,41,35,0.05)]">
          {!isSignedIn ? (
            <>
              <SignInButton mode="modal">
                <button className="rounded-full px-5 py-2.5 text-sm font-semibold text-[#405a53] transition hover:bg-[#f2f6f4] hover:text-[#0c2923] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0c7a69]/30">
                  Login
                </button>
              </SignInButton>
              <SignUpButton mode="modal">
                <button className="rounded-full bg-[#0c7a69] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#086657] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0c7a69]/30">
                  Sign up
                </button>
              </SignUpButton>
            </>
          ) : (
            <>
              <Link href="/workspace" className="rounded-full bg-[#0c7a69] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#086657] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0c7a69]/30">
                Open Workspace
              </Link>
              <div className="ml-2 flex items-center pr-1"><UserButton /></div>
            </>
          )}
        </div>
      </header>

      <div className="mx-auto w-full max-w-[1480px] space-y-6 px-5 pb-12 sm:px-8 lg:px-10 lg:pb-16">
        <section className="overflow-hidden rounded-[2rem] bg-white px-6 py-12 shadow-[0_1px_2px_rgba(12,41,35,0.03),0_18px_50px_rgba(12,41,35,0.04)] sm:px-10 lg:px-16 lg:py-16">
          <div className="grid items-center gap-12 xl:grid-cols-[1.05fr_0.95fr] xl:gap-20">
            <div className="max-w-3xl">
              <div className="inline-flex items-center rounded-full bg-[#e2f3ee] px-4 py-2 text-xs font-semibold text-[#0c7a69] sm:text-sm">
                Report-backed intelligence + live emerging narratives
              </div>
              <h1 className="mt-8 max-w-[760px] text-[clamp(3.4rem,6.2vw,6.9rem)] font-semibold leading-[0.91] tracking-[-0.065em] text-[#0b2822]">
                Turn social data into strategic answers.
              </h1>
              <p className="mt-8 max-w-2xl text-lg leading-8 text-[#536a63] sm:text-xl">
                AskSocial helps teams move beyond dashboards and static reports
                by combining curated intelligence with live narrative discovery
                in one conversational experience.
              </p>
              <div className="mt-8">
                {!isSignedIn ? (
                  <SignUpButton mode="modal">
                    <button className="inline-flex items-center gap-4 rounded-full bg-[#0c7a69] px-6 py-3.5 text-base font-semibold text-white transition hover:bg-[#086657] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0c7a69]/30">
                      <span className="inline-flex items-center gap-4">Get Started <span aria-hidden="true">→</span></span>
                    </button>
                  </SignUpButton>
                ) : (
                  <Link href="/workspace" className="inline-flex items-center gap-4 rounded-full bg-[#0c7a69] px-6 py-3.5 text-base font-semibold text-white transition hover:bg-[#086657] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0c7a69]/30">
                    Launch Workspace <span aria-hidden="true">→</span>
                  </Link>
                )}
              </div>
            </div>
            <IntelligencePreview />
          </div>
        </section>

        <section aria-label="AskSocial capabilities" className="grid gap-5 md:grid-cols-3">
          {FEATURES.map((feature) => <FeatureCard key={feature.title} {...feature} />)}
        </section>

        <section id="how-it-works" className="rounded-[2rem] bg-white px-6 py-12 shadow-[0_1px_2px_rgba(12,41,35,0.03),0_18px_50px_rgba(12,41,35,0.04)] sm:px-10 lg:px-14 lg:py-14">
          <div className="grid gap-10 lg:grid-cols-[0.7fr_1.3fr] lg:items-end">
            <div className="max-w-xl">
              <div className="text-xs font-semibold uppercase tracking-[0.18em] text-[#0c7a69]">How it works</div>
              <h2 className="mt-4 text-4xl font-semibold leading-tight tracking-[-0.04em] text-[#0b2822] sm:text-5xl">From report baseline to living intelligence</h2>
              <p className="mt-5 text-base leading-7 text-[#536a63]">
                AskSocial combines curated intelligence with social narrative
                detection so teams can understand both the baseline and what is changing now.
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {STEPS.map(([number, title, text]) => <StepCard key={number} number={number} title={title} text={text} />)}
            </div>
          </div>
        </section>

        <section className="rounded-[2rem] bg-[#0b2822] px-6 py-12 text-white sm:px-10 lg:flex lg:items-end lg:justify-between lg:gap-10 lg:px-14 lg:py-14">
          <div className="max-w-3xl">
            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-[#83dfcf]">Intelligence for decisions</div>
            <h2 className="mt-4 text-4xl font-semibold tracking-[-0.04em] sm:text-5xl">Build faster from social intelligence.</h2>
            <p className="mt-5 max-w-2xl text-base leading-7 text-white/65">
              AskSocial gives teams a report-backed, social-enhanced intelligence
              layer that helps them understand what people are saying, what is changing, and what it means.
            </p>
          </div>
          <div className="mt-8 shrink-0 lg:mt-0">
            {!isSignedIn ? (
              <SignUpButton mode="modal">
                <button className="rounded-full bg-white px-6 py-3.5 text-sm font-semibold text-[#0b2822] transition hover:bg-[#edf3f0] focus:outline-none focus-visible:ring-2 focus-visible:ring-white/50">Create Account</button>
              </SignUpButton>
            ) : (
              <Link href="/workspace" className="inline-flex rounded-full bg-white px-6 py-3.5 text-sm font-semibold text-[#0b2822] transition hover:bg-[#edf3f0] focus:outline-none focus-visible:ring-2 focus-visible:ring-white/50">Open Workspace</Link>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}

function LandingWordmark() {
  return (
    <div className="flex min-w-0 items-center gap-3" aria-label="AskSocial, AI-powered social intelligence">
      <svg aria-hidden="true" viewBox="0 0 54 36" className="h-9 w-[54px] shrink-0">
        <path fill="#0b2822" d="M0 0h31v25H13L0 36V0Z" />
        <path fill="#39bba5" d="M35 6h19v25H35z" />
      </svg>
      <div className="min-w-0">
        <div className="flex items-baseline text-[1.75rem] leading-none tracking-[-0.06em] text-[#0b2822]">
          <span className="font-normal">Ask</span><strong className="font-bold">Social</strong>
        </div>
        <div className="mt-1 truncate text-xs font-medium text-[#63766f] sm:text-sm">AI-powered social intelligence</div>
      </div>
    </div>
  );
}

function IntelligencePreview() {
  const insights = [
    ["Trust", "Safety signals", "mint"],
    ["Autonomy", "Choice & control", "blue"],
    ["Backlash", "Cost concerns", "rose"],
    ["Emerging", "New use cases", "gold"],
  ];
  const tones = {
    mint: "bg-[#dff3ec] text-[#16715f]",
    blue: "bg-[#e3eef9] text-[#315f87]",
    rose: "bg-[#fae3dc] text-[#a1433d]",
    gold: "bg-[#fff0d2] text-[#865b08]",
  };

  return (
    <div className="mx-auto w-full max-w-[650px] rounded-[2rem] bg-[#0b2822] p-5 shadow-[0_24px_70px_rgba(12,41,35,0.14)] sm:p-7">
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-white/55"><span aria-hidden="true" className="text-[#83dfcf]">✦</span>Ask</div>
      <div className="mt-5 rounded-2xl bg-[#f4f0e6] px-5 py-5 text-lg font-semibold leading-7 text-[#0b2822] sm:text-xl">What themes are driving confusion or concern?</div>
      <div className="mt-4 grid gap-3 rounded-2xl bg-[#edf3f0] p-4 sm:grid-cols-2">
        {insights.map(([label, title, tone]) => (
          <div key={label} className="rounded-2xl bg-white p-4">
            <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold ${tones[tone]}`}>{label}</span>
            <p className="mt-3 text-base font-semibold text-[#0b2822]">{title}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function FeatureCard({ icon, tone, title, text }) {
  const iconTone = {
    mint: "bg-[#dff3ec] text-[#0c7a69]",
    blue: "bg-[#e3eef9] text-[#315f87]",
    gold: "bg-[#fff0d2] text-[#865b08]",
  }[tone];

  return (
    <article className="rounded-[1.75rem] bg-white p-7 shadow-[0_1px_2px_rgba(12,41,35,0.03),0_14px_38px_rgba(12,41,35,0.035)] sm:p-8">
      <span className={`inline-flex h-12 w-12 items-center justify-center rounded-2xl ${iconTone}`}><FeatureIcon name={icon} /></span>
      <h2 className="mt-6 text-2xl font-semibold tracking-[-0.035em] text-[#0b2822]">{title}</h2>
      <p className="mt-4 text-base leading-7 text-[#536a63]">{text}</p>
    </article>
  );
}

function FeatureIcon({ name }) {
  const paths = {
    conversation: <><path d="M5 6.5h14v10H10l-5 4v-14Z" /><path d="M9 10h6M9 13h4" /></>,
    layers: <><path d="m4 9 8-4 8 4-8 4-8-4Z" /><path d="m4 13 8 4 8-4M4 17l8 4 8-4" /></>,
    spark: <><path d="M12 3c.8 4.3 2.7 6.2 7 7-4.3.8-6.2 2.7-7 7-.8-4.3-2.7-6.2-7-7 4.3-.8 6.2-2.7 7-7Z" /><path d="M19 4v4M21 6h-4" /></>,
  };
  return <svg aria-hidden="true" viewBox="0 0 24 24" className="h-6 w-6 fill-none stroke-current" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{paths[name]}</svg>;
}

function StepCard({ number, title, text }) {
  return (
    <article className="rounded-2xl bg-[#f6f9f7] p-5">
      <div className="text-xs font-semibold uppercase tracking-[0.18em] text-[#0c7a69]">{number}</div>
      <h3 className="mt-3 text-xl font-semibold text-[#0b2822]">{title}</h3>
      <p className="mt-3 text-sm leading-6 text-[#536a63]">{text}</p>
    </article>
  );
}
