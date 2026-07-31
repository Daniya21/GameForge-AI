import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json(
    {
      error: "The generated-game runtime has been retired from the public GameForge pre-production product.",
      redirect: "/design-studio",
      supportedWorkflow: "Use the Project Library, Design Studio, Production, Team Handoff, and Final GDD workflow.",
    },
    { status: 410 },
  );
}
