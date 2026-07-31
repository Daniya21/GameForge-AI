export default function Loading() {
  return (
    <main className="grid min-h-screen place-items-center px-6 pt-24 text-white">
      <div className="flex flex-col items-center text-center">
        <div className="relative grid h-24 w-24 place-items-center">
          <span className="gf-loader-ring gf-loader-ring--outer absolute inset-0 rounded-full" />
          <span className="gf-loader-ring gf-loader-ring--middle absolute inset-3 rounded-full" />
          <span className="gf-loader-ring gf-loader-ring--inner absolute inset-7 rounded-full" />
          <span className="relative text-sm font-black tracking-[0.2em] text-cyan-200">GF</span>
        </div>
        <p className="mt-6 text-sm font-black uppercase tracking-[0.22em] text-zinc-300">Loading Design Intelligence</p>
        <p className="mt-2 text-xs text-zinc-600">Synchronizing the active game project</p>
      </div>
    </main>
  );
}
