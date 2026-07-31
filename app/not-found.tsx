import Link from "next/link";

const routes = [
  ["Project Library", "/projects"],
  ["Design Studio", "/design-studio"],
  ["Production", "/production-intelligence"],
  ["Team Handoff", "/team-workspace"],
  ["Final GDD", "/gdd-export"],
];

export default function NotFound() {
  return (
    <main className="relative grid min-h-screen place-items-center overflow-hidden px-5 pb-20 pt-28 text-white">
      <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(circle_at_50%_30%,rgba(124,58,237,.24),transparent_34%),radial-gradient(circle_at_80%_70%,rgba(34,211,238,.12),transparent_30%)]" />
      <section className="w-full max-w-3xl rounded-[34px] border border-white/10 bg-[#08060f]/88 p-7 text-center shadow-[0_36px_120px_rgba(0,0,0,.55)] backdrop-blur-2xl sm:p-12">
        <div className="mx-auto grid h-20 w-20 place-items-center rounded-[26px] border border-violet-300/25 bg-violet-300/10 text-3xl font-black text-violet-200">404</div>
        <p className="mt-7 text-xs font-black uppercase tracking-[0.22em] text-cyan-300">Route not found</p>
        <h1 className="mt-3 text-4xl font-black tracking-[-.03em] sm:text-5xl">This workspace link is not available.</h1>
        <p className="mx-auto mt-5 max-w-2xl leading-7 text-zinc-400">Use one of the main GameForge workspaces below.</p>
        <div className="mt-8 grid gap-3 sm:grid-cols-2">
          {routes.map(([label, href]) => <Link key={href} href={href} className="rounded-2xl border border-white/10 bg-white/[0.04] px-5 py-4 font-black text-zinc-200 transition hover:-translate-y-1 hover:border-cyan-300/30 hover:bg-cyan-300/[0.07]">{label} →</Link>)}
        </div>
        <Link href="/" className="mt-6 inline-flex h-12 items-center justify-center rounded-2xl bg-white px-6 font-black text-black transition hover:-translate-y-1 hover:bg-cyan-100">Return home</Link>
      </section>
    </main>
  );
}
