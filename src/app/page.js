import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { SignInButton, SignUpButton, UserButton } from "@clerk/nextjs";

export const metadata = {
  title: "AskSocial | AI-powered audience intelligence",
  description: "Ask the internet. Understand the people behind it. Explore conversations, experiences, and emerging narratives across the open web through evidence-backed answers.",
};

const FEATURES = [
  {
    icon: "conversation",
    tone: "mint",
    title: "Ask naturally",
    text: "Ask the questions you actually want answered—in plain language, with room to follow your curiosity.",
  },
  {
    icon: "layers",
    tone: "blue",
    title: "Search beyond social",
    text: "Discover relevant signals across social platforms, forums, communities, news, blogs, video comments, advocacy sites, and other open-web sources.",
  },
  {
    icon: "spark",
    tone: "gold",
    title: "Find what dashboards miss",
    text: "Surface emerging narratives, lived experiences, barriers, motivations, misconceptions, and unmet needs—even when conversation volume is small.",
  },
  {
    icon: "compass",
    tone: "mint",
    title: "Understand what it means",
    text: "Move beyond mentions, sentiment, and volume to understand the human context behind the conversation—and its implications for your organization.",
  },
];

const STEPS = [
  ["01", "Discover", "Find relevant conversations and evidence across social platforms, communities, forums, news, blogs, video comments, and the broader open web."],
  ["02", "Understand", "Use AI to identify themes, experiences, motivations, barriers, concerns, sentiment, and emerging narratives within the conversation."],
  ["03", "Explore", "Ask follow-up questions in natural language to investigate audiences, compare perspectives, uncover evidence, and understand what is changing."],
  ["04", "Act", "Translate what people are saying into implications, opportunities, and decisions for your organization."],
];

const TIME_HORIZONS = [
  ["Historical", "What have patients historically struggled with?", "Explore recurring barriers, experiences, and unmet needs over time."],
  ["Current", "What are they saying now?", "Understand the questions, concerns, and perspectives shaping conversation today."],
  ["Emerging", "What new narrative appears to be emerging?", "Investigate early signals and changing beliefs before they become dominant themes."],
];

export default async function Home() {
  const { userId } = await auth();
  const isSignedIn = Boolean(userId);

  return (
    <main className="min-h-screen bg-[#edf3f0] text-[#0c2923]">
      <header className="mx-auto flex w-full max-w-[1480px] items-center justify-between gap-3 px-5 py-6 sm:px-8 lg:px-10">
        <LandingWordmark />
        <div className="flex shrink-0 items-center rounded-full bg-white p-1.5 shadow-[0_8px_26px_rgba(12,41,35,0.05)]">
          {!isSignedIn ? (
            <>
              <SignInButton mode="modal">
                <button className="rounded-full px-3 py-2.5 sm:px-5 text-sm font-semibold text-[#405a53] transition hover:bg-[#f2f6f4] hover:text-[#0c2923] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0c7a69]/30">
                  Login
                </button>
              </SignInButton>
              <SignUpButton mode="modal">
                <button className="rounded-full bg-[#0c7a69] px-3 py-2.5 sm:px-5 text-sm font-semibold text-white transition hover:bg-[#086657] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0c7a69]/30">
                  Sign up
                </button>
              </SignUpButton>
            </>
          ) : (
            <>
              <Link href="/workspace" className="rounded-full bg-[#0c7a69] px-3 py-2.5 sm:px-5 text-sm font-semibold text-white transition hover:bg-[#086657] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0c7a69]/30">
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
                AI-powered audience intelligence
              </div>
              <h1 className="mt-8 max-w-[760px] text-[clamp(2.75rem,5.2vw,5.75rem)] font-semibold leading-[1.02] tracking-[-0.065em] text-[#0b2822]">
                Understand what people are really saying—and why it matters.
              </h1>
              <p className="mt-8 max-w-2xl text-lg leading-8 text-[#536a63] sm:text-xl">
                AskSocial uses AI to discover and interpret relevant conversations,
                experiences, questions, concerns, and emerging narratives from
                across the open web.
              </p>
              <p className="mt-4 max-w-2xl text-base leading-7 text-[#536a63]">
                Ask questions in plain language. Uncover the human signals buried
                beneath the noise. Turn them into intelligence you can act on.
              </p>
              <p className="mt-6 text-base font-semibold text-[#0c7a69]">
                Ask the internet. Understand the people behind it.
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

        <section aria-label="AskSocial capabilities" className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
          {FEATURES.map((feature) => <FeatureCard key={feature.title} {...feature} />)}
        </section>

        <section id="how-it-works" className="rounded-[2rem] bg-white px-6 py-12 shadow-[0_1px_2px_rgba(12,41,35,0.03),0_18px_50px_rgba(12,41,35,0.04)] sm:px-10 lg:px-14 lg:py-14">
          <div className="grid gap-10 lg:grid-cols-[0.7fr_1.3fr] lg:items-start">
            <div className="max-w-xl">
              <div className="text-xs font-semibold uppercase tracking-[0.18em] text-[#0c7a69]">How it works</div>
              <h2 className="mt-4 text-4xl font-semibold leading-tight tracking-[-0.04em] text-[#0b2822] sm:text-5xl">From the open web to actionable intelligence</h2>
              <p className="mt-5 text-base leading-7 text-[#536a63]">
                AskSocial turns fragmented online conversation into structured
                intelligence you can explore conversationally.
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {STEPS.map(([number, title, text]) => <StepCard key={number} number={number} title={title} text={text} />)}
            </div>
          </div>
          <aside className="mt-10 rounded-2xl bg-[#edf3f0] p-6 sm:p-7">
            <h3 className="text-lg font-semibold text-[#0b2822]">Already have research or social listening reports?</h3>
            <p className="mt-3 max-w-4xl text-base leading-7 text-[#536a63]">
              Bring your existing research with you. AskSocial can incorporate curated
              intelligence alongside online evidence, giving teams continuity between
              what they already know and what is emerging now.
            </p>
          </aside>
        </section>

        <section className="rounded-[2rem] bg-white px-6 py-12 shadow-[0_1px_2px_rgba(12,41,35,0.03),0_18px_50px_rgba(12,41,35,0.04)] sm:px-10 lg:px-14 lg:py-14">
          <div className="grid gap-10 lg:grid-cols-2">
            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.18em] text-[#0c7a69]">Human signals across the open web</div>
              <h2 className="mt-4 text-3xl font-semibold tracking-[-0.04em] sm:text-4xl">Social is bigger than social media.</h2>
              <p className="mt-5 text-base leading-7 text-[#536a63]">
                People reveal what they think, experience, fear, question, and need
                across thousands of places online. AskSocial brings those fragmented
                signals together and turns them into intelligence you can interrogate.
              </p>
            </div>
            <div className="rounded-2xl bg-[#f6f9f7] p-6 sm:p-8">
              <h2 className="text-3xl font-semibold tracking-[-0.04em] sm:text-4xl">From mentions to evidence.</h2>
              <p className="mt-5 text-base leading-7 text-[#536a63]">
                AskSocial goes beyond counting conversation. It identifies the
                experiences, questions, beliefs, and narratives within it, then
                connects insights to supporting evidence so you can explore the
                sources behind an answer.
              </p>
              <p className="mt-5 text-sm font-semibold text-[#0c7a69]">Human experiences → Supporting evidence → Strategic answers</p>
            </div>
          </div>
        </section>

        <section aria-labelledby="time-horizons-title" className="rounded-[2rem] bg-white px-6 py-12 shadow-[0_1px_2px_rgba(12,41,35,0.03),0_18px_50px_rgba(12,41,35,0.04)] sm:px-10 lg:px-14 lg:py-14">
          <div className="text-xs font-semibold uppercase tracking-[0.18em] text-[#0c7a69]">Historical + Current + Emerging</div>
          <h2 id="time-horizons-title" className="mt-4 max-w-3xl text-3xl font-semibold tracking-[-0.04em] sm:text-4xl">Understand what persists. Explore what changes.</h2>
          <p className="mt-5 max-w-3xl text-base leading-7 text-[#536a63]">Connect past experiences with today’s conversation and the narratives beginning to take shape.</p>
          <div className="mt-8 grid gap-4 md:grid-cols-3">
            {TIME_HORIZONS.map(([label, question, text]) => (
              <article key={label} className="rounded-2xl bg-[#f6f9f7] p-6">
                <div className="text-xs font-semibold uppercase tracking-[0.18em] text-[#0c7a69]">{label}</div>
                <h3 className="mt-4 text-xl font-semibold leading-7 text-[#0b2822]">{question}</h3>
                <p className="mt-4 text-sm leading-6 text-[#536a63]">{text}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="rounded-[2rem] bg-[#0b2822] px-6 py-12 text-white sm:px-10 lg:flex lg:items-end lg:justify-between lg:gap-10 lg:px-14 lg:py-14">
          <div className="max-w-3xl">
            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-[#83dfcf]">Intelligence for decisions</div>
            <h2 className="mt-4 text-4xl font-semibold tracking-[-0.04em] sm:text-5xl">Ask the internet. Understand the people behind it.</h2>
            <p className="mt-5 max-w-2xl text-base leading-7 text-white/65">
              Turn fragmented online conversation into evidence-backed answers.
              Discover what matters to your audiences, understand why it matters,
              and put that intelligence to work.
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
    <div className="flex min-w-0 items-center gap-2 sm:gap-3" aria-label="AskSocial, AI-powered audience intelligence">
      <svg aria-hidden="true" viewBox="0 0 54 36" className="hidden h-9 w-[54px] shrink-0 sm:block">
        <path fill="#0b2822" d="M0 0h31v25H13L0 36V0Z" />
        <path fill="#39bba5" d="M35 6h19v25H35z" />
      </svg>
      <div className="min-w-0">
        <div className="flex items-baseline text-[1.75rem] leading-none tracking-[-0.06em] text-[#0b2822]">
          <span className="font-normal">Ask</span><strong className="font-bold">Social</strong>
        </div>
        <div className="mt-1 max-w-[150px] text-[10px] font-medium sm:max-w-none text-[#63766f] sm:text-sm">AI-powered audience intelligence</div>
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
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-white/55"><span><span aria-hidden="true" className="mr-2 text-[#83dfcf]">✦</span>Ask</span><span className="text-[10px] tracking-[0.1em]">Illustrative answer</span></div>
      <div className="mt-5 rounded-2xl bg-[#f4f0e6] px-5 py-5 text-lg font-semibold leading-7 text-[#0b2822] sm:text-xl">What themes are driving confusion or concern?</div>
      <div className="mt-4 grid gap-3 rounded-2xl bg-[#edf3f0] p-4 sm:grid-cols-2">
        {insights.map(([label, title, tone]) => (
          <div key={label} className="rounded-2xl bg-white p-4">
            <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold ${tones[tone]}`}>{label}</span>
            <p className="mt-3 text-base font-semibold text-[#0b2822]">{title}</p>
          </div>
        ))}
      </div>
      <p className="mt-5 text-sm leading-6 text-white/70">Explore themes, investigate human experiences, and follow the evidence behind an answer.</p>
      <div className="mt-4 flex flex-wrap gap-2" aria-label="Example source types">
        {["Communities", "Forums", "News", "Social platforms"].map((source) => <span key={source} className="rounded-full border border-white/20 px-3 py-1.5 text-xs text-white/75">{source}</span>)}
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
    compass: <><circle cx="12" cy="12" r="9" /><path d="m16 8-2 6-6 2 2-6 6-2Z" /></>,
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
