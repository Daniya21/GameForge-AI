"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { GameProject } from "@/app/types/game-project";
import {
  GAME_PROJECT_EVENT,
  getOrCreateActiveGameProject,
  projectReadiness,
} from "@/lib/game-project/client";

type Props = {
  compact?: boolean;
  className?: string;
};

export default function GameProjectBadge({ compact = false, className = "" }: Props) {
  const [project, setProject] = useState<GameProject | null>(null);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => setProject(getOrCreateActiveGameProject()));
    const handleUpdate = (event: Event) => {
      const custom = event as CustomEvent<GameProject>;
      setProject(custom.detail ?? getOrCreateActiveGameProject());
    };
    window.addEventListener(GAME_PROJECT_EVENT, handleUpdate);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener(GAME_PROJECT_EVENT, handleUpdate);
    };
  }, []);

  const readiness = projectReadiness(project);
  const title = project?.title || "Untitled Game Project";

  if (compact) {
    return (
      <Link
        href="/projects"
        className={`group inline-flex h-10 items-center gap-2 rounded-full border border-cyan-300/20 bg-cyan-300/[0.075] px-3 text-xs font-black text-cyan-100 transition-all duration-300 hover:-translate-y-0.5 hover:border-cyan-300/45 hover:bg-cyan-300/[0.12] hover:shadow-[0_10px_28px_rgba(34,211,238,.12)] ${className}`}
        title={`Open ${title}`}
        aria-label={`Open ${title}. ${readiness.completed} of ${readiness.total} Design Studio sections complete.`}
      >
        <span className="relative h-2 w-2 shrink-0 rounded-full bg-cyan-300 shadow-[0_0_12px_rgba(103,232,249,.9)]">
          <span className="absolute inset-0 animate-ping rounded-full bg-cyan-300/40" />
        </span>
        <span className="whitespace-nowrap text-cyan-100/90">Project</span>
        <span className="rounded-full bg-cyan-200/10 px-2 py-0.5 text-[10px] text-cyan-200 transition group-hover:bg-cyan-200/15">
          {readiness.completed}/{readiness.total}
        </span>
      </Link>
    );
  }

  return (
    <Link
      href="/projects"
      className={`group inline-flex h-10 min-w-0 items-center gap-3 rounded-full border border-cyan-300/20 bg-cyan-300/[0.075] px-4 text-xs font-bold text-cyan-100 transition-all duration-300 hover:-translate-y-0.5 hover:border-cyan-300/45 hover:bg-cyan-300/[0.12] ${className}`}
      title={`Open ${title}`}
    >
      <span className="relative h-2 w-2 shrink-0 rounded-full bg-cyan-300 shadow-[0_0_12px_rgba(103,232,249,.9)]">
        <span className="absolute inset-0 animate-ping rounded-full bg-cyan-300/40" />
      </span>
      <span className="max-w-52 truncate">{title}</span>
      <span className="shrink-0 text-cyan-300/75">{readiness.completed}/{readiness.total}</span>
    </Link>
  );
}
