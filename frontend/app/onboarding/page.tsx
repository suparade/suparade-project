"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

// ponytail: the brand agent and search agent are simulated with timers; swap for backend calls once they exist.
const BRANDS = [
  { id: "gatorade", name: "Gatorade", short: "Gatorade", kind: "Sports drink", color: "#FF7A1A", product: "bottle",
    profile: [
      ["Product", "Sports drink in 20 oz and 28 oz bottles, plus Gatorade Zero and G2."],
      ["Looks like", "Orange bolt logo and the Gatorade wordmark, coloured drink visible through the bottle."],
      ["Sounds like", "“Gatorade”, “Gatorade Zero”, “G2”, “the blue one”."],
      ["Fits with", "Gym, running, team sports, esports and long gaming sessions."],
      ["Voice", "Short and upbeat. Signs off “Stay hydrated.”"],
      ["Never pay for", "Competitor bottles in frame (Powerade, Prime, BodyArmor), alcohol, creators under 18."],
    ] },
  { id: "northline", name: "Northline Cold Brew", short: "Northline", kind: "Canned cold brew coffee", color: "#C6F432", product: "can",
    profile: [
      ["Product", "Cold brew coffee in a slim 250 ml can, black or oat."],
      ["Looks like", "Matte black can, lime horizon line, lowercase wordmark."],
      ["Sounds like", "“Northline”, “the black can”, “my cold brew”."],
      ["Fits with", "Morning streams, study and work-with-me, cooking."],
      ["Voice", "Dry and calm. Signs off “Steady on.”"],
      ["Never pay for", "Other coffee brands in frame, energy drinks, creators under 18."],
    ] },
  { id: "fernway", name: "Fernway Sparkling", short: "Fernway", kind: "Sparkling mineral water", color: "#4DA3FF", product: "can",
    profile: [
      ["Product", "Sparkling mineral water in a 330 ml can, three flavours."],
      ["Looks like", "Pale blue can, line-drawn fern, FERNWAY in tall capitals."],
      ["Sounds like", "“Fernway”, “the fern can”, “sparkling water”."],
      ["Fits with", "Outdoor vlogs, running, cooking, slow chat streams."],
      ["Voice", "Warm and light. Signs off “Stay fresh.”"],
      ["Never pay for", "Competitor cans in frame, alcohol mixers, creators under 18."],
    ] },
];

const STEPS = ["Brand", "Understand", "Rules", "Streams"];

const TASKS = [
  ["Read the website", "Product range, flavours, brand story"],
  ["Studied the packaging", "Logo and product shots: shape, colours, wordmark"],
  ["Read recent posts", "120 posts, for voice and audience"],
  ["Checked where it already shows up", "31 creator mentions in the last 30 days"],
  ["Researched market rates", "Exa search: what brands pay creators per mention and per placement. Saved to shared memory"],
];

const CHECKED = 214;

const h1 = "m-0 text-[40px] leading-[1.08] font-bold tracking-[-0.01em] font-stretch-78%";
const lead = "m-0 text-base leading-normal text-dim";
const footer = "flex flex-wrap justify-between gap-3 border-t border-white/8 pt-5";
const ghost = "btn-ghost h-12 px-[18px] text-[15px] font-medium";
const primary = "btn-primary h-12 px-[22px] text-[15px]";
const checkRow = "check -mx-3 flex min-h-11 cursor-pointer items-center gap-3 rounded-md px-3 py-2.5";

function Tick({ size = 16 }: { size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 8.3l3 3 7-7" /></svg>;
}

export default function Onboarding() {
  const [step, setStep] = useState(1);
  const [brandId, setBrandId] = useState("gatorade");
  const [learnDone, setLearnDone] = useState(0);
  const [correcting, setCorrecting] = useState(false);
  const [off, setOff] = useState<Record<string, boolean>>({ water: true, talk: true });
  const [foundN, setFoundN] = useState(0);
  const [dropped, setDropped] = useState<Record<string, boolean>>({});

  const goTo = (n: number) => {
    setStep(n);
    setCorrecting(false);
    setLearnDone(0);
    setFoundN(0);
  };

  // Step 2: the brand agent ticks off one task every 1.3 s. Step 4: the search agent finds a stream every 0.65 s.
  useEffect(() => {
    const ids: ReturnType<typeof setTimeout>[] = [];
    if (step === 2) for (let k = 1; k <= TASKS.length; k++) ids.push(setTimeout(() => setLearnDone(k), k * 1300));
    if (step === 4) for (let k = 1; k <= 6; k++) ids.push(setTimeout(() => setFoundN(k), 500 + k * 650));
    return () => ids.forEach(clearTimeout);
  }, [step]);

  const b = BRANDS.find((x) => x.id === brandId)!;
  const learned = learnDone >= TASKS.length;
  const back = () => goTo(Math.max(1, step - 1));

  const moments = [
    { id: "mention", label: "Names the brand", hint: `${b.short} said out loud or read from chat` },
    { id: "showing", label: "Product on screen", hint: `The ${b.product}, its label or logo is visible` },
    { id: "drinking", label: "Drinks it on camera", hint: `The ${b.product} is identifiable while they drink` },
    { id: "water", label: "Any hydration moment", hint: "Drinking water, no brand needed" },
    { id: "talk", label: "Talks about drinks", hint: "Drink talk without the brand" },
  ];
  const streams = [
    { handle: "kaimplays", where: "Twitch · live · 2.4k watching", why: `Drinks on camera between rounds. Chat asked about ${b.short} last week.`, fit: "0.94" },
    { handle: "pixelpatty", where: "Twitch · live · 5.1k watching", why: `Reads chat on air. ${b.short} came up twice in the last month.`, fit: "0.91" },
    { handle: "gymwithjules", where: "YouTube · video · 24:10", why: "Fitness channel. A drink is in frame for most of every set.", fit: "0.89" },
    { handle: "nova.runs", where: "YouTube · video · 41:10", why: "Long-run vlogs with drink stops on camera.", fit: "0.86" },
    { handle: "dj_marrow", where: "Twitch · live · 1.2k watching", why: "A drink sits on the booth in the wide shot every set.", fit: "0.74" },
    { handle: "theo_cooks", where: "TikTok · live · 860 watching", why: "Cooking streams. Drinks stay on the counter in view.", fit: "0.71" },
  ];
  const found = streams.slice(0, foundN);
  const kept = found.filter((r) => !dropped[r.handle]).length;
  const searched = foundN >= streams.length;
  const canLaunch = searched && kept > 0;
  const launchTxt = !searched ? "Searching…" : kept === 0 ? "Keep at least one stream" : `Start ${kept} ${kept === 1 ? "scout" : "scouts"}`;

  return (
    <div className="ambient flex min-h-screen flex-col" style={{ "--accent": b.color } as React.CSSProperties}>
      <header className="glass flex flex-wrap items-center justify-between gap-x-6 gap-y-3 border-b border-white/10 bg-[rgba(12,14,18,0.45)] px-6 py-4">
        <span className="text-2xl leading-none font-extrabold tracking-[0.02em] font-stretch-75%">GTM<span className="text-mute">.si</span></span>
        <ol aria-label="Onboarding steps" className="m-0 flex list-none flex-wrap gap-x-5 gap-y-2 p-0">
          {STEPS.map((label, i) => {
            const n = i + 1;
            const now = n === step;
            const done = n < step;
            return (
              <li key={label} aria-current={now ? "step" : undefined} className={`flex items-center gap-2 text-[13px] font-medium ${now ? "text-ink" : done ? "text-dim" : "text-mute"}`}>
                <span className={`num inline-flex size-[22px] items-center justify-center rounded-full border text-[11px] ${now ? "border-accent bg-accent text-ground" : done ? "border-accent text-accent" : "border-white/16"}`}>
                  {done ? <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M2.5 6.2l2.3 2.3 4.7-5" /></svg> : n}
                </span>
                <span>{label}</span>
              </li>
            );
          })}
        </ol>
        <span className="text-[13px] text-mute">Step <span className="num">{step}</span> of 4</span>
      </header>

      <main className="glass mx-auto mt-10 mb-16 flex w-[calc(100%-32px)] max-w-[760px] flex-col gap-7 rounded-2xl border border-white/10 bg-white/4 px-[clamp(20px,4vw,44px)] pt-10 pb-9">
        {step === 1 && (
          <>
            <div className="flex flex-col gap-2.5">
              <h1 className={h1}>Which brand are the agents working for?</h1>
              <p className={lead}>Before a single scout watches a stream, the brand agent studies the brand: what the product looks like, how people say its name, where it fits.</p>
            </div>

            <fieldset className="m-0 flex flex-col gap-2.5 border-0 p-0">
              <legend className="mb-2.5 p-0 text-[15px] font-semibold">Your brands</legend>
              {BRANDS.map((x) => (
                <label key={x.id} className={`pick flex min-h-16 cursor-pointer items-center gap-3.5 rounded-[10px] bg-white/5 px-4 py-3 ${x.id === brandId ? "on" : ""}`}>
                  <input type="radio" name="brand" value={x.id} checked={x.id === brandId} onChange={() => setBrandId(x.id)} />
                  <span className="size-3 flex-none rounded-full" style={{ background: x.color }} />
                  <span className="flex min-w-0 flex-auto flex-col gap-0.5">
                    <span className="text-[15px] font-semibold">{x.name}</span>
                    <span className="text-[13px] text-mute">{x.kind}</span>
                  </span>
                </label>
              ))}
            </fieldset>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="site" className="text-[13px] text-dim">Or add a new brand by its website</label>
              <div className="flex flex-wrap gap-2">
                <input id="site" name="site" type="url" placeholder="https://yourbrand.com" className="flex-[1_1_260px]" />
                <button type="button" className="btn-ghost h-10 px-4 text-sm font-semibold">Add brand</button>
              </div>
            </div>

            <button type="button" className="btn-ghost min-h-24 flex-col gap-1 border-dashed border-white/20 p-4 text-sm text-dim">
              <span className="font-semibold text-ink">Add the logo and a few product photos</span>
              <span className="text-[13px]">Optional. Packaging shots help the scouts spot the {b.product} on screen.</span>
            </button>

            <div className="flex justify-end border-t border-white/8 pt-5">
              <button type="button" onClick={() => goTo(2)} className={primary}>Study {b.short}</button>
            </div>
          </>
        )}

        {step === 2 && (
          <>
            <div className="flex flex-col gap-2.5">
              <h1 className={h1}>Getting to know {b.name}</h1>
              <p className={lead}>The brand agent reads what is public about {b.short} so the scouts know exactly what to look for. This takes about a minute.</p>
            </div>

            <ol aria-label="What the brand agent is doing" className="m-0 flex list-none flex-col border-t border-white/8 p-0">
              {TASKS.map(([label, detail], i) => {
                const state = i < learnDone ? "done" : i === learnDone ? "working" : "waiting";
                return (
                  <li key={label} className="grid grid-cols-[24px_minmax(0,1fr)_auto] items-center gap-3.5 border-b border-white/8 py-3.5">
                    <span aria-hidden="true" className="flex justify-center">
                      {state === "done" ? <Tick /> : state === "working" ? <span className="spin" /> : <span className="m-1 block size-2 rounded-full bg-white/18" />}
                    </span>
                    <span className="flex min-w-0 flex-col gap-0.5">
                      <span className={`text-[15px] font-medium ${state === "waiting" ? "text-mute" : ""}`}>{label}</span>
                      <span className="text-[13px] text-mute">{detail}</span>
                    </span>
                    <span className={`text-xs font-medium ${state === "done" ? "text-accent" : state === "working" ? "text-amber" : "text-mute"}`}>
                      {state === "done" ? "Done" : state === "working" ? "Working" : "Waiting"}
                    </span>
                  </li>
                );
              })}
            </ol>
            <p role="status" className="sr-only">{learned ? `The brand agent finished studying ${b.name}.` : `${learnDone} of 5 steps done.`}</p>

            {learned && (
              <section aria-label="What the agent understood" className="rise flex flex-col gap-4.5 rounded-[10px] border border-white/8 bg-white/5 p-6">
                <h2 className="m-0 text-[22px] leading-[1.2] font-semibold">What the agent understood</h2>
                <dl className="m-0 flex flex-col gap-3">
                  {b.profile.map(([k, v]) => (
                    <div key={k} className="grid grid-cols-[120px_minmax(0,1fr)] gap-4 text-sm leading-normal">
                      <dt className="text-mute">{k}</dt>
                      <dd className="m-0">{v}</dd>
                    </div>
                  ))}
                </dl>
                {correcting && (
                  <div className="flex flex-col gap-1.5 border-t border-white/8 pt-4">
                    <label htmlFor="fix" className="text-[13px] text-dim">What did the agent get wrong?</label>
                    <textarea id="fix" name="fix" rows={3} placeholder="For example: the label changed last month, the old bottle no longer counts." />
                  </div>
                )}
              </section>
            )}

            <div className={footer}>
              <button type="button" onClick={back} className={ghost}>Back</button>
              <div className="flex flex-wrap gap-3">
                {learned && <button type="button" onClick={() => setCorrecting(!correcting)} aria-expanded={correcting} className={ghost}>Correct something</button>}
                <button type="button" onClick={() => goTo(3)} disabled={!learned} className={primary}>{learned ? "Looks right, continue" : "Studying…"}</button>
              </div>
            </div>
          </>
        )}

        {step === 3 && (
          <>
            <div className="flex flex-col gap-2.5">
              <h1 className={h1}>What should the agents pay for?</h1>
              <p className={lead}>The brand agent picked these from what it learned about {b.short}. Change anything now, or later in Settings.</p>
            </div>

            <fieldset className="m-0 flex flex-col gap-1 border-0 border-b border-white/8 p-0 pb-7">
              <legend className="mb-1.5 p-0 text-[15px] font-semibold">What counts as a moment</legend>
              <p className="m-0 mb-2.5 text-[13px] text-mute">The tipper prices every moment itself, from what the creator did and the market rates the brand agent just found.</p>
              {moments.map((m) => (
                <label key={m.id} className={checkRow}>
                  <input type="checkbox" name="moments" value={m.id} checked={!off[m.id]} onChange={() => setOff((o) => ({ ...o, [m.id]: !o[m.id] }))} />
                  <span className="flex flex-auto flex-col gap-px">
                    <span className="text-sm font-medium">{m.label}</span>
                    <span className="text-[13px] text-mute">{m.hint}</span>
                  </span>
                </label>
              ))}
            </fieldset>

            <fieldset className="m-0 flex flex-col gap-3.5 border-0 p-0">
              <legend className="mb-3.5 p-0 text-[15px] font-semibold">Budget</legend>
              <div className="grid grid-cols-[repeat(auto-fit,minmax(min(180px,100%),1fr))] gap-3">
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="fund" className="text-[13px] text-dim">Fund the wallet</label>
                  <input id="fund" name="fund" defaultValue="$500.00" className="num" />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="maxtip" className="text-[13px] text-dim">Max tip per moment</label>
                  <input id="maxtip" name="maxtip" defaultValue="$10.00" className="num" />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="cool" className="text-[13px] text-dim">Cooldown per creator</label>
                  <input id="cool" name="cooldown" defaultValue="30 s of stream time" />
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
                <button type="button" className="btn-ghost h-10 px-4 text-sm font-semibold">Fund with Link</button>
                <span className="text-[13px] text-mute">Stripe Link Agent Wallet, test mode. The tipper can only spend what is in here.</span>
              </div>
            </fieldset>

            <div className={footer}>
              <button type="button" onClick={back} className={ghost}>Back</button>
              <button type="button" onClick={() => goTo(4)} className={primary}>Find streams</button>
            </div>
          </>
        )}

        {step === 4 && (
          <>
            <div className="flex flex-col gap-2.5">
              <h1 className={h1}>Finding streams where {b.short} fits</h1>
              <p className={lead}>The search agent looks for live streams and recent videos where {b.short} already comes up or would fit naturally. Every stream you keep gets its own scout.</p>
            </div>

            <div role="status" className="flex items-center gap-2.5 rounded-lg border border-white/8 bg-white/5 px-3.5 py-3 text-[13px] text-dim">
              {searched ? <Tick /> : <span className="spin" aria-hidden="true" />}
              <span>
                {searched
                  ? `Checked ${CHECKED} streams on Twitch, YouTube and TikTok. ${streams.length} are a good fit.`
                  : `Searching Twitch, YouTube and TikTok · ${Math.round((CHECKED * foundN) / streams.length)} streams checked`}
              </span>
            </div>

            <ul aria-label="Streams found" className="m-0 flex list-none flex-col border-t border-white/8 p-0">
              {found.map((r) => (
                <li key={r.handle} className="rise border-b border-white/8">
                  <label className="check -mx-3 grid cursor-pointer grid-cols-[18px_minmax(0,1fr)_auto] items-center gap-3.5 rounded-md p-3">
                    <input type="checkbox" name="streams" value={r.handle} checked={!dropped[r.handle]} onChange={() => setDropped((d) => ({ ...d, [r.handle]: !d[r.handle] }))} />
                    <span className="flex min-w-0 flex-col gap-0.5">
                      <span className="flex flex-wrap items-baseline gap-2"><span className="text-[15px] font-semibold">@{r.handle}</span><span className="text-xs text-mute">{r.where}</span></span>
                      <span className="text-[13px] leading-[1.45] text-dim">{r.why}</span>
                    </span>
                    <span className="text-xs text-mute">fit <span className="num text-ink">{r.fit}</span></span>
                  </label>
                </li>
              ))}
            </ul>

            <div className={`${footer} items-center`}>
              <button type="button" onClick={back} className={ghost}>Back</button>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
                <span className="text-[13px] text-mute">Agents act on their own once started. Tips go to each creator&apos;s Stripe account, set up in Videos.</span>
                {canLaunch ? <Link href="/" className={primary}>{launchTxt}</Link> : <button type="button" disabled className={primary}>{launchTxt}</button>}
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
