import type { ReactNode } from "react";

type SectionCardProps = {
  title: string;
  description?: string;
  eyebrow?: string;
  children: ReactNode;
};

export default function SectionCard({
  title,
  description,
  eyebrow,
  children,
}: SectionCardProps) {
  return (
    <section className="overflow-hidden rounded-3xl border border-white/10 bg-zinc-900/70 shadow-2xl shadow-black/20 backdrop-blur-xl">
      <div className="border-b border-white/10 bg-gradient-to-r from-violet-500/10 via-transparent to-cyan-500/10 px-6 py-6 sm:px-8">
        {eyebrow ? (
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-violet-300">
            {eyebrow}
          </p>
        ) : null}

        <h2 className="mt-2 text-2xl font-bold tracking-tight text-white sm:text-3xl">
          {title}
        </h2>

        {description ? (
          <p className="mt-3 max-w-3xl leading-7 text-zinc-400">
            {description}
          </p>
        ) : null}
      </div>

      <div className="p-6 sm:p-8">{children}</div>
    </section>
  );
}