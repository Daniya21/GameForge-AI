"use client";

import type { ReactNode } from "react";

type Props = {
  children: ReactNode;
};

export default function Reveal({ children }: Props) {
  return <div className="gf-rise">{children}</div>;
}
