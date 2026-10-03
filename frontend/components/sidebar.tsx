"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useDetector } from "@/lib/detector";

const navLink =
  "flex min-h-11 items-center gap-2.5 rounded-md px-2.5 text-sm font-medium text-dim no-underline transition-colors hover:bg-white/6 hover:text-ink aria-[current=page]:bg-white/10 aria-[current=page]:text-ink [&[aria-current=page]_svg]:text-accent";

function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  const active = usePathname() === href;
  return (
    <Link href={href} className={navLink} aria-current={active ? "page" : undefined}>
      {children}
    </Link>
  );
}

const icon = { width: 16, height: 16, viewBox: "0 0 16 16", fill: "none", stroke: "currentColor", strokeWidth: 1.5, strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": true } as const;

export function Sidebar() {
  const d = useDetector();
  return (
    <aside aria-label="Sidebar" className="glass flex min-w-0 flex-[1_1_232px] flex-col gap-5 min-[800px]:sticky min-[800px]:top-0 min-[800px]:h-screen min-[800px]:self-start border-r border-white/10 bg-[rgba(12,14,18,0.5)] px-3.5 py-5">
      <Link href="/" className="self-start px-2.5 py-1 text-2xl leading-none font-extrabold tracking-[0.02em] no-underline font-stretch-75%">
        GTM<span className="text-mute">.si</span>
      </Link>
      <Link href="/onboarding" aria-label="Switch brand (Gatorade)" className="btn-ghost min-h-11 justify-start gap-2.5 border-white/10 bg-white/5 px-3 text-[13px] font-semibold no-underline">
        <span className="size-2 flex-none rounded-full bg-accent" />
        <span className="flex-auto text-left">Gatorade</span>
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="#A9B1BF" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 5.5l3-3 3 3M4 8.5l3 3 3-3" /></svg>
      </Link>
      <nav aria-label="Main" className="flex flex-col gap-0.5">
        <NavLink href="/">
          <svg {...icon}><rect x="2" y="2" width="5" height="5" rx="1" /><rect x="9" y="2" width="5" height="5" rx="1" /><rect x="2" y="9" width="5" height="5" rx="1" /><rect x="9" y="9" width="5" height="5" rx="1" /></svg>
          <span>Mission control</span>
        </NavLink>
        <NavLink href="/videos">
          <svg {...icon}><rect x="1.5" y="3" width="13" height="10" rx="2" /><path d="M6.5 6v4l3.5-2z" /></svg>
          <span>Videos</span>
          <span className="num ml-auto text-xs text-mute">{d.sessions.length}</span>
        </NavLink>
      </nav>
      <div className="mt-auto flex flex-col gap-3">
        <div className="flex flex-col gap-1 rounded-lg border border-white/8 bg-white/5 p-3">
          <span className="flex items-center gap-2 text-[13px] font-semibold"><span className={`size-2 rounded-full ${d.connected ? "bg-accent" : "bg-live"}`} />{d.connected ? "Agents autonomous" : "Detector offline"}</span>
          <span className="text-xs text-mute">{d.connected ? (d.health?.payments_enabled ? "Paying through Stripe" : "Payments simulated") : "Start ./scripts/run_e2e.sh"}</span>
        </div>
        <nav aria-label="Account" className="flex flex-col">
          <NavLink href="/settings">
            <svg {...icon}><path d="M2 4.5h6.5M12.5 4.5H14M2 11.5h2M7.5 11.5H14" /><circle cx="10.5" cy="4.5" r="2" /><circle cx="5.5" cy="11.5" r="2" /></svg>
            <span>Settings</span>
          </NavLink>
        </nav>
      </div>
    </aside>
  );
}
