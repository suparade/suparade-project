"use client";

import Link from "next/link";

const MOMENTS = [
  { value: "sports_drink_mention", label: "Sports drink mention", hint: "The brand is said out loud or read from chat", on: true },
  { value: "holding_or_showing_beverage", label: "Showing a beverage", hint: "Bottle, cap or logo visible on screen", on: true },
  { value: "drinking_other", label: "Drinking the product", hint: "On camera, bottle identifiable", on: true },
  { value: "drinking_water", label: "Drinking water", hint: "Any hydration moment, no brand needed", on: false },
  { value: "verbal_beverage_mention", label: "Talks about drinks", hint: "General drink talk without the brand", on: false },
];

const RULES = [
  "Flag Gatorade bottles, the bolt logo and the wordmark on screen, and “Gatorade” in speech or chat.",
  "Ignore plain water and general drink talk. You left those off.",
  "Price each moment from the market rate for that kind of placement, up to $10. More when the brand is named and shown together or drunk on camera. Less for a bottle in the background.",
  "One tip per creator every 30 seconds of stream time. Nothing under 0.60 confidence.",
  "Send a short message with every tip, signed Gatorade, so the creator sees why they were paid.",
  "Stop tipping a creator when another tip wouldn't change what they do, or when they repeat the name just to get paid.",
  "Stop when the wallet hits $0.",
];

const RATES = [
  ["Spoken shoutout, Twitch, 1–5k viewers", "$3–6"],
  ["Product used on camera, fitness video", "$3–6"],
  ["Product in frame, Twitch music stream", "$1–2"],
  ["Product in frame, small TikTok live", "$1–2"],
];

const GUIDANCE =
  "Start from the market rate in shared memory. Pay more when the brand is named and shown at the same time, or when someone drinks it on camera. Pay less for a bottle in the background. Stop tipping a creator who repeats the name just to get paid. Keep messages short and friendly, mention the moment, sign them Gatorade.";

const legend = "mb-3.5 p-0 text-[15px] font-semibold";
const fieldset = "m-0 flex flex-col gap-3.5 border-0 border-b border-white/8 p-0 pb-7";
const label = "text-[13px] text-dim";

function Field({ id, name, text, value, mono }: { id: string; name: string; text: string; value: string; mono?: boolean }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className={label}>{text}</label>
      <input id={id} name={name} defaultValue={value} className={mono ? "num" : undefined} />
    </div>
  );
}

// ponytail: the form persists nothing yet; it saves to Supabase (shared memory) once the backend lands.
export default function Settings() {
  return (
    <main className="min-w-0 flex-[999_1_560px]">
      <div className="mx-auto flex w-full max-w-[1200px] flex-col gap-8 px-6 pt-10 pb-16">
        <div className="flex max-w-[640px] flex-col gap-2.5">
          <h1 className="m-0 text-[44px] leading-[1.05] font-bold tracking-[-0.01em] font-stretch-78%">Settings</h1>
          <p className="m-0 text-base leading-normal text-dim">The brief your agents work from: the brand, what counts as a moment, the guardrails and the wallet.</p>
        </div>

        <div className="flex flex-wrap items-start gap-x-12 gap-y-8">
          <form id="brief" onSubmit={(e) => e.preventDefault()} className="glass flex min-w-0 flex-[3_1_480px] flex-col gap-7 rounded-[10px] border border-white/10 bg-white/[.045] p-7">
            <fieldset className={fieldset}>
              <legend className={legend}>Brand</legend>
              <div className="grid grid-cols-[repeat(auto-fit,minmax(min(220px,100%),1fr))] gap-3">
                <Field id="brand" name="brand" text="Brand name" value="Gatorade" />
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="bcolor" className={label}>Brand color</label>
                  <div className="flex items-center gap-2">
                    <span className="size-10 flex-none rounded-md bg-accent" />
                    <input id="bcolor" name="bcolor" defaultValue="#FF7A1A" className="num text-[13px]" />
                  </div>
                </div>
              </div>
              <button type="button" className="btn-ghost min-h-24 flex-col gap-1 border-dashed border-white/20 p-4 text-sm text-dim">
                <span className="font-semibold text-ink">Drop the logo and a few product photos</span>
                <span className="text-[13px]">The scouts learn the bottle shape, the cap and the wordmark from these.</span>
              </button>
              <p className="m-0 text-[13px] text-mute">The brand agent studied Gatorade during onboarding. <Link href="/onboarding">Study the brand again</Link></p>
            </fieldset>

            <fieldset className={`${fieldset} gap-1`}>
              <legend className="mb-1.5 p-0 text-[15px] font-semibold">What counts as a moment</legend>
              <p className="m-0 mb-2.5 text-[13px] text-mute">Each one maps to a category the scouts return. The tipper prices every moment itself, from what the creator did and the market rates in shared memory.</p>
              {MOMENTS.map((m) => (
                <label key={m.value} className="check -mx-3 flex min-h-11 cursor-pointer items-center gap-3 rounded-md px-3 py-2.5">
                  <input type="checkbox" name="cats" value={m.value} defaultChecked={m.on} />
                  <span className="flex flex-auto flex-col gap-px">
                    <span className="text-sm font-medium">{m.label}</span>
                    <span className="text-[13px] text-mute">{m.hint}</span>
                  </span>
                </label>
              ))}
            </fieldset>

            <fieldset className={fieldset}>
              <legend className={legend}>Guardrails</legend>
              <div className="grid grid-cols-[repeat(auto-fit,minmax(min(180px,100%),1fr))] gap-3">
                <Field id="cool" name="cooldown" text="Cooldown per creator" value="30 s of stream time" />
                <Field id="conf" name="confidence" text="Minimum confidence" value="0.60" />
                <Field id="maxtip" name="maxtip" text="Max tip per moment" value="$10.00" />
              </div>
            </fieldset>

            <fieldset className={`${fieldset} gap-1.5`}>
              <legend className="mb-2 p-0 text-[15px] font-semibold">How to tip</legend>
              <label htmlFor="guide" className={label}>Guidance for the tipper, in plain words</label>
              <textarea id="guide" name="guidance" rows={4} defaultValue={GUIDANCE} />
            </fieldset>

            <fieldset className="m-0 flex flex-col gap-3.5 border-0 p-0">
              <legend className={legend}>Wallet</legend>
              <div className="flex flex-wrap items-end gap-3">
                <div className="flex flex-[1_1_200px] flex-col gap-1.5">
                  <label htmlFor="fund" className={label}>Amount to fund</label>
                  <input id="fund" name="fund" defaultValue="$500.00" className="num" />
                </div>
                <button type="button" className="btn-ghost h-10 px-4 text-sm font-semibold">Fund with Link</button>
                <a href="https://dashboard.stripe.com/test/payments" target="_blank" rel="noopener" className="inline-flex h-10 items-center gap-1.5 text-[13px] font-medium text-dim no-underline">
                  Stripe dashboard
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 2.5H2.5v7h7V7" /><path d="M7 2h3v3M10 2L5.5 6.5" /></svg>
                  <span className="sr-only">(opens in a new tab)</span>
                </a>
              </div>
              <p className="m-0 text-[13px] text-mute">Stripe Link Agent Wallet, test mode. The tipper spends on its own and never more than what is in here. Each tip goes to the creator&apos;s Stripe account, set up in Videos.</p>
            </fieldset>
          </form>

          <aside aria-label="Shared memory" className="glass flex min-w-0 flex-[2_1_360px] flex-col gap-4.5 rounded-[10px] border border-white/10 bg-white/[.045] p-6">
            <div className="flex flex-col gap-1.5">
              <h2 className="m-0 text-[22px] leading-[1.2] font-semibold">Shared memory</h2>
              <p className="m-0 text-[13px] leading-normal text-dim">Every agent reads from here and writes back what it learns. The tipper checks market rates here first and only searches Exa when nothing fits.</p>
            </div>
            <h3 className="m-0 text-sm font-semibold">Rules</h3>
            <ol className="m-0 flex list-decimal flex-col gap-2.5 pl-5 text-sm leading-normal">
              {RULES.map((r) => <li key={r}>{r}</li>)}
            </ol>
            <div className="flex flex-col gap-2.5 border-t border-white/8 pt-3.5">
              <h3 className="m-0 text-sm font-semibold">Market rates</h3>
              <dl className="m-0 flex flex-col gap-2 text-[13px] leading-[1.45]">
                {RATES.map(([what, range]) => (
                  <div key={what} className="flex justify-between gap-3">
                    <dt className="text-dim">{what}</dt>
                    <dd className="num m-0 whitespace-nowrap">{range}</dd>
                  </div>
                ))}
              </dl>
              <p className="m-0 text-xs leading-normal text-mute">Found with Exa: three during onboarding, one today when the tipper met a TikTok cooking live for the first time.</p>
            </div>
            <p className="m-0 border-t border-white/8 pt-3.5 text-[13px] text-dim">Wallet: <span className="num text-ink">$500.00</span> funded, <span className="num text-ink">$58.50</span> spent.</p>
            <button type="submit" form="brief" className="btn-primary h-12 text-[15px]">Save changes</button>
            <p className="m-0 text-[13px] leading-normal text-mute">Changes reach the scouts on their next clip and the tipper on its next decision. Pausing the wallet stops payouts instantly; the scouts keep watching.</p>
          </aside>
        </div>
      </div>
    </main>
  );
}
